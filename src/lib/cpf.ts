/**
 * CPF: só os dígitos, conferência dos dígitos verificadores e máscara.
 *
 * Usado no login (entrar com CPF ou e-mail) e no CPF de acesso do usuário.
 * O banco guarda só os 11 dígitos (erp_usuarios.cpf, migration 121).
 */

export function soDigitos(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Os dois dígitos verificadores batem? Recusa também 111.111.111-11 e afins. */
export function cpfValido(v: string | null | undefined): boolean {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/** 000.000.000-00 (o que não tiver 11 dígitos volta como veio). */
export function formatarCpf(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length !== 11) return String(v ?? "");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * O que a pessoa digitou no campo de login é e-mail ou CPF? Tem "@" é
 * e-mail; o resto é tratado como CPF (e recusado se não for um CPF válido).
 */
export function tipoDoLogin(v: string): "email" | "cpf" {
  return v.includes("@") ? "email" : "cpf";
}
