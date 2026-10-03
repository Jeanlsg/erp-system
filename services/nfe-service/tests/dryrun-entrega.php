<?php
// ============================================================
// Dry-run (sem SEFAZ) das notas com desconto, acréscimo e entrega.
//
// Monta, valida no XSD e assina quatro notas FICTÍCIAS: NFC-e presencial com
// desconto e acréscimo rateados, NFC-e de entrega a domicílio com frete
// (indPres=4 + endereço), NFC-e com frete fora da entrega (tem de ser
// recusada — rejeição 753) e NF-e com frete. Confira vNF = vPag.
//
// Uso: num contêiner DESCARTÁVEL da imagem, sem rede, sem tocar o serviço:
//   docker run -d --rm --name nfe-teste --network none -e NFE_SERVICE_TOKEN=teste-local \
//     -v $PWD/src/index.php:/app/src/index.php:ro -v $PWD/tests/dryrun-entrega.php:/tmp/dryrun.php:ro nfe-service:latest
//   docker exec nfe-teste sh -c "openssl req -x509 -newkey rsa:2048 -keyout /tmp/k.pem -out /tmp/c.pem \
//     -days 1 -nodes -subj /CN=TESTE 2>/dev/null && openssl pkcs12 -export -legacy -out /tmp/t.pfx \
//     -inkey /tmp/k.pem -in /tmp/c.pem -passout pass:123 && NFE_SERVICE_TOKEN=teste-local php /tmp/dryrun.php"
//   docker stop nfe-teste
// ============================================================
$token = getenv("NFE_SERVICE_TOKEN") ?: "teste-local";
$pfx = base64_encode(file_get_contents("/tmp/t.pfx"));
$emit = ["cnpj" => "11222333000181", "razao" => "EMPRESA FICTICIA LTDA", "ie" => "123456789", "uf" => "PE",
  "endereco" => ["codigo_municipio" => 2611101, "logradouro" => "RUA FICTICIA", "numero" => "1",
  "bairro" => "CENTRO", "cep" => "56300000", "municipio" => "PETROLINA"]];
$itens = [
  ["descricao" => "PRODUTO A", "ncm" => "21069090", "cfop" => "5102", "csosn" => "102", "unidade" => "UN",
   "quantidade" => 1, "valor_unitario" => 119.90, "codigo" => "A", "valor_desconto" => 10.91, "valor_outro" => 1.36],
  ["descricao" => "PRODUTO B", "ncm" => "21069090", "cfop" => "5102", "csosn" => "102", "unidade" => "UN",
   "quantidade" => 2, "valor_unitario" => 35.00, "codigo" => "B", "valor_desconto" => 6.37, "valor_outro" => 0.80],
];
$end = ["logradouro" => "RUA DO CLIENTE", "numero" => "45", "bairro" => "CENTRO", "complemento" => "APTO 2",
  "municipio" => "PETROLINA", "uf" => "PE", "cep" => "56300000", "codigo_municipio" => 2611101];
$casos = [
  "NFC-e presencial c/ desconto+acrescimo" => ["nota" => ["modelo" => 65, "serie" => 1, "numero" => 1],
     "itens" => $itens, "pagamentos" => [["forma" => "01", "valor" => 174.78]]],
  "NFC-e entrega a domicilio c/ frete" => ["nota" => ["modelo" => 65, "serie" => 1, "numero" => 2, "presenca" => 4],
     "frete" => ["modalidade" => 3],
     "destinatario" => ["cpf_cnpj" => "52998224725", "nome" => "CLIENTE FICTICIO", "endereco" => $end],
     "itens" => [array_merge($itens[0], ["valor_desconto" => 0, "valor_outro" => 0, "valor_frete" => 4.63]),
                 array_merge($itens[1], ["valor_desconto" => 0, "valor_outro" => 0, "valor_frete" => 2.70])],
     "pagamentos" => [["forma" => "17", "valor" => 197.23]]],
  "NFC-e com frete SEM entrega (deve recusar)" => ["nota" => ["modelo" => 65, "serie" => 1, "numero" => 3],
     "itens" => [array_merge($itens[0], ["valor_frete" => 5])], "pagamentos" => [["forma" => "01", "valor" => 115.35]]],
  "NF-e 55 c/ frete modFrete 0" => ["nota" => ["modelo" => 55, "serie" => 1, "numero" => 4],
     "frete" => ["modalidade" => 0],
     "destinatario" => ["cpf_cnpj" => "52998224725", "nome" => "CLIENTE FICTICIO", "endereco" => $end],
     "itens" => [array_merge($itens[0], ["valor_desconto" => 0, "valor_outro" => 0, "valor_frete" => 4.63])],
     "pagamentos" => [["forma" => "01", "valor" => 124.53]]],
];
foreach ($casos as $nome => $c) {
  $payload = array_merge(["dry_run" => true, "ambiente" => 2, "csc" => "CSC-DE-TESTE-000000000000000000000000",
    "csc_id" => "000001", "certificado" => ["pfx_base64" => $pfx, "senha" => "123"], "emitente" => $emit], $c);
  $ctx = stream_context_create(["http" => ["method" => "POST",
    "header" => "Content-Type: application/json\r\nAuthorization: Bearer {$token}\r\n",
    "content" => json_encode($payload), "ignore_errors" => true]]);
  $r = json_decode(file_get_contents("http://127.0.0.1:8100/v1/nfe/emitir", false, $ctx), true);
  echo "== $nome: ";
  if (empty($r["xml_base64"])) { echo "RECUSADO -> ", json_encode($r, JSON_UNESCAPED_UNICODE), PHP_EOL; continue; }
  $x = base64_decode($r["xml_base64"]);
  preg_match("~<ICMSTot>(.*?)</ICMSTot>~s", $x, $t);
  $tag = fn($n) => preg_match("~<$n>([^<]*)</$n>~", $t[1] ?? "", $m) ? $m[1] : "-";
  preg_match("~<indPres>(\d)</indPres>~", $x, $ip); preg_match("~<modFrete>(\d)</modFrete>~", $x, $mf);
  preg_match_all("~<vPag>([^<]*)</vPag>~", $x, $vp);
  echo "XSD+assinatura OK | vProd=", $tag("vProd"), " vDesc=", $tag("vDesc"), " vFrete=", $tag("vFrete"),
    " vOutro=", $tag("vOutro"), " vNF=", $tag("vNF"), " | vPag=", implode("+", $vp[1]), " | indPres=", $ip[1] ?? "-",
    " modFrete=", $mf[1] ?? "-", " enderDest=", strpos($x, "<enderDest>") !== false ? "sim" : "nao", PHP_EOL;
}
