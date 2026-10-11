// ============================================================================
// Edge Function: erp-emitir-nfe
// Orquestra a emissão REAL de NF-e via microserviço nfe-service (sped-nfe).
//
// Body: { venda_id?: string, remessa_id?: string, loja_id: string, tipo?: 'nfe'|'nfce' }
//   - venda_id   → NF-e de venda (destinatário = cliente da venda)
//   - remessa_id → NF-e de remessa entre filiais (CFOP 5152/6152)
//   - tipo:'nfce' → cupom do varejo presencial (modelo 65): consumidor
//     opcional, sempre operação interna. O QR Code é injetado pela lib na
//     versão vigente da UF (v3 em homologação, sem CSC; v2 em produção).
//
// Fluxo: valida usuário ERP → valida pré-requisitos (cert, SEFAZ, NCM) →
// monta payload → chama nfe-service → grava resultado real em erp_notas_fiscais
// + XML/DANFE no bucket `fiscal`.
//
// Credenciais do serviço: public.integrations (provider = 'nfe_service').
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ratear, ratearValoresDaVenda, totalDaNota, faltaParaEntregaNfce } from "./rateio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * CST do ICMS (regime normal) e PIS/COFINS do cadastro do produto (item 8,
 * 10/10/2026). A alíquota só vai junto com um CST escolhido: produto sem CST
 * continua saindo como antes (49 sem destaque no Simples).
 */
function outrosTributos(p: any) {
  const num = (v: any) => (v != null && v !== "" ? Number(v) : undefined);
  return {
    ...(p?.cst_icms ? { cst: String(p.cst_icms) } : {}),
    ...(p?.cst_pis ? { cst_pis: String(p.cst_pis), aliquota_pis: num(p.pis) } : {}),
    ...(p?.cst_cofins ? { cst_cofins: String(p.cst_cofins), aliquota_cofins: num(p.cofins) } : {}),
  };
}

const FORMA_PAG_MAP: Record<string, string> = {
  dinheiro: "01", cheque: "02", cartao_credito: "03", cartao_debito: "04",
  crediario: "05", boleto: "15", pix: "17", transferencia: "18", promissoria: "99",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "método não suportado" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "erp" } },
  );
  const adminPublic = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ---------------- 1. Autenticação: usuário precisa existir no ERP ----------------
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
    if (userErr || !userData?.user) return json(401, { erro: "não autenticado" });

    const { data: erpUser } = await admin
      .from("erp_usuarios").select("id, role, ativo").eq("id", userData.user.id).maybeSingle();
    if (!erpUser?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
    if (!["admin", "gerente"].includes(erpUser.role)) {
      return json(403, { erro: "sem permissão para emitir NF-e (requer admin/gerente)" });
    }

    const { venda_id, remessa_id, loja_id, tipo, devolucao_de, devolucao_fornecedor_id, espelho } = await req.json();
    // espelho: monta e valida a nota (dry-run) e devolve o DANFE de
    // pré-visualização, sem enviar à SEFAZ, sem gastar número e sem gravar
    const ehEspelho = espelho === true;
    const isDevolFornecedor = !!devolucao_fornecedor_id;
    if (!loja_id || (!venda_id && !remessa_id && !devolucao_de && !devolucao_fornecedor_id)) {
      return json(422, { erro: "informe loja_id e venda_id, remessa_id OU devolucao_de" });
    }

    // Devolução: NF-e de ENTRADA (finNFe=4) referenciando a nota original.
    const isDevolucao = !!devolucao_de;
    // campos extras da nota (devolução: saída/entrada, schema PL_010, etc.)
    let notaExtra: Record<string, unknown> = {};

    // NFC-e (modelo 65) é o cupom do varejo presencial: só para venda.
    const tipoDoc: "nfe" | "nfce" = tipo === "nfce" ? "nfce" : "nfe";
    const isNFCe = tipoDoc === "nfce";
    const modelo = isNFCe ? 65 : 55;
    const rotulo = isNFCe ? "NFC-e" : "NF-e";
    if (isNFCe && remessa_id) {
      return json(422, { erro: "remessa não pode ser emitida como NFC-e — use NF-e modelo 55" });
    }
    if (isNFCe && isDevolFornecedor) {
      return json(422, { erro: "devolução a fornecedor exige NF-e modelo 55" });
    }
    if (isNFCe && isDevolucao) {
      return json(422, { erro: "devolução exige NF-e modelo 55 (NFC-e não comporta finalidade 4)" });
    }

    // ---------------- 1b. Idempotência: bloquear emissão duplicada ----------------
    const STATUS_VIGENTES = ["autorizada", "pendente", "processando", "pendente_transmissao"];
    if (venda_id && !isDevolucao) {
      const { data: notaExistente } = await admin
        .from("erp_notas_fiscais")
        .select("id, numero, status, tipo")
        .eq("venda_id", venda_id)
        .eq("tipo", tipoDoc)
        .in("status", STATUS_VIGENTES)
        .limit(1)
        .maybeSingle();
      if (notaExistente) {
        return json(409, {
          erro: `esta venda já possui ${rotulo} nº ${notaExistente.numero} (status: ${notaExistente.status})`,
          nfe_id: notaExistente.id,
        });
      }
    }
    if (remessa_id) {
      const { data: remessaCheck } = await admin
        .from("erp_remessas")
        .select("id, status, nfe_remessa_id")
        .eq("id", remessa_id)
        .maybeSingle();
      if (!remessaCheck) return json(422, { erro: "remessa não encontrada" });
      if (["nf_emitida", "em_transito", "recebida", "cancelada"].includes(remessaCheck.status)) {
        return json(409, {
          erro: `remessa com status "${remessaCheck.status}" não permite nova emissão de NF-e`,
        });
      }
      if (remessaCheck.nfe_remessa_id) {
        const { data: notaRemessa } = await admin
          .from("erp_notas_fiscais")
          .select("id, numero, status")
          .eq("id", remessaCheck.nfe_remessa_id)
          .maybeSingle();
        if (notaRemessa && STATUS_VIGENTES.includes(notaRemessa.status)) {
          return json(409, {
            erro: `esta remessa já possui NF-e nº ${notaRemessa.numero} (status: ${notaRemessa.status})`,
            nfe_id: notaRemessa.id,
          });
        }
      }
    }

    // ---------------- 2. Pré-requisitos da loja ----------------
    const { data: loja } = await admin.from("erp_lojas").select("*").eq("id", loja_id).single();
    if (!loja) return json(422, { erro: "loja não encontrada" });

    const faltas: string[] = [];
    if (!loja.cnpj) faltas.push("CNPJ da loja");
    if (!loja.inscricao_estadual) faltas.push("Inscrição Estadual da loja");
    if (!loja.codigo_municipio_ibge) faltas.push("código IBGE do município da loja");
    if (!loja.logradouro || !loja.cidade || !loja.uf || !loja.cep) faltas.push("endereço completo da loja");

    const { data: sefaz } = await admin
      .from("erp_configuracoes_sefaz").select("*").eq("loja_id", loja_id).maybeSingle();
    if (!sefaz) faltas.push("configuração SEFAZ da loja");

    const { data: cert } = await admin
      .from("erp_certificados_digitais").select("*")
      .eq("loja_id", loja_id).eq("ativo", true)
      .order("data_validade", { ascending: false }).limit(1).maybeSingle();
    if (!cert) faltas.push("certificado digital A1 ativo");
    else if (new Date(cert.data_validade) < new Date()) faltas.push(`certificado vencido em ${cert.data_validade}`);

    // CSC: exigido onde o QR Code ainda é v2 — hoje, produção. Em
    // homologação BA/PE o QR v3 assina com o certificado e dispensa CSC,
    // então dá para exercitar a emissão ANTES de ter o CSC cadastrado.
    // (Quando produção migrar para o v3, esta exigência cai também.)
    if (isNFCe && sefaz && sefaz.ambiente === "producao" && (!sefaz.csc_token || !sefaz.csc_id)) {
      faltas.push("CSC e CSC id da NFC-e (obtidos no portal da SEFAZ e cadastrados em Configurações SEFAZ)");
    }

    if (faltas.length > 0) return json(422, { erro: "pré-requisitos ausentes", faltas });

    // ---------------- 3. Certificado: arquivo + senha ----------------
    const { data: pfxFile, error: pfxErr } = await adminPublic.storage
      .from("certificados").download(cert.arquivo_path);
    if (pfxErr || !pfxFile) return json(422, { erro: `falha ao baixar certificado: ${pfxErr?.message}` });
    const pfxB64 = btoa(String.fromCharCode(...new Uint8Array(await pfxFile.arrayBuffer())));

    let senha = cert.senha_armazenada ?? "";
    if (cert.senha_armazenada_cripto) {
      const { data: senhaDec, error: decErr } = await admin
        .rpc("descriptografar_senha_cert", { crypto_data: cert.senha_armazenada_cripto });
      if (decErr) return json(422, { erro: `falha ao decriptar senha do certificado: ${decErr.message}` });
      senha = senhaDec;
    }
    if (!senha) return json(422, { erro: "certificado sem senha armazenada" });

    // ---------------- 4. Montar itens + destinatário ----------------
    let itens: any[] = [];
    let destinatario: any = null;
    let natureza = "VENDA DE MERCADORIA";
    let cfopPadrao = "5102";
    let pagamentos: any[] = [];
    let observacoes = "";
    let totalNota = 0;
    // Entrega da venda (taxa_entrega > 0): NFC-e com endereço vira "entrega a
    // domicílio" (indPres=4) com frete; NF-e leva o frete com a modalidade.
    let presenca: number | undefined;
    let frete: { modalidade: number; [k: string]: unknown } | undefined;
    // Preenchido quando a venda veio da fila offline: a emissão é posterior
    // ao fato e a SEFAZ exige o momento em que a contingência começou.
    let contingenciaDesde: string | null = null;

    let chaveReferenciada: string | null = null;
    let notaOriginalId: string | null = null;
    // devolução a fornecedor pode sair como "nota normal" (finalidade 1),
    // como no Excellent; o resto é sempre 4 na devolução e 1 na venda
    let finalidadeNota = isDevolucao || isDevolFornecedor ? 4 : 1;
    // endereço de entrega diferente do destinatário (tag entrega)
    let entrega: Record<string, unknown> | undefined;

    if (isDevolucao) {
      // Devolução de venda: mesma mercadoria volta, com CFOP de entrada.
      const { data: original } = await admin
        .from("erp_notas_fiscais")
        .select("*, venda:erp_vendas(*, cliente:erp_pessoas(*), itens:erp_venda_itens(*, produto:erp_produtos(*)))")
        .eq("id", devolucao_de).maybeSingle();
      if (!original) return json(422, { erro: "nota original não encontrada" });
      if (original.status !== "autorizada") {
        return json(422, { erro: `nota original com status "${original.status}" — só nota autorizada pode ser devolvida` });
      }
      if (!original.chave_acesso) return json(422, { erro: "nota original sem chave de acesso" });

      const { data: devolucaoExistente } = await admin
        .from("erp_notas_fiscais").select("id, numero, status")
        .eq("nota_referenciada_id", devolucao_de)
        .in("status", STATUS_VIGENTES).limit(1).maybeSingle();
      if (devolucaoExistente) {
        return json(409, {
          erro: `esta nota já possui devolução nº ${devolucaoExistente.numero} (status: ${devolucaoExistente.status})`,
          nfe_id: devolucaoExistente.id,
        });
      }

      const vendaOrig = original.venda;
      if (!vendaOrig) return json(422, { erro: "nota original sem venda vinculada — devolução automática indisponível" });

      chaveReferenciada = original.chave_acesso;
      notaOriginalId = original.id;
      natureza = "DEVOLUCAO DE VENDA";
      observacoes = `Devolução da NF-e ${original.numero}/${original.serie} — chave ${original.chave_acesso}`;

      const ufCliente = vendaOrig.cliente?.endereco?.uf ?? loja.uf;
      const interestadualDev = ufCliente !== loja.uf;
      // Entrada de devolução de venda: 1202 (interna) / 2202 (interestadual)
      const cfopDev = interestadualDev ? "2202" : "1202";

      destinatario = {
        cpf_cnpj: vendaOrig.cliente?.cpf_cnpj,
        nome: vendaOrig.cliente?.nome_razao,
        endereco: vendaOrig.cliente?.endereco ?? {},
      };
      if (!destinatario.cpf_cnpj) {
        return json(422, { erro: "venda original sem cliente identificado — devolução exige CPF/CNPJ" });
      }

      itens = (vendaOrig.itens ?? []).filter((i: any) => i.produto_id).map((i: any) => ({
        codigo: i.produto?.sku ?? i.produto_id,
        descricao: i.produto?.nome ?? i.nome,
        ean: i.produto?.codigo_barras,
        ncm: i.produto?.ncm,
        cest: i.produto?.cest,
        cfop: cfopDev,
        csosn: i.produto?.csosn ?? "102",
        // tributos do cadastro (etapa 6, 10/10/2026): antes a nota saía sempre
        // com origem 0 e um CSOSN 101 não levava o crédito que o schema exige
        origem: Number(i.produto?.origem_mercadoria ?? 0),
        aliquota_icms: i.produto?.icms != null ? Number(i.produto.icms) : undefined,
        aliquota_credito_sn: i.produto?.aliquota_credito_sn != null ? Number(i.produto.aliquota_credito_sn) : undefined,
        ...outrosTributos(i.produto),
        unidade: i.produto?.unidade ?? "UN",
        quantidade: Number(i.quantidade),
        valor_unitario: Number(i.preco_unitario ?? i.preco ?? 0),
      }));
      totalNota = Number(original.valor_total ?? vendaOrig.total ?? 0);
      pagamentos = [{ forma: "90", valor: 0 }];

      // NT 2025.002 (VC02-14): devolução referencia a nota original POR ITEM
      // (DFeReferenciado: chave + nItem NELA). O nItem sai do próprio XML
      // autorizado, casando pelo código do produto — a ordem dos itens no
      // banco não é garantida. Sem o XML, fica o refNFe do cabeçalho (legado).
      if (original.xml_path) {
        const { data: arq } = await adminPublic.storage.from("fiscal").download(original.xml_path);
        const xmlOrig = arq ? await arq.text() : "";
        const mapa = new Map<string, number>();
        for (const m of xmlOrig.matchAll(/<det nItem="(\d+)">[\s\S]*?<cProd>([^<]*)<\/cProd>/g)) mapa.set(m[2], Number(m[1]));
        if (mapa.size && itens.every((i: any) => mapa.has(String(i.codigo)))) {
          itens = itens.map((i: any) => ({ ...i, dfe_referenciado: { chave: chaveReferenciada, n_item: mapa.get(String(i.codigo)) } }));
          notaExtra = { ...notaExtra, schema: "PL_010_V1.30" };
        }
      }
    } else if (isDevolFornecedor) {
      // ---- Devolução a fornecedor: NF-e de SAÍDA, finalidade 4 ----
      const { data: dev, error: errDev } = await admin.from("erp_devolucoes_fornecedor")
        .select("*, itens:erp_devolucao_fornecedor_itens(*, produto:erp_produtos(sku, codigo_barras, ncm, cest, unidade, cst_icms, cst_pis, cst_cofins, pis, cofins)), fornecedor:erp_pessoas!erp_devolucoes_fornecedor_fornecedor_id_fkey(*), transportadora:erp_pessoas!erp_devolucoes_fornecedor_transportadora_id_fkey(*)")
        .eq("id", devolucao_fornecedor_id).maybeSingle();
      // erro de consulta (GRANT, embed) não é "não encontrada" — mostra o motivo
      if (errDev) return json(500, { erro: `não foi possível ler a devolução: ${errDev.message}` });
      if (!dev) return json(422, { erro: "devolução não encontrada" });
      if (dev.loja_id !== loja_id) return json(422, { erro: "a devolução é de outra loja" });
      if (!ehEspelho && dev.status !== "confirmada") {
        return json(422, { erro: dev.status === "faturada" ? "esta devolução já tem nota" : "confirme a devolução (baixa do estoque) antes de emitir a nota" });
      }
      const f = dev.fornecedor ?? {};
      const endF = f.endereco ?? {};
      const docF = String(f.cpf_cnpj ?? "").replace(/\D/g, "");
      const itensDev = dev.itens ?? [];
      finalidadeNota = Number(dev.finalidade) === 1 ? 1 : 4;
      const soDig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
      // cada item diz de qual nota de entrada veio (várias notas, como o
      // "Adicionar outro DANFE" do Excellent); devoluções antigas têm só a
      // chave do cabeçalho
      const chaveDoItem = (i: any) => soDig(i.chave_nota_origem) || soDig(dev.chave_nota_origem);
      const faltas: string[] = [];
      if (docF.length !== 14 && docF.length !== 11) faltas.push("CNPJ do fornecedor");
      if (!endF.logradouro || !(endF.cidade || endF.municipio) || !(endF.uf || f.uf)) faltas.push("endereço do fornecedor");
      if (finalidadeNota === 4) {
        const chaves = new Set<string>();
        for (const i of itensDev) {
          const c = chaveDoItem(i);
          if (c.length !== 44) faltas.push(`nota de entrada (chave de 44 dígitos) de "${i.nome}"`);
          else chaves.add(c);
          // o leiaute aceita sem, mas a SEFAZ recusa (1048) — visto em 11/10
          if (!(Number(i.item_nota_origem) > 0)) faltas.push(`nº do item na nota de entrada de "${i.nome}"`);
        }
        // A chave traz o CNPJ de quem emitiu a compra (posições 7–20). A
        // SEFAZ exige o CNPJ inteiro igual ao do destinatário (1194, visto em
        // 10/10 e de novo em 11/10 com outra filial do mesmo fornecedor).
        for (const c of chaves) {
          if (docF && c.slice(6, 20) !== docF.padStart(14, "0")) faltas.push(`a nota ${c.slice(25, 34)} foi emitida por outro CNPJ: a devolução vai para quem emitiu a nota de compra`);
        }
      }
      if (faltas.length) return json(422, { erro: "faltam dados para a nota de devolução", faltas });

      natureza = String(dev.natureza_operacao ?? "").trim().toUpperCase() || "DEVOLUCAO DE COMPRA PARA COMERCIALIZACAO";
      destinatario = {
        cpf_cnpj: docF, nome: f.nome_razao, ie: f.inscricao_estadual ?? undefined,
        endereco: {
          logradouro: endF.logradouro, numero: endF.numero ?? "S/N", bairro: endF.bairro ?? "",
          municipio: endF.cidade ?? endF.municipio, uf: endF.uf ?? f.uf, cep: endF.cep,
          codigo_municipio: f.codigo_municipio_ibge ?? endF.codigo_municipio ?? endF.codigo_ibge,
        },
      };
      // Frete, seguro e outras despesas: "rateado igualmente entre os
      // produtos" (padrão do Excellent) ou informados por produto.
      const iguais = itensDev.map(() => 1);
      const porProduto = dev.rateio_frete === "por_produto";
      const fretes = porProduto ? itensDev.map((i: any) => Number(i.valor_frete) || 0) : ratear(Number(dev.valor_frete) || 0, iguais);
      const outros = porProduto ? itensDev.map((i: any) => Number(i.outras_despesas) || 0) : ratear(Number(dev.outras_despesas) || 0, iguais);
      const seguros = ratear(Number(dev.valor_seguro) || 0, iguais);
      itens = itensDev.map((i: any, k: number) => ({
        codigo: i.produto?.sku ?? i.produto_id ?? `ITEM${k + 1}`,
        descricao: i.nome, ean: i.codigo_ean ?? i.produto?.codigo_barras, ncm: i.ncm ?? i.produto?.ncm,
        cest: i.produto?.cest, cfop: i.cfop, unidade: i.unidade ?? i.produto?.unidade ?? "UN",
        quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario),
        ...(Number(i.valor_desconto) > 0 ? { valor_desconto: Number(i.valor_desconto) } : {}),
        ...(fretes[k] > 0 ? { valor_frete: fretes[k] } : {}),
        ...(seguros[k] > 0 ? { valor_seguro: seguros[k] } : {}),
        ...(outros[k] > 0 ? { valor_outro: outros[k] } : {}),
        origem: Number(i.icms_origem ?? 0), csosn: i.icms_csosn ?? "102",
        ...outrosTributos(i.produto),
        // regime normal: o destaque da tela de tributação (CSOSN 900) é o CST 90
        ...(i.icms_csosn === "900" ? { cst: "90" } : {}),
        ...(i.icms_csosn === "900" && Number(i.icms_aliquota) > 0
          ? { aliquota_icms: Number(i.icms_aliquota), valor_bc: Number(i.icms_base) || undefined, valor_icms: Number(i.icms_valor) || undefined }
          : {}),
        // IPI que veio na compra e volta na devolução (impostoDevol)
        ...(Number(i.ipi_devolvido_valor) > 0
          ? { ipi_devolvido: { percentual: Number(i.ipi_devolvido_percentual) || 100, valor: Number(i.ipi_devolvido_valor) } }
          : {}),
        ...(finalidadeNota === 4
          ? { dfe_referenciado: { chave: chaveDoItem(i), n_item: Number(i.item_nota_origem) } }
          : {}),
      }));
      const soma = (xs: number[]) => xs.reduce((a, b) => a + (Number(b) || 0), 0);
      totalNota = Math.round((soma(itensDev.map((i: any) => Number(i.valor_total)))
        - soma(itensDev.map((i: any) => Number(i.valor_desconto)))
        + soma(fretes) + soma(seguros) + soma(outros)
        + soma(itensDev.map((i: any) => Number(i.ipi_devolvido_valor)))) * 100) / 100;
      pagamentos = [{ forma: "90", valor: 0 }];
      const tr = dev.transportadora;
      frete = {
        modalidade: Number(dev.modalidade_frete ?? 9),
        ...(tr ? { transportadora: { cpf_cnpj: tr.cpf_cnpj, nome: tr.nome_razao, ie: tr.inscricao_estadual,
          endereco: [tr.endereco?.logradouro, tr.endereco?.numero].filter(Boolean).join(", "),
          municipio: tr.endereco?.cidade ?? tr.endereco?.municipio, uf: tr.endereco?.uf ?? tr.uf } } : {}),
        ...(dev.placa_veiculo ? { veiculo: { placa: dev.placa_veiculo, uf: loja.uf, rntc: dev.rntc ?? undefined } } : {}),
        volumes: { quantidade: dev.volumes_qtd, especie: dev.volumes_especie, peso_liquido: dev.peso_liquido, peso_bruto: dev.peso_bruto },
      } as any;
      const e = dev.entrega;
      if (e?.logradouro && e?.uf) {
        entrega = {
          cpf_cnpj: docF, nome: f.nome_razao, logradouro: e.logradouro, numero: e.numero || "S/N", complemento: e.complemento,
          bairro: e.bairro || "", municipio: e.cidade, codigo_municipio: e.codigo_municipio, uf: e.uf, cep: e.cep,
        };
      }
      notaExtra = { tipo_operacao: "saida", schema: "PL_010_V1.30", consumidor_final: 0, presenca: 0 };
      const numeros = [...new Set(itensDev.map((i: any) => chaveDoItem(i)).filter((c: string) => c.length === 44)
        .map((c: string) => String(Number(c.slice(25, 34)))))];
      observacoes = [
        dev.observacoes || (dev.motivo ? `Devolucao: ${dev.motivo}` : null),
        finalidadeNota === 4 && numeros.length ? `Ref. NF-e ${numeros.join(", ")}` : null,
      ].filter(Boolean).join(" | ");
    } else if (remessa_id) {
      const { data: remessa } = await admin
        .from("erp_remessas")
        .select("*, origem:erp_lojas!loja_origem_id(*), destino:erp_lojas!loja_destino_id(*), itens:erp_remessa_itens(*, produto:erp_produtos(*))")
        .eq("id", remessa_id).single();
      if (!remessa) return json(422, { erro: "remessa não encontrada" });

      const mesmaUF = remessa.origem.uf === remessa.destino.uf;
      cfopPadrao = mesmaUF ? "5152" : "6152";
      natureza = "REMESSA ENTRE ESTABELECIMENTOS";
      observacoes = `Remessa para filial ${remessa.destino.apelido}`;
      destinatario = {
        cpf_cnpj: remessa.destino.cnpj,
        nome: remessa.destino.nome,
        ie: remessa.destino.inscricao_estadual,
        endereco: {
          logradouro: remessa.destino.logradouro, numero: remessa.destino.numero,
          bairro: remessa.destino.bairro, municipio: remessa.destino.cidade,
          uf: remessa.destino.uf, cep: remessa.destino.cep,
          codigo_municipio: remessa.destino.codigo_municipio_ibge,
        },
      };
      itens = (remessa.itens ?? []).map((i: any) => ({
        codigo: i.produto?.sku ?? i.produto_id,
        descricao: i.produto?.nome ?? "PRODUTO",
        ean: i.produto?.codigo_barras,
        ncm: i.produto?.ncm,
        cest: i.produto?.cest,
        cfop: cfopPadrao,
        csosn: "400", // remessa: não tributada
        unidade: i.produto?.unidade ?? "UN",
        quantidade: Number(i.quantidade),
        valor_unitario: Number(i.produto?.preco_custo ?? 0),
      }));
      totalNota = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      pagamentos = [{ forma: "90", valor: 0 }]; // 90 = sem pagamento
    } else {
      const { data: venda } = await admin
        .from("erp_vendas")
        .select("*, cliente:erp_pessoas(*), itens:erp_venda_itens(*, produto:erp_produtos(*))")
        .eq("id", venda_id).single();
      if (!venda) return json(422, { erro: "venda não encontrada" });
      if (venda.status !== "finalizada") return json(422, { erro: `venda com status "${venda.status}" — só vendas finalizadas geram ${rotulo}` });
      if (venda.origem_offline) {
        contingenciaDesde = venda.criada_em_local ?? venda.data_venda ?? null;
      }

      if (isNFCe) {
        // NFC-e: consumidor é opcional. Cliente cadastrado vai identificado;
        // sem cadastro, vale o "CPF na nota" digitado no balcão; sem nenhum
        // dos dois, sai como consumidor não identificado — nunca com endereço.
        destinatario = venda.cliente?.cpf_cnpj
          ? { cpf_cnpj: venda.cliente.cpf_cnpj, nome: venda.cliente.nome_razao }
          : venda.consumidor_cpf
            ? { cpf_cnpj: venda.consumidor_cpf, nome: venda.consumidor_nome ?? undefined }
            : {};
      } else {
        if (!venda.cliente?.cpf_cnpj) {
          return json(422, { erro: "venda sem cliente identificado com CPF/CNPJ (NF-e modelo 55 exige destinatário)" });
        }

        // Endereço do destinatário é obrigatório na NF-e de venda
        const endCliente = venda.cliente.endereco ?? {};
        const faltasEndereco: string[] = [];
        if (!endCliente.logradouro) faltasEndereco.push("logradouro");
        if (!(endCliente.cidade || endCliente.municipio)) faltasEndereco.push("município");
        if (!endCliente.uf) faltasEndereco.push("UF");
        if (faltasEndereco.length > 0) {
          return json(422, {
            erro: `endereço do cliente incompleto para emissão de NF-e — cadastre: ${faltasEndereco.join(", ")}`,
            faltas: faltasEndereco,
          });
        }

        destinatario = {
          cpf_cnpj: venda.cliente.cpf_cnpj,
          nome: venda.cliente.nome_razao,
          endereco: endCliente,
        };
      }
      // NFC-e é sempre operação interna (CFOP 5xxx)
      const interestadual = !isNFCe && (venda.cliente?.endereco?.uf ?? loja.uf) !== loja.uf;
      itens = (venda.itens ?? []).filter((i: any) => i.produto_id).map((i: any) => ({
        codigo: i.produto?.sku ?? i.produto_id,
        descricao: i.produto?.nome ?? i.nome,
        ean: i.produto?.codigo_barras,
        ncm: i.produto?.ncm,
        cest: i.produto?.cest,
        cfop: interestadual ? "6102" : (i.produto?.cfop_padrao ?? "5102"),
        csosn: i.produto?.csosn ?? "102",
        // tributos do cadastro (etapa 6, 10/10/2026): antes a nota saía sempre
        // com origem 0 e um CSOSN 101 não levava o crédito que o schema exige
        origem: Number(i.produto?.origem_mercadoria ?? 0),
        aliquota_icms: i.produto?.icms != null ? Number(i.produto.icms) : undefined,
        aliquota_credito_sn: i.produto?.aliquota_credito_sn != null ? Number(i.produto.aliquota_credito_sn) : undefined,
        ...outrosTributos(i.produto),
        unidade: i.produto?.unidade ?? "UN",
        quantidade: Number(i.quantidade),
        valor_unitario: Number(i.preco_unitario ?? i.preco ?? 0),
      }));
      totalNota = Number(venda.total);
      pagamentos = [{ forma: FORMA_PAG_MAP[venda.forma_pagamento] ?? "99", valor: Number(venda.total) }];
      observacoes = `Venda #${venda.numero_pedido ?? ""}`.trim();

      // ---- entrega, desconto e acréscimo da venda, rateados nos itens ----
      const taxaEntrega = Number(venda.taxa_entrega ?? 0);
      let freteComoFrete = true;
      if (taxaEntrega > 0) {
        const { data: pedido } = await admin
          .from("erp_pedidos").select("endereco_entrega, transportadora_id")
          .eq("venda_id", venda.id).neq("status", "cancelado").limit(1).maybeSingle();
        const end = pedido?.endereco_entrega ?? null;
        // transportadora contratada pela loja = 0 (CIF); motoboy da loja = 3 (próprio)
        const modalidade = pedido?.transportadora_id ? 0 : 3;
        if (isNFCe) {
          // NFC-e só aceita frete como entrega a domicílio, e aí exige
          // destinatário com endereço (rejeições 753/787/788). Sem isso a taxa
          // vai como outras despesas: o total da nota continua o que foi pago.
          const falta = faltaParaEntregaNfce(destinatario?.cpf_cnpj, end);
          if (falta) {
            freteComoFrete = false;
            observacoes += ` · Taxa de entrega R$ ${taxaEntrega.toFixed(2).replace(".", ",")} em outras despesas (${falta})`;
          } else {
            presenca = 4;
            frete = { modalidade };
            destinatario = {
              ...destinatario,
              endereco: {
                logradouro: end.logradouro, numero: end.numero, bairro: end.bairro,
                complemento: end.complemento ?? undefined,
                municipio: end.cidade, uf: end.uf, cep: end.cep,
                codigo_municipio: end.codigo_municipio,
              },
            };
          }
        } else {
          frete = { modalidade };
        }
      }
      itens = ratearValoresDaVenda(itens, {
        total: Number(venda.total),
        frete: taxaEntrega,
        acrescimo: Number(venda.acrescimo ?? 0),
        freteComoFrete,
      });
      // a SEFAZ soma o total pelos itens: tem de dar exatamente o que foi pago
      if (Math.abs(totalDaNota(itens) - totalNota) > 0.009) {
        const foraDaNota = (venda.itens ?? []).filter((i: any) => !i.produto_id).map((i: any) => i.nome);
        return json(422, {
          erro: foraDaNota.length
            ? `a venda tem itens que não vão para a nota (${foraDaNota.join(", ")}) — kit/serviço ainda não é emitido; emita a nota manualmente`
            : `total da nota (${totalDaNota(itens).toFixed(2)}) não fecha com o da venda (${totalNota.toFixed(2)}) — confira desconto e itens da venda`,
        });
      }
    }

    if (itens.length === 0) return json(422, { erro: "nenhum item de produto para emitir" });
    const semNcm = itens.filter((i) => !i.ncm);
    if (semNcm.length > 0) {
      return json(422, {
        erro: "produtos sem NCM — cadastre o NCM na tela de produtos antes de emitir",
        produtos: semNcm.map((i) => i.descricao),
      });
    }

    // ---------------- 5. Numeração (com lock no banco) ----------------
    let numero: number;
    if (ehEspelho) {
      // espelho mostra o número que a nota VAI ter, sem reservá-lo
      numero = Number(isNFCe ? sefaz.numeracao_atual_nfce : sefaz.numeracao_atual_nfe ?? 0) + 1;
    } else {
      const { data: n, error: numErr } = await admin
        .rpc("incrementar_numeracao_nfe", { p_loja_id: loja_id, p_tipo: tipoDoc });
      if (numErr || !n) return json(500, { erro: `falha na numeração: ${numErr?.message}` });
      numero = n;
    }
    const serieDoc = (isNFCe ? sefaz.serie_nfce : sefaz.serie_nfe) ?? 1;

    // ---------------- 6. Chamar o nfe-service ----------------
    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { erro: "integração nfe_service não configurada (public.integrations)" });
    }

    const payload = {
      ambiente: sefaz.ambiente === "producao" ? 1 : 2,
      certificado: { pfx_base64: pfxB64, senha },
      emitente: {
        cnpj: loja.cnpj,
        razao: loja.nome,
        fantasia: loja.apelido,
        ie: loja.inscricao_estadual,
        crt: Number(sefaz.crt ?? 1), // regime da loja (Configurações SEFAZ); 1 = Simples
        uf: loja.uf,
        endereco: {
          logradouro: loja.logradouro, numero: loja.numero, bairro: loja.bairro,
          municipio: loja.cidade, uf: loja.uf, cep: loja.cep,
          codigo_municipio: loja.codigo_municipio_ibge, fone: loja.telefone,
        },
      },
      destinatario,
      // CSC só faz sentido na NFC-e — é o que assina o QR Code do cupom
      ...(isNFCe ? { csc: sefaz.csc_token, csc_id: sefaz.csc_id } : {}),
      ...(frete ? { frete } : {}),
      ...(entrega ? { entrega } : {}),
      nota: {
        modelo, serie: serieDoc, numero, natureza, observacoes,
        ...(presenca ? { presenca } : {}),
        finalidade: finalidadeNota,
        ...(chaveReferenciada ? { chave_referenciada: chaveReferenciada } : {}),
        ...notaExtra,
        // Venda que subiu da fila offline: a emissão é posterior ao fato, e a
        // SEFAZ trata isso como contingência (tpEmis=9), com o momento da
        // queda declarado em dhCont. Emitir como normal seria informar uma
        // data de emissão que não é a da operação.
        ...(isNFCe && contingenciaDesde
          ? {
              contingencia_offline: true,
              contingencia_desde: contingenciaDesde,
              contingencia_motivo: "Venda realizada sem conexao com a internet no ponto de venda",
            }
          : {}),
      },
      itens,
      pagamentos,
      ...(ehEspelho ? { dry_run: true } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (sefaz.timeout_segundos ?? 30) * 1000);
    let resultado: any;
    try {
      const resp = await fetch(`${integ.config.url}/v1/nfe/emitir`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${integ.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      resultado = await resp.json();
      if (ehEspelho) {
        // nada é gravado: devolve a nota validada e o DANFE de pré-visualização
        if (!resp.ok || !resultado?.xml_base64) {
          return json(422, { erro: resultado?.erro ?? "a nota não passou na validação", detalhe: resultado?.detalhe });
        }
        const rd = await fetch(`${integ.config.url}/v1/danfe`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${integ.config.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ xml_base64: resultado.xml_base64, modelo }),
        });
        const danfe = await rd.json().catch(() => ({}));
        return json(200, {
          espelho: true, numero_previsto: numero, total: totalNota, ambiente: sefaz.ambiente,
          xml_base64: resultado.xml_base64, danfe_pdf_base64: danfe?.danfe_pdf_base64 ?? null,
        });
      }
      if (!resp.ok) {
        // O número já foi consumido na numeração — registra rastro da rejeição
        const motivoRejeicao =
          typeof resultado?.motivo === "string"
            ? resultado.motivo
            : `nfe-service HTTP ${resp.status}: ${JSON.stringify(resultado ?? {})}`.slice(0, 1000);
        const { error: rastroErr } = await admin.from("erp_notas_fiscais").insert({
          loja_id, tipo: tipoDoc, numero, serie: serieDoc,
          status: "rejeitada", valor_total: totalNota,
          data_emissao: new Date().toISOString(),
          venda_id: venda_id ?? null, destinatario_id: null,
          certificado_id: cert.id, configuracao_sefaz_id: sefaz.id,
          ambiente: sefaz.ambiente, mensagem_retorno: motivoRejeicao,
          observacoes, tentativas: 1,
        });
        if (rastroErr) console.error(`falha ao gravar rastro da rejeição: ${rastroErr.message}`);
        return json(422, { erro: "nfe-service recusou a emissão", detalhe: resultado });
      }
    } catch (e) {
      // Timeout / serviço fora: registra pendência para retry
      await admin.from("erp_notas_fiscais").insert({
        loja_id, tipo: tipoDoc, numero, serie: serieDoc,
        status: "pendente_transmissao", valor_total: totalNota,
        data_emissao: new Date().toISOString(),
        venda_id: venda_id ?? null, destinatario_id: null,
        certificado_id: cert.id, configuracao_sefaz_id: sefaz.id,
        ambiente: sefaz.ambiente, mensagem_retorno: `sem resposta do serviço: ${e.message}`,
        observacoes, tentativas: 1,
      });
      return json(504, { erro: "SEFAZ/serviço sem resposta — nota registrada como pendente para retry" });
    } finally {
      clearTimeout(timeout);
    }

    // ---------------- 7. Persistir resultado REAL ----------------
    let xmlPath: string | null = null;
    let danfePath: string | null = null;
    let arquivosPendentes = false;

    if (resultado.autorizada) {
      const pasta = `${loja_id}/${new Date().getFullYear()}`;
      xmlPath = `${pasta}/${resultado.chave}.xml`;
      const { error: xmlUpErr } = await adminPublic.storage.from("fiscal").upload(
        xmlPath,
        Uint8Array.from(atob(resultado.xml_base64), (c) => c.charCodeAt(0)),
        { contentType: "application/xml", upsert: true },
      );
      if (xmlUpErr) {
        console.error(`falha ao subir XML da NF-e ${resultado.chave}: ${xmlUpErr.message}`);
        arquivosPendentes = true;
        xmlPath = null;
      }
      if (resultado.danfe_pdf_base64) {
        danfePath = `${pasta}/${resultado.chave}.pdf`;
        const { error: danfeUpErr } = await adminPublic.storage.from("fiscal").upload(
          danfePath,
          Uint8Array.from(atob(resultado.danfe_pdf_base64), (c) => c.charCodeAt(0)),
          { contentType: "application/pdf", upsert: true },
        );
        if (danfeUpErr) {
          console.error(`falha ao subir DANFE da NF-e ${resultado.chave}: ${danfeUpErr.message}`);
          arquivosPendentes = true;
          danfePath = null;
        }
      }
    }

    const { data: nfe, error: nfeErr } = await admin.from("erp_notas_fiscais").insert({
      loja_id,
      tipo: tipoDoc,
      numero,
      serie: serieDoc,
      finalidade: finalidadeNota,
      nota_referenciada_id: notaOriginalId,
      chave_acesso: resultado.chave || null,
      protocolo: resultado.protocolo || null,
      status: resultado.autorizada
        ? (arquivosPendentes ? "pendente_arquivo" : "autorizada")
        : "rejeitada",
      cstat: resultado.cstat,
      valor_total: totalNota,
      data_emissao: new Date().toISOString(),
      data_processamento: resultado.data_autorizacao || new Date().toISOString(),
      codigo_retorno: resultado.cstat,
      mensagem_retorno: arquivosPendentes
        ? `${resultado.motivo ?? ""} [XML/DANFE não gravados no storage — reprocessar arquivos]`.trim()
        : resultado.motivo,
      venda_id: venda_id ?? null,
      consumidor_cpf_cnpj: (destinatario as any)?.cpf_cnpj ?? null,
      consumidor_nome: (destinatario as any)?.nome ?? null,
      certificado_id: cert.id,
      configuracao_sefaz_id: sefaz.id,
      ambiente: sefaz.ambiente,
      tipo_emissao: 1,
      observacoes,
      xml_path: xmlPath,
      danfe_path: danfePath,
    }).select().single();
    if (nfeErr) return json(500, { erro: `nota processada mas falhou ao gravar: ${nfeErr.message}`, resultado });

    // Devolução a fornecedor autorizada: faturada, com a nota ligada
    if (isDevolFornecedor && resultado.autorizada) {
      await admin.from("erp_devolucoes_fornecedor")
        .update({ status: "faturada", nota_fiscal_id: nfe.id, updated_at: new Date().toISOString() })
        .eq("id", devolucao_fornecedor_id);
    }

    // Vincular à remessa + baixar estoque da ORIGEM (o destino recebe via "Receber Remessa")
    if (remessa_id && resultado.autorizada) {
      await admin.from("erp_remessas").update({ nfe_remessa_id: nfe.id, status: "em_transito" }).eq("id", remessa_id);

      const { data: remItens } = await admin
        .from("erp_remessa_itens").select("produto_id, quantidade, remessa:erp_remessas(loja_origem_id)")
        .eq("remessa_id", remessa_id);
      for (const item of remItens ?? []) {
        const lojaOrigem = (item as any).remessa?.loja_origem_id;
        if (!lojaOrigem || !item.produto_id) continue;
        const { data: est } = await admin
          .from("erp_estoque").select("id, quantidade")
          .eq("produto_id", item.produto_id).eq("loja_id", lojaOrigem).maybeSingle();
        if (est) {
          await admin.from("erp_estoque")
            .update({ quantidade: Math.max(0, Number(est.quantidade) - Number(item.quantidade)) })
            .eq("id", est.id);
        }
      }
    }

    // Envio automático da nota ao cliente (contrato: "envio automático via
    // mensageria"). Best-effort com timeout curto: falha de e-mail não pode
    // derrubar uma emissão que a SEFAZ já autorizou — o reenvio manual existe
    // na tela de Notas Fiscais, e cada tentativa fica em erp_nota_envios.
    let envio_cliente: string | null = null;
    if (resultado.autorizada && venda_id) {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 10_000);
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/erp-enviar-nota`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ nota_id: nfe.id, canal: "email", automatico: true }),
          signal: ctl.signal,
        });
        clearTimeout(t);
        const d = await r.json().catch(() => ({}));
        envio_cliente = r.ok ? `email enviado para ${d?.destino}` : (d?.erro ?? "envio não realizado");
      } catch {
        envio_cliente = "envio não realizado (tempo esgotado)";
      }
    }

    return json(200, {
      autorizada: resultado.autorizada,
      cstat: resultado.cstat,
      motivo: resultado.motivo,
      chave: resultado.chave,
      protocolo: resultado.protocolo,
      numero,
      nfe_id: nfe.id,
      xml_path: xmlPath,
      danfe_path: danfePath,
      ambiente: sefaz.ambiente,
      envio_cliente,
    });
  } catch (e) {
    return json(500, { erro: `falha interna: ${e.message}` });
  }
});
