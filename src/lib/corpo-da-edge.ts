/**
 * Corpo da resposta de uma edge function, mesmo em erro.
 *
 * As edges devolvem o motivo no corpo também em 4xx; o supabase-js esconde
 * isso atrás de "Edge Function returned a non-2xx status code". Aqui o texto
 * de verdade volta para a tela.
 */
export async function corpoDaEdge(data: any, error: any): Promise<{ success?: boolean; error?: string; [k: string]: any }> {
  if (data) return data;
  const corpo = error?.context?.json ? await error.context.json().catch(() => null) : null;
  return corpo ?? { success: false, error: error?.message ?? "falha desconhecida" };
}
