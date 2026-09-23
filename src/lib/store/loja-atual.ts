import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LojaAtualState {
  currentLojaId: string | null;
  /** null = nenhuma filial (usuário sem filial cadastrada) */
  setCurrentLojaId: (id: string | null) => void;
}

export const useLojaAtualStore = create<LojaAtualState>()(
  persist(
    (set) => ({
      currentLojaId: null,
      setCurrentLojaId: (id) => set({ currentLojaId: id }),
    }),
    {
      name: "erp-loja-atual",
    }
  )
);