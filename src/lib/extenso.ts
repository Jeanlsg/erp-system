// Valor por extenso em reais — exigência de promissória e recibo.
const U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const D = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100;
  const dez = r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " e " + U[r % 10] : "");
  return [C[c], dez].filter(Boolean).join(" e ");
}

export function valorPorExtenso(valor: number): string {
  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);
  if (inteiro === 0 && centavos === 0) return "zero reais";

  const partes: string[] = [];
  const milhoes = Math.floor(inteiro / 1_000_000);
  const milhares = Math.floor((inteiro % 1_000_000) / 1000);
  const resto = inteiro % 1000;
  if (milhoes) partes.push(ate999(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  if (milhares) partes.push(milhares === 1 ? "mil" : ate999(milhares) + " mil");
  if (resto) partes.push(ate999(resto));

  // "e" liga a última parcela quando ela é pequena ou centena redonda
  // (mil e quinhentos; dois mil e cem); caso contrário justapõe.
  const ligaE = partes.length > 1 && resto > 0 && (resto < 100 || resto % 100 === 0);
  let s = ligaE
    ? partes.slice(0, -1).join(" ") + " e " + partes[partes.length - 1]
    : partes.join(" ");
  if (inteiro > 0) {
    // milhão/milhões exatos pedem "de": um milhão DE reais
    const soMilhoes = milhoes > 0 && milhares === 0 && resto === 0;
    s += inteiro === 1 ? " real" : soMilhoes ? " de reais" : " reais";
  }
  if (centavos > 0) s += (inteiro > 0 ? " e " : "") + ate999(centavos) + (centavos === 1 ? " centavo" : " centavos");
  return s.trim();
}
