<?php
// ============================================================
// Dry-run (sem SEFAZ) do regime normal e de PIS/COFINS — dados FICTÍCIOS.
// CRT 3 com CST 00 (ICMS destacado) e PIS/COFINS 01 com alíquota; CST 60 e
// PIS 04 (sem destaque); a regressão do Simples sem CST (49 zerado); e as
// recusas: CST 00 sem alíquota, CST 10 (ST) e PIS 01 sem alíquota.
// Uso: como dryrun-entrega.php.
// ============================================================
$token = getenv("NFE_SERVICE_TOKEN") ?: "teste-local";
$pfx = base64_encode(file_get_contents("/tmp/t.pfx"));
$emit = fn($crt) => ["cnpj" => "11222333000181", "razao" => "EMPRESA FICTICIA LTDA", "ie" => "123456789", "uf" => "PE", "crt" => $crt,
  "endereco" => ["codigo_municipio" => 2611101, "logradouro" => "RUA FICTICIA", "numero" => "1", "bairro" => "CENTRO", "cep" => "56300000", "municipio" => "PETROLINA"]];
$dest = ["cpf_cnpj" => "11444777000161", "nome" => "CLIENTE FICTICIO", "ie" => "123456789",
  "endereco" => ["logradouro" => "RUA X", "numero" => "2", "bairro" => "CENTRO", "municipio" => "PETROLINA", "uf" => "PE", "cep" => "56300000", "codigo_municipio" => 2611101]];
$base = ["ncm" => "21069030", "cfop" => "5102", "unidade" => "UN", "quantidade" => 2, "valor_unitario" => 100, "origem" => 0];
$nota = fn($n) => ["modelo" => 55, "serie" => 1, "numero" => $n];
$casos = [
  "CRT 3: CST 00 18% + PIS 01 0,65% + COFINS 01 3%" => [3, [array_merge($base, ["descricao" => "A", "codigo" => "A", "cst" => "00", "aliquota_icms" => 18,
      "cst_pis" => "01", "aliquota_pis" => 0.65, "cst_cofins" => "01", "aliquota_cofins" => 3])]],
  "CRT 3: CST 60 + PIS/COFINS 04 (monofásico)" => [3, [array_merge($base, ["descricao" => "B", "codigo" => "B", "cst" => "60", "cst_pis" => "04", "cst_cofins" => "04"])]],
  "Regressão CRT 1 sem CST (49 zerado)" => [1, [array_merge($base, ["descricao" => "C", "codigo" => "C", "csosn" => "102"])]],
  "CRT 3: CST 00 sem alíquota (deve recusar)" => [3, [array_merge($base, ["descricao" => "D", "codigo" => "D", "cst" => "00"])]],
  "CRT 3: CST 10 com ST (deve recusar)" => [3, [array_merge($base, ["descricao" => "E", "codigo" => "E", "cst" => "10", "aliquota_icms" => 18])]],
  "CRT 1: PIS 01 sem alíquota (deve recusar)" => [1, [array_merge($base, ["descricao" => "F", "codigo" => "F", "csosn" => "102", "cst_pis" => "01"])]],
];
$n = 20;
foreach ($casos as $nome => [$crt, $itens]) {
  $payload = ["dry_run" => true, "ambiente" => 2, "certificado" => ["pfx_base64" => $pfx, "senha" => "123"], "emitente" => $emit($crt),
    "nota" => $nota($n++), "destinatario" => $dest, "itens" => $itens, "pagamentos" => [["forma" => "90", "valor" => 0]]];
  $ctx = stream_context_create(["http" => ["method" => "POST",
    "header" => "Content-Type: application/json\r\nAuthorization: Bearer {$token}\r\n", "content" => json_encode($payload), "ignore_errors" => true]]);
  $r = json_decode(file_get_contents("http://127.0.0.1:8100/v1/nfe/emitir", false, $ctx), true);
  echo "== $nome: ";
  if (empty($r["xml_base64"])) { echo "RECUSADO -> ", $r["erro"] ?? json_encode($r, JSON_UNESCAPED_UNICODE), PHP_EOL; continue; }
  $x = base64_decode($r["xml_base64"]);
  $g = fn($t, $s) => preg_match("~<$t>([^<]*)</$t>~", $s, $m) ? $m[1] : "-";
  preg_match("~<ICMSTot>(.*?)</ICMSTot>~s", $x, $t);
  preg_match("~<ICMS>(<ICMS[^>]*>)~", $x, $gi); preg_match("~<PIS>(<PIS[^>]*>)~", $x, $gp); preg_match("~<COFINS>(<COFINS[^>]*>)~", $x, $gc);
  echo "XSD+assinatura OK | CRT=", $g("CRT", $x), " ", $gi[1] ?? "?", " CST=", $g("CST", $x), " vICMS=", $g("vICMS", $t[1] ?? ""),
    " | ", $gp[1] ?? "?", " vPIS=", $g("vPIS", $t[1] ?? ""), " | ", $gc[1] ?? "?", " vCOFINS=", $g("vCOFINS", $t[1] ?? ""), " | vNF=", $g("vNF", $t[1] ?? ""), PHP_EOL;
}
