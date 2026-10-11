<?php
// ============================================================
// Dry-run (sem SEFAZ) dos tributos do item — dados FICTÍCIOS.
// CSOSN 101 com crédito (pCredSN/vCredICMSSN), CSOSN 900 com destaque
// (vBC/pICMS/vICMS e totais), origem da mercadoria e a recusa do 101 sem
// alíquota. Uso: como dryrun-entrega.php (contêiner descartável, sem rede,
// com NFE_RESP_TEC_* e um .pfx de teste em /tmp/t.pfx).
// ============================================================
$token = getenv("NFE_SERVICE_TOKEN") ?: "teste-local";
$pfx = base64_encode(file_get_contents("/tmp/t.pfx"));
$emit = ["cnpj" => "11222333000181", "razao" => "EMPRESA FICTICIA LTDA", "ie" => "123456789", "uf" => "PE",
  "endereco" => ["codigo_municipio" => 2611101, "logradouro" => "RUA FICTICIA", "numero" => "1",
  "bairro" => "CENTRO", "cep" => "56300000", "municipio" => "PETROLINA"]];
$dest = ["cpf_cnpj" => "11444777000161", "nome" => "FORNECEDOR FICTICIO", "ie" => "123456789",
  "endereco" => ["logradouro" => "RUA X", "numero" => "2", "bairro" => "CENTRO", "municipio" => "PETROLINA",
  "uf" => "PE", "cep" => "56300000", "codigo_municipio" => 2611101]];
$base = ["ncm" => "21069030", "cfop" => "5202", "unidade" => "UN", "quantidade" => 2, "valor_unitario" => 100];
$casos = [
  "NF-e com 101 (crédito) e 900 (destaque) e origem 2" => ["nota" => ["modelo" => 55, "serie" => 1, "numero" => 9],
    "destinatario" => $dest,
    "itens" => [array_merge($base, ["descricao" => "ITEM 101", "codigo" => "A", "csosn" => "101", "aliquota_credito_sn" => 1.25, "origem" => 2]),
                array_merge($base, ["descricao" => "ITEM 900", "codigo" => "B", "csosn" => "900", "aliquota_icms" => 18])],
    "pagamentos" => [["forma" => "90", "valor" => 0]]],
  "101 sem alíquota de crédito (deve recusar)" => ["nota" => ["modelo" => 55, "serie" => 1, "numero" => 10],
    "destinatario" => $dest, "itens" => [array_merge($base, ["descricao" => "X", "codigo" => "X", "csosn" => "101"])],
    "pagamentos" => [["forma" => "90", "valor" => 0]]],
];
foreach ($casos as $nome => $c) {
  $payload = array_merge(["dry_run" => true, "ambiente" => 2, "certificado" => ["pfx_base64" => $pfx, "senha" => "123"], "emitente" => $emit], $c);
  $ctx = stream_context_create(["http" => ["method" => "POST",
    "header" => "Content-Type: application/json\r\nAuthorization: Bearer {$token}\r\n", "content" => json_encode($payload), "ignore_errors" => true]]);
  $r = json_decode(file_get_contents("http://127.0.0.1:8100/v1/nfe/emitir", false, $ctx), true);
  echo "== $nome: ";
  if (empty($r["xml_base64"])) { echo "RECUSADO -> ", json_encode($r, JSON_UNESCAPED_UNICODE), PHP_EOL; continue; }
  $x = base64_decode($r["xml_base64"]);
  preg_match("~<ICMSTot>(.*?)</ICMSTot>~s", $x, $t);
  $g = fn($n, $s) => preg_match("~<$n>([^<]*)</$n>~", $s, $m) ? $m[1] : "-";
  preg_match_all("~<orig>(\d)</orig>~", $x, $o);
  echo "XSD+assinatura OK | orig=", implode(",", $o[1]), " | pCredSN=", $g("pCredSN", $x), " vCredICMSSN=", $g("vCredICMSSN", $x),
    " | item900 vBC=", (preg_match("~<ICMSSN900>(.*?)</ICMSSN900>~s", $x, $i9) ? $g("vBC", $i9[1]) . " pICMS=" . $g("pICMS", $i9[1]) . " vICMS=" . $g("vICMS", $i9[1]) : "sem grupo 900"),
    " | totais vBC=", $g("vBC", $t[1] ?? ""), " vICMS=", $g("vICMS", $t[1] ?? ""), " vNF=", $g("vNF", $t[1] ?? ""), PHP_EOL;
}
