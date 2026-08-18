<?php
/**
 * ============================================================================
 * nfe-service — Emissão de NF-e self-hosted (nfephp-org/sped-nfe)
 * ERP XLife · xlifevps · rede interna do projeto `apps`
 *
 * Stateless: certificado e dados chegam na requisição, nada é gravado em disco.
 * Auth: Authorization: Bearer $NFE_SERVICE_TOKEN (exceto /healthz)
 * ============================================================================
 */

declare(strict_types=1);
require __DIR__ . '/../vendor/autoload.php';

use NFePHP\NFe\Make;
use NFePHP\NFe\Tools;
use NFePHP\NFe\Common\Standardize;
use NFePHP\NFe\Complements;
use NFePHP\Common\Certificate;
use NFePHP\DA\NFe\Danfe;
use NFePHP\DA\NFe\Danfce;

// ---------------------------------------------------------------------------
// Infra HTTP mínima
// ---------------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
$path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function out(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input') ?: '{}';
    $data = json_decode($raw, true);
    if (!is_array($data)) out(400, ['erro' => 'JSON inválido']);
    return $data;
}

if ($path === '/healthz') out(200, ['status' => 'ok']);

// Auth
$token = getenv('NFE_SERVICE_TOKEN') ?: '';
$auth  = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($token === '' || !hash_equals("Bearer {$token}", $auth)) {
    out(401, ['erro' => 'não autorizado']);
}

// ---------------------------------------------------------------------------
// Helpers sped-nfe
// ---------------------------------------------------------------------------

/** Monta o Tools (conexão SEFAZ) a partir do bloco `emitente` + `certificado`. */
function makeTools(array $req): Tools {
    foreach (['certificado', 'emitente', 'ambiente'] as $k) {
        if (empty($req[$k])) out(422, ['erro' => "campo obrigatório ausente: {$k}"]);
    }
    $cert = $req['certificado'];
    if (empty($cert['pfx_base64']) || !isset($cert['senha'])) {
        out(422, ['erro' => 'certificado.pfx_base64 e certificado.senha são obrigatórios']);
    }
    $pfx = base64_decode($cert['pfx_base64'], true);
    if ($pfx === false) out(422, ['erro' => 'pfx_base64 inválido']);

    try {
        $certificate = Certificate::readPfx($pfx, (string)$cert['senha']);
    } catch (\Throwable $e) {
        out(422, ['erro' => 'certificado inválido ou senha incorreta', 'detalhe' => $e->getMessage()]);
    }

    $emit = $req['emitente'];
    $config = json_encode([
        'atualizacao' => date('Y-m-d H:i:s'),
        'tpAmb'       => (int)$req['ambiente'],           // 1=produção 2=homologação
        'razaosocial' => $emit['razao'] ?? '',
        'cnpj'        => preg_replace('/\D/', '', $emit['cnpj'] ?? ''),
        'siglaUF'     => $emit['uf'] ?? 'BA',
        'schemes'     => 'PL_009_V4',
        'versao'      => '4.00',
        'tokenIBPT'   => '',
        'CSC'         => $req['csc'] ?? '',
        'CSCid'       => $req['csc_id'] ?? '',
    ]);

    $tools = new Tools($config, $certificate);
    // sped-nfe 5.2+ exige int em model() — passar string lança TypeError
    $tools->model((int)($req['nota']['modelo'] ?? 55));
    return $tools;
}

/** Constrói o XML da NF-e a partir do payload padronizado do ERP. */
function buildXml(array $req): string {
    $emit  = $req['emitente'];
    $dest  = $req['destinatario'] ?? [];
    $nota  = $req['nota'];
    $itens = $req['itens'] ?? [];
    if (count($itens) === 0) out(422, ['erro' => 'nota sem itens']);

    // Modelo 65 (NFC-e) x 55 (NF-e): mudam impressão, destinatário e QR Code.
    $modelo = (int)($nota['modelo'] ?? 55);
    $isNFCe = $modelo === 65;

    // finNFe: 1=normal 2=complementar 3=ajuste 4=devolução
    $finalidade   = (int)($nota['finalidade'] ?? 1);
    $isDevolucao  = $finalidade === 4;
    if ($isDevolucao && $isNFCe) {
        out(422, ['erro' => 'devolução exige NF-e modelo 55 (NFC-e não comporta finalidade 4)']);
    }
    if ($isDevolucao && empty($nota['chave_referenciada'])) {
        out(422, ['erro' => 'devolução exige nota.chave_referenciada (chave da NF-e original)']);
    }
    if ($isNFCe && (empty($req['csc']) || empty($req['csc_id']))) {
        out(422, ['erro' => 'NFC-e exige CSC e CSC id (cadastre em Configurações SEFAZ)']);
    }

    $tpAmb  = (int)$req['ambiente'];
    $cnpj   = preg_replace('/\D/', '', $emit['cnpj']);
    $numero = (int)$nota['numero'];
    $serie  = (int)($nota['serie'] ?? 1);
    $dhEmi  = date('Y-m-d\TH:i:sP');
    $cNF    = str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);

    $make = new Make();

    $std = new stdClass();
    $std->versao = '4.00';
    $make->taginfNFe($std);

    // --- ide ---
    $cUFmap = ['AC'=>12,'AL'=>27,'AP'=>16,'AM'=>13,'BA'=>29,'CE'=>23,'DF'=>53,'ES'=>32,'GO'=>52,
        'MA'=>21,'MT'=>51,'MS'=>50,'MG'=>31,'PA'=>15,'PB'=>25,'PR'=>41,'PE'=>26,'PI'=>22,'RJ'=>33,
        'RN'=>24,'RS'=>43,'RO'=>11,'RR'=>14,'SC'=>42,'SP'=>35,'SE'=>28,'TO'=>17];
    $ufEmit  = $emit['uf'];
    $ufDest  = $dest['endereco']['uf'] ?? $ufEmit;

    $std = new stdClass();
    $std->cUF      = $cUFmap[$ufEmit] ?? 29;
    $std->cNF      = $cNF;
    $std->natOp    = $nota['natureza'] ?? 'VENDA DE MERCADORIA';
    $std->mod      = $modelo;
    $std->serie    = $serie;
    $std->nNF      = $numero;
    $std->dhEmi    = $dhEmi;
    // Devolução (finNFe=4) é nota de ENTRADA: a mercadoria volta ao emitente
    $std->tpNF     = $isDevolucao ? 0 : 1;                // 0=entrada 1=saída
    // NFC-e é sempre operação interna
    $std->idDest   = $isNFCe ? 1 : (($ufEmit === $ufDest) ? 1 : 2);
    $std->cMunFG   = (int)($emit['endereco']['codigo_municipio'] ?? 0);
    $std->tpImp    = $isNFCe ? 4 : 1;                     // 4=DANFE NFC-e; 1=DANFE retrato
    // Contingência offline da NFC-e (tpEmis=9): é o mecanismo que a própria
    // SEFAZ prevê para o caixa continuar vendendo sem internet. O cupom é
    // impresso na hora e transmitido em até 24h. Só vale para modelo 65 —
    // a NF-e 55 usa outros modos (SVC/EPEC), que não se aplicam ao varejo.
    $contingencia  = $isNFCe && !empty($nota['contingencia_offline']);
    $std->tpEmis   = $contingencia ? 9 : 1;
    if ($contingencia) {
        // dhCont é o momento em que a contingência começou e xJust o motivo;
        // sem os dois a SEFAZ rejeita o cupom na transmissão posterior.
        $std->dhCont = $nota['contingencia_desde'] ?? $dhEmi;
        $std->xJust  = mb_substr((string)($nota['contingencia_motivo']
            ?? 'Falha de conexao com a internet no ponto de venda'), 0, 256);
    }
    $std->tpAmb    = $tpAmb;
    $std->finNFe   = $finalidade;
    // NFC-e: sempre consumidor final e operação presencial
    $std->indFinal = $isNFCe ? 1 : (int)($nota['consumidor_final'] ?? 1);
    $std->indPres  = $isNFCe ? 1 : (int)($nota['presenca'] ?? 1);
    $std->procEmi  = 0;
    $std->verProc  = 'xlife-erp 1.0';
    $make->tagide($std);

    // Devolução referencia a NF-e original (obrigatório para a SEFAZ vincular)
    if ($isDevolucao) {
        $std = new stdClass();
        $std->refNFe = preg_replace('/\D/', '', (string)$nota['chave_referenciada']);
        if (strlen($std->refNFe) !== 44) {
            out(422, ['erro' => 'nota.chave_referenciada deve ter 44 dígitos']);
        }
        $make->tagrefNFe($std);
    }

    // --- emitente ---
    $std = new stdClass();
    $std->xNome = $emit['razao'];
    $std->xFant = $emit['fantasia'] ?? null;
    $std->IE    = preg_replace('/\D/', '', $emit['ie'] ?? '');
    $std->CRT   = (int)($emit['crt'] ?? 1);               // 1=Simples Nacional
    $std->CNPJ  = $cnpj;
    $make->tagemit($std);

    $e = $emit['endereco'];
    $std = new stdClass();
    $std->xLgr    = $e['logradouro'] ?? '';
    $std->nro     = $e['numero'] ?? 'S/N';
    $std->xBairro = $e['bairro'] ?? '';
    $std->cMun    = (int)($e['codigo_municipio'] ?? 0);
    $std->xMun    = $e['municipio'] ?? '';
    $std->UF      = $ufEmit;
    $std->CEP     = preg_replace('/\D/', '', $e['cep'] ?? '');
    $std->cPais   = 1058;
    $std->xPais   = 'BRASIL';
    $std->fone    = preg_replace('/\D/', '', $e['fone'] ?? '') ?: null;
    $make->tagenderEmit($std);

    // --- destinatário ---
    // Na NFC-e o destinatário é OPCIONAL: sem CPF/CNPJ a nota sai como
    // consumidor não identificado (o cupom continua válido).
    $docDest = preg_replace('/\D/', '', $dest['cpf_cnpj'] ?? '');
    $semDestinatario = $isNFCe && $docDest === '';

    if (!$semDestinatario) {
        $std = new stdClass();
        // Em homologação a SEFAZ exige esta razão social fixa:
        $std->xNome = $tpAmb === 2
            ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : ($dest['nome'] ?? 'CONSUMIDOR');
        if (strlen($docDest) === 14) {
            $std->CNPJ = $docDest;
            $std->indIEDest = (int)($dest['ind_ie'] ?? 9);
            if (!empty($dest['ie'])) { $std->IE = preg_replace('/\D/', '', $dest['ie']); $std->indIEDest = 1; }
        } elseif (strlen($docDest) === 11) {
            $std->CPF = $docDest;
            $std->indIEDest = 9;
        } else {
            out(422, ['erro' => 'destinatario.cpf_cnpj inválido (NF-e modelo 55 exige CPF ou CNPJ)']);
        }
        $make->tagdest($std);
    }

    // Endereço do destinatário não vai na NFC-e (só em entrega a domicílio)
    if (!$isNFCe && !empty($dest['endereco']['logradouro'])) {
        $d = $dest['endereco'];
        $std = new stdClass();
        $std->xLgr    = $d['logradouro'];
        $std->nro     = $d['numero'] ?? 'S/N';
        $std->xBairro = $d['bairro'] ?? '';
        $std->cMun    = (int)($d['codigo_municipio'] ?? 0);
        $std->xMun    = $d['municipio'] ?? '';
        $std->UF      = $ufDest;
        $std->CEP     = preg_replace('/\D/', '', $d['cep'] ?? '');
        $std->cPais   = 1058;
        $std->xPais   = 'BRASIL';
        $make->tagenderDest($std);
    }

    // --- itens ---
    $nItem = 0;
    foreach ($itens as $item) {
        $nItem++;
        $q  = (float)$item['quantidade'];
        $vu = (float)$item['valor_unitario'];
        $vProd = round($q * $vu, 2);

        $std = new stdClass();
        $std->item      = $nItem;
        $std->cProd     = (string)($item['codigo'] ?? $nItem);
        $std->cEAN      = !empty($item['ean']) ? preg_replace('/\D/', '', $item['ean']) : 'SEM GTIN';
        $std->xProd     = $tpAmb === 2 && $nItem === 1
            ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : mb_substr((string)$item['descricao'], 0, 120);
        $std->NCM       = preg_replace('/\D/', '', $item['ncm'] ?? '');
        if (!empty($item['cest'])) $std->CEST = preg_replace('/\D/', '', $item['cest']);
        $std->CFOP      = (string)($item['cfop'] ?? '5102');
        $std->uCom      = $item['unidade'] ?? 'UN';
        $std->qCom      = number_format($q, 4, '.', '');
        $std->vUnCom    = number_format($vu, 10, '.', '');
        $std->vProd     = number_format($vProd, 2, '.', '');
        $std->cEANTrib  = $std->cEAN;
        $std->uTrib     = $std->uCom;
        $std->qTrib     = $std->qCom;
        $std->vUnTrib   = $std->vUnCom;
        $std->indTot    = 1;
        $make->tagprod($std);

        if ($std->NCM === '') out(422, ['erro' => "item {$nItem}: NCM obrigatório (cadastre no produto)"]);

        $std = new stdClass();
        $std->item = $nItem;
        $make->tagimposto($std);

        // ICMS — Simples Nacional (CSOSN) ou regime normal (CST)
        $std = new stdClass();
        $std->item  = $nItem;
        $std->orig  = (int)($item['origem'] ?? 0);
        if ((int)($req['emitente']['crt'] ?? 1) === 3) {
            $std->CST = (string)($item['cst'] ?? '00');
            if ($std->CST === '00') {
                $std->modBC  = 3;
                $std->vBC    = number_format($vProd, 2, '.', '');
                $std->pICMS  = number_format((float)($item['aliquota_icms'] ?? 18), 4, '.', '');
                $std->vICMS  = number_format(round($vProd * (float)($item['aliquota_icms'] ?? 18) / 100, 2), 2, '.', '');
            }
            $make->tagICMS($std);
        } else {
            $std->CSOSN = (string)($item['csosn'] ?? '102');
            $make->tagICMSSN($std);
        }

        // PIS/COFINS — Simples Nacional: CST 49/99 (outras operações, sem destaque)
        $std = new stdClass();
        $std->item = $nItem;
        $std->CST  = '49';
        $std->qBCProd = null; $std->vAliqProd = null; $std->vPIS = null;
        $make->tagPIS($std);

        $std = new stdClass();
        $std->item = $nItem;
        $std->CST  = '49';
        $std->qBCProd = null; $std->vAliqProd = null; $std->vCOFINS = null;
        $make->tagCOFINS($std);
    }

    // --- totais (a lib soma sozinha quando o std vem vazio) ---
    $make->tagICMSTot(new stdClass());

    // --- transporte ---
    $std = new stdClass();
    $std->modFrete = (int)($req['frete']['modalidade'] ?? 9);   // 9 = sem frete
    $make->tagtransp($std);

    // --- pagamento ---
    $std = new stdClass();
    $make->tagpag($std);
    foreach (($req['pagamentos'] ?? [['forma' => '90', 'valor' => 0]]) as $pag) {
        $std = new stdClass();
        $std->tPag = str_pad((string)($pag['forma'] ?? '99'), 2, '0', STR_PAD_LEFT);
        $std->vPag = number_format((float)($pag['valor'] ?? 0), 2, '.', '');
        $make->tagdetPag($std);
    }

    if (!empty($nota['observacoes'])) {
        $std = new stdClass();
        $std->infCpl = mb_substr((string)$nota['observacoes'], 0, 2000);
        $make->taginfAdic($std);
    }

    try {
        $xml = $make->getXML();
    } catch (\Throwable $e) {
        out(422, ['erro' => 'falha ao montar XML', 'detalhes' => $make->getErrors() ?: [$e->getMessage()]]);
    }
    return $xml;
}

/** Extrai resposta padronizada do retorno da SEFAZ. */
function std(string $response): stdClass {
    return (new Standardize())->toStd($response);
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

try {
    // ---------- STATUS DO SERVIÇO SEFAZ ----------
    if ($path === '/v1/status' && $method === 'POST') {
        $req = body();
        $tools = makeTools($req);
        $st = std($tools->sefazStatus());
        out(200, [
            'online'   => (string)($st->cStat ?? '') === '107',
            'cstat'    => (string)($st->cStat ?? ''),
            'motivo'   => (string)($st->xMotivo ?? ''),
            'uf'       => $req['emitente']['uf'] ?? '',
            'ambiente' => (int)$req['ambiente'],
        ]);
    }

    // ---------- EMITIR ----------
    if ($path === '/v1/nfe/emitir' && $method === 'POST') {
        $req = body();
        $tools = makeTools($req);

        $xml = buildXml($req);
        $signed = $tools->signNFe($xml);

        // Envio síncrono (indSinc=1) — resposta já traz o protocolo
        $resp = $tools->sefazEnviaLote([$signed], (string)time(), 1);
        $st = std($resp);

        // Assíncrono em algumas UFs: consultar recibo
        if ((string)($st->cStat ?? '') === '103' && !empty($st->infRec->nRec)) {
            sleep(3);
            $resp = $tools->sefazConsultaRecibo((string)$st->infRec->nRec);
            $st = std($resp);
        }

        $prot  = $st->protNFe->infProt ?? $st;
        $cstat = (string)($prot->cStat ?? $st->cStat ?? '');
        $chave = (string)($prot->chNFe ?? '');

        if ($cstat === '100') {   // autorizada
            $xmlProtocolado = Complements::toAuthorize($signed, $resp);

            // DANFE (modelo 55) ou DANFE NFC-e / cupom (modelo 65)
            $danfeB64 = null;
            try {
                if ((int)($req['nota']['modelo'] ?? 55) === 65) {
                    $danfce = new Danfce($xmlProtocolado);
                    $danfeB64 = base64_encode($danfce->render());
                } else {
                    $danfe = new Danfe($xmlProtocolado);
                    $danfeB64 = base64_encode($danfe->render());
                }
            } catch (\Throwable $e) { /* DANFE é acessório — não falha a emissão */ }

            out(200, [
                'autorizada'      => true,
                'cstat'           => $cstat,
                'motivo'          => (string)($prot->xMotivo ?? ''),
                'chave'           => $chave,
                'protocolo'       => (string)($prot->nProt ?? ''),
                'data_autorizacao'=> (string)($prot->dhRecbto ?? ''),
                'xml_base64'      => base64_encode($xmlProtocolado),
                'danfe_pdf_base64'=> $danfeB64,
            ]);
        }

        out(200, [
            'autorizada' => false,
            'cstat'      => $cstat,
            'motivo'     => (string)($prot->xMotivo ?? $st->xMotivo ?? 'sem resposta da SEFAZ'),
            'chave'      => $chave,
            'xml_assinado_base64' => base64_encode($signed),
        ]);
    }

    // ---------- CANCELAR ----------
    if ($path === '/v1/nfe/cancelar' && $method === 'POST') {
        $req = body();
        foreach (['chave', 'protocolo', 'justificativa'] as $k) {
            if (empty($req[$k])) out(422, ['erro' => "campo obrigatório: {$k}"]);
        }
        if (mb_strlen($req['justificativa']) < 15) out(422, ['erro' => 'justificativa deve ter no mínimo 15 caracteres']);
        $tools = makeTools($req);
        $resp = $tools->sefazCancela($req['chave'], $req['justificativa'], $req['protocolo']);
        $st = std($resp);
        $ev = $st->retEvento->infEvento ?? $st;
        $cstat = (string)($ev->cStat ?? $st->cStat ?? '');
        out(200, [
            'cancelada'  => in_array($cstat, ['135', '155'], true),
            'cstat'      => $cstat,
            'motivo'     => (string)($ev->xMotivo ?? $st->xMotivo ?? ''),
            'protocolo'  => (string)($ev->nProt ?? ''),
        ]);
    }

    // ---------- CARTA DE CORREÇÃO ----------
    if ($path === '/v1/nfe/cce' && $method === 'POST') {
        $req = body();
        foreach (['chave', 'correcao'] as $k) {
            if (empty($req[$k])) out(422, ['erro' => "campo obrigatório: {$k}"]);
        }
        if (mb_strlen($req['correcao']) < 15) out(422, ['erro' => 'correção deve ter no mínimo 15 caracteres']);
        $tools = makeTools($req);
        $resp = $tools->sefazCCe($req['chave'], $req['correcao'], (int)($req['sequencia'] ?? 1));
        $st = std($resp);
        $ev = $st->retEvento->infEvento ?? $st;
        $cstat = (string)($ev->cStat ?? $st->cStat ?? '');
        out(200, [
            'registrada' => $cstat === '135',
            'cstat'      => $cstat,
            'motivo'     => (string)($ev->xMotivo ?? $st->xMotivo ?? ''),
            'protocolo'  => (string)($ev->nProt ?? ''),
        ]);
    }

    // ---------- INUTILIZAR NUMERAÇÃO ----------
    if ($path === '/v1/nfe/inutilizar' && $method === 'POST') {
        $req = body();
        foreach (['serie', 'numero_inicial', 'numero_final', 'justificativa'] as $k) {
            if (!isset($req[$k]) || $req[$k] === '') out(422, ['erro' => "campo obrigatório: {$k}"]);
        }
        $tools = makeTools($req);
        $resp = $tools->sefazInutiliza(
            (int)$req['serie'], (int)$req['numero_inicial'], (int)$req['numero_final'],
            (string)$req['justificativa']
        );
        $st = std($resp);
        $inf = $st->infInut ?? $st;
        $cstat = (string)($inf->cStat ?? $st->cStat ?? '');
        out(200, [
            'inutilizada' => $cstat === '102',
            'cstat'       => $cstat,
            'motivo'      => (string)($inf->xMotivo ?? $st->xMotivo ?? ''),
        ]);
    }

    // ---------- DISTRIBUIÇÃO DF-e ----------
    // A SEFAZ entrega TODA NF-e emitida CONTRA o nosso CNPJ, sem depender de
    // o fornecedor mandar o XML. Dois modos:
    //   - por NSU: varre o que há de novo desde o último NSU processado
    //   - por chave: baixa uma nota específica (a do DANFE em mãos)
    if ($path === '/v1/dfe/distribuicao' && $method === 'POST') {
        $req = body();
        $tools = makeTools($req);

        $chave  = preg_replace('/\D/', '', (string)($req['chave'] ?? ''));
        $ultNSU = (int)($req['ult_nsu'] ?? 0);

        try {
            $resp = $chave !== ''
                ? $tools->sefazDistDFe(0, 0, $chave)
                : $tools->sefazDistDFe($ultNSU);
        } catch (\Throwable $e) {
            out(200, ['ok' => false, 'motivo' => 'falha na distribuição', 'detalhe' => $e->getMessage()]);
        }

        $st = std($resp);
        $cstat = (string)($st->cStat ?? '');
        // 138 = documento(s) localizado(s); 137 = nenhum documento novo
        $docs = [];
        $lote = $st->loteDistDFeInt->docZip ?? null;
        if ($lote !== null) {
            $itens = is_array($lote) ? $lote : [$lote];
            foreach ($itens as $d) {
                // Cada docZip vem em base64 + gzip
                $conteudo = @gzdecode(base64_decode((string)($d->{'@value'} ?? $d), true) ?: '');
                if ($conteudo === false) continue;
                $docs[] = [
                    'nsu'    => (string)($d->{'@attributes'}->NSU ?? ''),
                    'schema' => (string)($d->{'@attributes'}->schema ?? ''),
                    'xml_base64' => base64_encode($conteudo),
                ];
            }
        }

        out(200, [
            'ok'          => in_array($cstat, ['137', '138'], true),
            'cstat'       => $cstat,
            'motivo'      => (string)($st->xMotivo ?? ''),
            'ult_nsu'     => (string)($st->ultNSU ?? ''),
            'max_nsu'     => (string)($st->maxNSU ?? ''),
            'documentos'  => $docs,
            'total'       => count($docs),
        ]);
    }

    // ---------- MANIFESTAÇÃO DO DESTINATÁRIO ----------
    // Sem manifestar, a distribuição só entrega o RESUMO da nota (cabeçalho e
    // valor) — os itens nunca chegam. A "ciência da operação" é o mínimo que
    // libera o XML completo; confirmação/desconhecimento/não realizada são
    // definitivos e alteram a relação comercial, então exigem decisão humana.
    //
    // O evento vai para o Ambiente Nacional (AN), não para a UF do emitente.
    if ($path === '/v1/dfe/manifestar' && $method === 'POST') {
        $req = body();
        $chave = preg_replace('/\D/', '', (string)($req['chave'] ?? ''));
        if (strlen($chave) !== 44) out(422, ['erro' => 'chave deve ter 44 dígitos']);

        $TIPOS = [
            'ciencia'        => 210210,
            'confirmacao'    => 210200,
            'desconhecimento'=> 210220,
            'nao_realizada'  => 210240,
        ];
        $tipo = (string)($req['tipo'] ?? 'ciencia');
        if (!isset($TIPOS[$tipo])) {
            out(422, ['erro' => 'tipo deve ser: ' . implode(', ', array_keys($TIPOS))]);
        }
        // Só "não realizada" carrega justificativa, e a SEFAZ a exige.
        $just = trim((string)($req['justificativa'] ?? ''));
        if ($tipo === 'nao_realizada' && mb_strlen($just) < 15) {
            out(422, ['erro' => 'justificativa de no mínimo 15 caracteres para "não realizada"']);
        }

        $tools = makeTools($req);
        try {
            $resp = $tools->sefazManifesta($chave, $TIPOS[$tipo], $just, (int)($req['sequencia'] ?? 1));
        } catch (\Throwable $e) {
            out(200, ['registrada' => false, 'motivo' => 'falha ao manifestar', 'detalhe' => $e->getMessage()]);
        }

        $st = std($resp);
        $ev = $st->retEvento->infEvento ?? $st;
        $cstat = (string)($ev->cStat ?? $st->cStat ?? '');
        // 135 = evento registrado; 573 = evento já registrado antes (idempotente)
        out(200, [
            'registrada' => in_array($cstat, ['135', '136'], true),
            'ja_existia' => $cstat === '573',
            'cstat'      => $cstat,
            'motivo'     => (string)($ev->xMotivo ?? $st->xMotivo ?? ''),
            'protocolo'  => (string)($ev->nProt ?? ''),
        ]);
    }

    // ---------- CONSULTA CADASTRO NA SEFAZ ----------
    // Puxa Inscrição Estadual, razão social e situação cadastral do CNPJ
    // direto no cadastro da SEFAZ, usando o certificado da empresa.
    // Nem toda UF oferece este serviço.
    if ($path === '/v1/cadastro/consultar' && $method === 'POST') {
        $req = body();
        $uf   = strtoupper((string)($req['uf'] ?? ($req['emitente']['uf'] ?? '')));
        $cnpj = preg_replace('/\D/', '', (string)($req['cnpj'] ?? ''));
        if ($uf === '' || $cnpj === '') out(422, ['erro' => 'uf e cnpj são obrigatórios']);

        $tools = makeTools($req);
        try {
            $resp = $tools->sefazCadastro($uf, $cnpj);
        } catch (\Throwable $e) {
            out(200, [
                'encontrado' => false,
                'suportado'  => false,
                'motivo'     => 'UF não oferece consulta de cadastro ou serviço indisponível',
                'detalhe'    => $e->getMessage(),
            ]);
        }

        $st  = std($resp);
        $inf = $st->infCons ?? $st;
        $cstat = (string)($inf->cStat ?? $st->cStat ?? '');

        // 111/112 = consulta com uma ou mais ocorrências
        $achou = in_array($cstat, ['111', '112'], true);
        $ie = null; $nome = null; $situacao = null; $cnae = null; $regime = null;
        $endereco = null;
        if ($achou) {
            $ext = $inf->infCad ?? null;
            if (is_array($ext)) $ext = $ext[0] ?? null;   // múltiplas inscrições: pega a primeira
            if ($ext) {
                $ie       = isset($ext->IE)     ? (string)$ext->IE     : null;
                $nome     = isset($ext->xNome)  ? (string)$ext->xNome  : null;
                $situacao = isset($ext->cSit)   ? (string)$ext->cSit   : null;  // 1=habilitado
                $cnae     = isset($ext->CNAE)   ? (string)$ext->CNAE   : null;
                $regime   = isset($ext->CRT)    ? (string)$ext->CRT    : null;

                // O endereço do cadastro da SEFAZ é a fonte autoritativa do
                // endereço do EMITENTE — o mesmo que vai no XML de toda NF-e.
                // Digitado à mão ele diverge em silêncio; aqui não.
                $end = $ext->ender ?? null;
                if ($end) {
                    $endereco = [
                        'logradouro'  => isset($end->xLgr)     ? (string)$end->xLgr     : null,
                        'numero'      => isset($end->nro)      ? (string)$end->nro      : null,
                        'complemento' => isset($end->xCpl)     ? (string)$end->xCpl     : null,
                        'bairro'      => isset($end->xBairro)  ? (string)$end->xBairro  : null,
                        'municipio'   => isset($end->xMun)     ? (string)$end->xMun     : null,
                        'codigo_municipio' => isset($end->cMun) ? (string)$end->cMun    : null,
                        'cep'         => isset($end->CEP)      ? (string)$end->CEP      : null,
                        'uf'          => $uf,
                    ];
                }
            }
        }

        out(200, [
            'encontrado'      => $achou && $ie !== null,
            'suportado'       => true,
            'cstat'           => $cstat,
            'motivo'          => (string)($inf->xMotivo ?? $st->xMotivo ?? ''),
            'ie'              => $ie,
            'razao_social'    => $nome,
            'situacao'        => $situacao,
            'habilitado'      => $situacao === '1',
            'cnae'            => $cnae,
            'regime_tributario' => $regime,
            'endereco'        => $endereco,
        ]);
    }

    // ---------- VALIDAR CERTIFICADO A1 ----------
    // Confere de verdade se o .pfx abre com a senha informada e devolve os
    // dados do titular. É o que a tela de certificado usa antes de cadastrar.
    if ($path === '/v1/certificado/validar' && $method === 'POST') {
        $req = body();
        if (empty($req['pfx_base64']) || !isset($req['senha'])) {
            out(422, ['erro' => 'pfx_base64 e senha são obrigatórios']);
        }
        $pfx = base64_decode($req['pfx_base64'], true);
        if ($pfx === false) out(422, ['erro' => 'pfx_base64 inválido']);

        try {
            $certificate = Certificate::readPfx($pfx, (string)$req['senha']);
        } catch (\Throwable $e) {
            out(200, [
                'valido' => false,
                'motivo' => 'certificado inválido ou senha incorreta',
                'detalhe' => $e->getMessage(),
            ]);
        }

        $validoAte = null; $validoDe = null; $titular = null; $cnpj = null;
        try { $validoDe  = $certificate->getValidFrom()?->format('Y-m-d H:i:s'); } catch (\Throwable $e) {}
        try { $validoAte = $certificate->getValidTo()?->format('Y-m-d H:i:s'); }  catch (\Throwable $e) {}
        try { $titular   = $certificate->getCompanyName(); }                      catch (\Throwable $e) {}
        try { $cnpj      = $certificate->getCnpj(); }                             catch (\Throwable $e) {}

        $expirado = false;
        try { $expirado = $certificate->isExpired(); } catch (\Throwable $e) {}

        out(200, [
            'valido'     => !$expirado,
            'expirado'   => $expirado,
            'motivo'     => $expirado ? 'certificado expirado' : 'certificado válido',
            'titular'    => $titular,
            'cnpj'       => $cnpj,
            'valido_de'  => $validoDe,
            'valido_ate' => $validoAte,
        ]);
    }

    // ---------- DANFE a partir de XML autorizado ----------
    if ($path === '/v1/danfe' && $method === 'POST') {
        $req = body();
        if (empty($req['xml_base64'])) out(422, ['erro' => 'xml_base64 obrigatório']);
        $xml = base64_decode($req['xml_base64'], true);
        if ($xml === false) out(422, ['erro' => 'xml_base64 inválido']);
        // NFC-e (65) usa o cupom (Danfce); NF-e (55) usa o DANFE retrato.
        // Renderizar cupom com o layout de folha A4 sai "válido" e ilegível
        // no leitor de bobina — o modelo decide o renderizador.
        $modelo = (int)($req['modelo'] ?? 55);
        try {
            $da = $modelo === 65 ? new Danfce($xml) : new Danfe($xml);
            out(200, ['danfe_pdf_base64' => base64_encode($da->render())]);
        } catch (\Throwable $e) {
            out(422, ['erro' => 'falha ao renderizar', 'detalhe' => $e->getMessage()]);
        }
    }

    out(404, ['erro' => 'rota não encontrada', 'rotas' => [
        'GET /healthz', 'POST /v1/status', 'POST /v1/nfe/emitir', 'POST /v1/nfe/cancelar',
        'POST /v1/nfe/cce', 'POST /v1/nfe/inutilizar', 'POST /v1/certificado/validar',
        'POST /v1/cadastro/consultar', 'POST /v1/danfe',
    ]]);
} catch (\Throwable $e) {
    out(500, ['erro' => 'falha interna', 'detalhe' => $e->getMessage()]);
}
