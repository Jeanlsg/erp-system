import { create } from "zustand";

export interface Loja {
  id: string;
  nome: string;
  apelido: string;
  cnpj: string;
  matriz: boolean;
}

interface StoresState {
  lojas: Loja[];
  currentLojaId: string;
  setCurrentLojaId: (id: string) => void;
  addLoja: (loja: Loja) => void;
}

const defaultLojas: Loja[] = [
  { id: "loja-01", nome: "Loja 01 - Centro", apelido: "Centro", cnpj: "12.345.678/0001-90", matriz: true },
  { id: "loja-02", nome: "Loja 02 - Shopping", apelido: "Shopping", cnpj: "12.345.678/0002-71", matriz: false },
];

export const useStoresStore = create<StoresState>((set) => ({
  lojas: defaultLojas,
  currentLojaId: "loja-01",
  setCurrentLojaId: (id) => set({ currentLojaId: id }),
  addLoja: (loja) => set((s) => ({ lojas: [...s.lojas, loja] })),
}));

export function useCurrentLojaId() {
  return useStoresStore((s) => s.currentLojaId);
}

export function useLojas() {
  return useStoresStore((s) => s.lojas);
}