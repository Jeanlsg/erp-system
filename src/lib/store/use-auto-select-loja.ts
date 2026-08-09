import { useEffect } from "react";
import { useLojas } from "@/lib/supabase-queries";
import { useLojaAtualStore } from "./loja-atual";

/**
 * Hook que auto-seleciona a primeira loja matriz disponível
 * caso nenhuma loja esteja selecionada. Útil em todas as páginas
 * que precisam de lojaId mas não querem forçar seleção manual.
 */
export function useAutoSelectLoja() {
  const { data: lojas = [] } = useLojas();
  const currentLojaId = useLojaAtualStore((s) => s.currentLojaId);
  const setCurrentLojaId = useLojaAtualStore((s) => s.setCurrentLojaId);

  useEffect(() => {
    if (lojas.length > 0 && !currentLojaId) {
      const matriz = lojas.find((l) => l.matriz) ?? lojas[0];
      setCurrentLojaId(matriz.id);
    }
  }, [lojas, currentLojaId, setCurrentLojaId]);

  return {
    lojaId: currentLojaId,
    lojas,
    isLoading: false, // Não bloqueia se já tem loja
  };
}