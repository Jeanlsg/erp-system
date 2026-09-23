import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLojas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "./auth-store";
import { useLojaAtualStore } from "./loja-atual";
import { lojaInicial, idsDeLojas } from "@/lib/lojas-permitidas";

/**
 * A filial em que o usuário está trabalhando, e as filiais em que ele pode.
 *
 * `lojas` são só as filiais do usuário: todas para o dono, as cadastradas
 * para ele na tela de usuários para os demais (erp.lojas_do_usuario,
 * migration 095). Quem tem uma só nunca vê outra — nem no seletor do topo,
 * nem numa lista de loja de qualquer tela que use este hook.
 *
 * As filiais vêm de uma consulta viva, não do login: quando o administrador
 * muda as filiais de alguém, vale na próxima atualização da tela, sem
 * precisar sair e entrar.
 */
export function useAutoSelectLoja() {
  const user = useAuthStore((s) => s.user);
  const { data: todas = [], isSuccess: lojasOk } = useLojas();
  const currentLojaId = useLojaAtualStore((s) => s.currentLojaId);
  const setCurrentLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);

  const { data: ids, isSuccess: idsOk } = useQuery<string[]>({
    queryKey: ["erp_lojas_do_usuario", user?.id],
    enabled: !!user?.id && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await supabase.schema("erp")
        .rpc("lojas_do_usuario", { p_usuario: user!.id });
      if (error) throw error;
      return idsDeLojas(data);
    },
  });

  const lojas = useMemo(
    () => (ids ? (todas as any[]).filter((l) => ids.includes(l.id)) : []),
    [todas, ids],
  );
  const carregado = lojasOk && idsOk;

  useEffect(() => {
    if (!carregado) return;
    const alvo = lojaInicial(lojas, currentLojaId, user?.loja_default_id ?? null);
    if (alvo !== currentLojaId) setCurrentLojaId(alvo);
  }, [carregado, lojas, currentLojaId, user, setCurrentLojaId]);

  return {
    lojaId: currentLojaId,
    lojas,
    /** as filiais do usuário já chegaram */
    carregado,
    /** usuário que não é dono e não tem filial cadastrada */
    semFilial: carregado && lojas.length === 0,
    isLoading: !carregado,
  };
}
