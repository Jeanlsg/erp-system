// A regra da SENHA NOVA do ERP (03/11/2026) — uma só para as telas e as edges,
// igual à do CRM (_shared/regraSenha.ts, que é dele: este volume é dividido).
//
// Vale para senha CRIADA ou TROCADA: senha temporária do usuário novo, nova
// senha dada pelo admin, troca obrigatória do primeiro acesso, redefinir pelo
// link. NÃO vale para ENTRAR: quem tem senha antiga de 6 caracteres continua
// entrando com ela.
//
// O front importa este arquivo (src/lib/senha.ts): nada de Deno aqui.

export const SENHA_MINIMA = 8;
/** O servidor de login guarda a senha com bcrypt, que só lê 72 bytes. */
export const SENHA_MAXIMA = 72;
export const DICA_SENHA = `Mínimo ${SENHA_MINIMA} caracteres, com letras e números`;

/** null = senha boa; senão, a frase para mostrar ao usuário. */
export function problemaDaSenha(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length === 0) return "Digite a senha.";
  if (senha.length < SENHA_MINIMA) return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  if (new TextEncoder().encode(senha).length > SENHA_MAXIMA) return `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`;
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}
