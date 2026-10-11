<?php
// ============================================================
// Dry-run (sem SEFAZ) da NF-e de devolução a fornecedor — dados FICTÍCIOS.
// Saída (tpNF=1), finalidade 4, schema PL_010 com referência por item
// (DFeReferenciado, NT 2025.002 VC02-14), CSOSN 900 com ICMS destacado,
// transportadora, veículo e volumes. E a regressão: NFC-e comum no PL_009.
// Uso: como dryrun-entrega.php.
// ============================================================
$token = getenv("NFE_SERVICE_TOKEN") ?: "teste-local";
$pfx = base64_encode(file_get_contents("/tmp/t.pfx"));
$emit = ["cnpj" => "11222333000181", "razao" => "EMPRESA FICTICIA LTDA", "ie" => "123456789", "uf" => "PE",
  "endereco" => ["codigo_municipio" => 2611101, "logradouro" => "RUA FICTICIA", "numero" => "1", "bairro" => "CENTRO", "cep" => "56300000", "municipio" => "PETROLINA"]];
$forn = ["cpf_cnpj" => "11444777000161", "nome" => "FORNECEDOR FICTICIO", "ie" => "123456789", "ind_ie" => 1,
  "endereco" => ["logradouro" => "AV FORNECEDOR", "numero" => "10", "bairro" => "INDUSTRIAL", "municipio" => "SAO PAULO", "uf" => "SP", "cep" => "01001000", "codigo_municipio" => 3550308]];
$chave = "35261011444777000161550010000012341000012345";
$casos = [
  "Devolução a fornecedor (PL_010, ref. por item, CSOSN 900, transporte)" => [
    "nota" => ["modelo" => 55, "serie" => 1, "numero" => 77, "finalidade" => 4, "tipo_operacao" => "saida",
      "schema" => "PL_010_V1.30", "natureza" => "DEVOLUCAO DE COMPRA PARA COMERCIALIZACAO", "consumidor_final" => 0, "presenca" => 0,
      "observacoes" => "Devolucao: produto com defeito"],
    "destinatario" => $forn,
    "frete" => ["modalidade" => 0, "transportadora" => ["cpf_cnpj" => "11222333000181", "nome" => "TRANSPORTADORA FICTICIA", "uf" => "PE", "municipio" => "PETROLINA", "endereco" => "RUA T, 5"],
      "veiculo" => ["placa" => "ABC1D23", "uf" => "PE"], "volumes" => ["quantidade" => 2, "especie" => "CAIXA", "peso_liquido" => 4.5, "peso_bruto" => 5.2]],
    "itens" => [
      ["descricao" => "WHEY FICTICIO", "codigo" => "W1", "ncm" => "21069030", "cfop" => "6202", "unidade" => "UN", "quantidade" => 2, "valor_unitario" => 100,
       "csosn" => "900", "origem" => 0, "aliquota_icms" => 18, "valor_bc" => 200, "valor_icms" => 36, "dfe_referenciado" => ["chave" => $chave, "n_item" => 3]],
      ["descricao" => "BARRA FICTICIA", "codigo" => "B1", "ncm" => "21069090", "cfop" => "6202", "unidade" => "UN", "quantidade" => 1, "valor_unitario" => 10,
       "csosn" => "102", "origem" => 0, "dfe_referenciado" => ["chave" => $chave, "n_item" => 5]],
    ],
    "pagamentos" => [["forma" => "90", "valor" => 0]]],
  "Regressão: NFC-e comum (PL_009)" => [
    "nota" => ["modelo" => 65, "serie" => 1, "numero" => 78],
    "itens" => [["descricao" => "P", "codigo" => "P", "ncm" => "21069030", "cfop" => "5102", "csosn" => "102", "unidade" => "UN", "quantidade" => 1, "valor_unitario" => 10]],
    "pagamentos" => [["forma" => "01", "valor" => 10]]],
];
foreach ($casos as $nome => $c) {
  $payload = array_merge(["dry_run" => true, "ambiente" => 2, "certificado" => ["pfx_base64" => $pfx, "senha" => "123"], "emitente" => $emit], $c);
  $ctx = stream_context_create(["http" => ["method" => "POST", "header" => "Content-Type: application/json\r\nAuthorization: Bearer {$token}\r\n", "content" => json_encode($payload), "ignore_errors" => true]]);
  $r = json_decode(file_get_contents("http://127.0.0.1:8100/v1/nfe/emitir", false, $ctx), true);
  echo "== $nome: ";
  if (empty($r["xml_base64"])) { echo "RECUSADO -> ", json_encode($r, JSON_UNESCAPED_UNICODE), PHP_EOL; continue; }
  $x = base64_decode($r["xml_base64"]);
  $g = fn($n, $s) => preg_match("~<$n>([^<]*)</$n>~", $s, $m) ? $m[1] : "-";
  preg_match("~<ICMSTot>(.*?)</ICMSTot>~s", $x, $t);
  preg_match_all("~<DFeReferenciado><chaveAcesso>\d{44}</chaveAcesso><nItem>(\d+)</nItem></DFeReferenciado>~", $x, $d);
  echo "XSD+assinatura OK | tpNF=", $g("tpNF", $x), " finNFe=", $g("finNFe", $x), " refNFe=", strpos($x, "<refNFe>") !== false ? "SIM" : "nao",
    " | DFeRef nItem=", implode(",", $d[1]) ?: "-", " | vBC=", $g("vBC", $t[1] ?? ""), " vICMS=", $g("vICMS", $t[1] ?? ""), " vNF=", $g("vNF", $t[1] ?? ""),
    " | transporta=", strpos($x, "<transporta>") !== false ? "sim" : "nao", " vol=", $g("qVol", $x), "/", $g("pesoB", $x), " placa=", $g("placa", $x), PHP_EOL;
  if (!empty($r["xml_base64"]) && str_starts_with($nome, "Devolução")) file_put_contents("/tmp/devol.xml", $x);
}
