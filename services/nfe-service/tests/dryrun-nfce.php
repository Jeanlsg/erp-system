<?php
// ============================================================
// Teste do pipeline NFC-e sem tocar a SEFAZ.
//
// Monta o XML, valida contra o XSD, assina com um certificado self-signed
// e recebe o QR Code injetado pela lib — tudo via dry_run do /v1/nfe/emitir.
// Foi este teste que pegou o PIS/COFINS inválido contra o schema, que só
// apareceria na primeira transmissão real.
//
// Uso (na VPS):
//   docker cp tests/dryrun-nfce.php nfe-service:/tmp/
//   docker exec nfe-service sh -c "
//     openssl req -x509 -newkey rsa:2048 -keyout /tmp/k.pem -out /tmp/c.pem \
//       -days 1 -nodes -subj /CN=TESTE 2>/dev/null &&
//     (openssl pkcs12 -export -legacy -out /tmp/t.pfx -inkey /tmp/k.pem \
//        -in /tmp/c.pem -passout pass:123 2>/dev/null ||
//      openssl pkcs12 -export -out /tmp/t.pfx -inkey /tmp/k.pem \
//        -in /tmp/c.pem -passout pass:123) &&
//     php /tmp/dryrun-nfce.php"
// ============================================================
$payload = [
  "dry_run" => true,
  "ambiente" => 2,
  "csc" => "CSC-DE-TESTE-000000000000000000000000",
  "csc_id" => "000001",
  "certificado" => ["pfx_base64" => base64_encode(file_get_contents("/tmp/t.pfx")), "senha" => "123"],
  "emitente" => [
    "cnpj" => "53833226000130", "razao" => "X-LIFE SUPLEMENTOS ALIMENTARES LTDA",
    "ie" => "115414584", "uf" => "PE",
    "endereco" => ["codigo_municipio" => 2611101, "logradouro" => "RUA BERNARDINO DE AMORIM COELHO",
      "numero" => "15", "bairro" => "JOSE E MARIA", "cep" => "56320350", "municipio" => "PETROLINA"],
  ],
  "nota" => ["modelo" => 65, "serie" => 1, "numero" => 1],
  "itens" => [["nome" => "CREATINA 300G", "ncm" => "21069090", "cfop" => "5102",
    "csosn" => "102", "unidade" => "UN", "quantidade" => 1, "valor_unitario" => 119.90,
    "codigo" => "CREAT-300G", "origem" => 0]],
  "pagamentos" => [["forma" => "03", "valor" => 119.90]],
];
$ctx = stream_context_create(["http" => ["method" => "POST",
  "header" => "Content-Type: application/json\r\nAuthorization: Bearer f95e57aa0a74186d48503a2de4a39b7467d6968a6cd2041e263e2217dd02e4fc\r\n",
  "content" => json_encode($payload), "ignore_errors" => true]]);
$r = json_decode(file_get_contents("http://127.0.0.1:8100/v1/nfe/emitir", false, $ctx), true);
if (empty($r["xml_base64"])) { echo "ERRO: ", json_encode($r, JSON_UNESCAPED_UNICODE), PHP_EOL; exit(1); }
$xml = base64_decode($r["xml_base64"]);

echo "infNFeSupl presente: ", strpos($xml, "<infNFeSupl>") !== false ? "SIM" : "NAO", PHP_EOL;
preg_match("~<qrCode>(.*?)</qrCode>~s", $xml, $m);
$qr = html_entity_decode($m[1] ?? "");
echo "qrCode: ", substr($qr, 0, 110), PHP_EOL;
// A lib escolhe a versão vigente da UF/ambiente:
//   v2 online: URL?p=chave|2|tpAmb|cIdToken|sha1hex(p+CSC)
//   v3 online: URL?p=chave|3|tpAmb   (sem CSC — Manual QR Code 6.00/2025)
$v2 = preg_match('~\?p=\d{44}\|2\|[12]\|\d+\|[A-Fa-f0-9]{40}$~', $qr);
$v3 = preg_match('~\?p=\d{44}\|3\|[12]$~', $qr);
echo "formato do QR: ", $v2 ? "v2 valido" : ($v3 ? "v3 valido" : "NAO RECONHECIDO"), PHP_EOL;
if ($v2 && preg_match('~\?p=(.*)\|([A-Fa-f0-9]{40})$~', $qr, $h)) {
  $esperado = strtoupper(sha1($h[1] . "CSC-DE-TESTE-000000000000000000000000"));
  echo "hash v2: ", strtoupper($h[2]) === $esperado ? "CONFERE" : "DIVERGE", PHP_EOL;
}
preg_match("~<urlChave>(.*?)</urlChave>~", $xml, $u);
echo "urlChave: ", $u[1] ?? "(ausente)", PHP_EOL;
preg_match("~<detPag>.*?</detPag>~s", $xml, $dp);
echo "detPag: ", preg_replace("~\s+~", " ", $dp[0] ?? "(ausente)"), PHP_EOL;
preg_match("~<PIS>.*?</PIS>~s", $xml, $pis);
echo "PIS: ", preg_replace("~\s+~", " ", $pis[0] ?? "(ausente)"), PHP_EOL;
