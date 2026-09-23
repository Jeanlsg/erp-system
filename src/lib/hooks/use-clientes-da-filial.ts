import { useClientes } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";

/**
 * Clientes da filial escolhida no topo (migration 096). Mora fora de
 * supabase-queries porque o hook da filial importa de lá — juntar os dois
 * no mesmo arquivo criaria importação circular.
 */
export function useClientesDaFilial() {
  const { lojaId } = useAutoSelectLoja();
  return useClientes({ lojaId: lojaId ?? null });
}
