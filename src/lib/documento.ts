// Validação de CPF/CNPJ pelos dígitos verificadores — espelho da função
// erp.documento_valido do banco. O front valida ANTES de enfileirar (a
// venda offline não pode descobrir o CPF errado só na sincronização).
export function documentoValido(doc: string): boolean {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += Number(d[i]) * (10 - i);
    let dv = (s * 10) % 11; if (dv === 10) dv = 0;
    if (dv !== Number(d[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += Number(d[i]) * (11 - i);
    dv = (s * 10) % 11; if (dv === 10) dv = 0;
    return dv === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false;
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const p2 = [6, ...p1];
    let s = 0;
    for (let i = 0; i < 12; i++) s += Number(d[i]) * p1[i];
    let dv = s % 11; dv = dv < 2 ? 0 : 11 - dv;
    if (dv !== Number(d[12])) return false;
    s = 0;
    for (let i = 0; i < 13; i++) s += Number(d[i]) * p2[i];
    dv = s % 11; dv = dv < 2 ? 0 : 11 - dv;
    return dv === Number(d[13]);
  }
  return false;
}

/** 52998224725 → 529.982.247-25 · CNPJ idem. Parciais ficam como estão. */
export function mascaraDocumento(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
