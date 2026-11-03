// Senha nova nas telas: a mesma regra das edges (supabase/functions/_shared/erp-senha.ts).
import { DICA_SENHA, problemaDaSenha, SENHA_MINIMA } from "../../supabase/functions/_shared/erp-senha.ts";

export { DICA_SENHA, problemaDaSenha, SENHA_MINIMA };

/**
 * Senha temporária como a do CRM: 12 caracteres sem os que confundem ao ditar
 * ou copiar à mão (0/O, 1/l/I), sorteada de novo até ter letra e número.
 */
export function gerarSenhaTemporaria(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  for (;;) {
    const buf = new Uint32Array(12);
    crypto.getRandomValues(buf);
    let s = "";
    for (let i = 0; i < buf.length; i++) s += chars[buf[i] % chars.length];
    if (!problemaDaSenha(s)) return s;
  }
}
