// ============================================================
// O PDV está vendendo agora?
//
// O casco do PDV (PdvLayout) precisa saber para decidir se mostra o menu
// lateral: fora da venda — caixa fechado ou operador que saiu da frente —
// a tela é administrativa e o menu ajuda a chegar em relatórios e
// configurações; com a venda aberta, o balcão quer a tela inteira e um
// menu ao lado só convida a sair da venda sem querer.
//
// Um store minúsculo em vez de contexto: o layout é pai da página, e
// passar estado de baixo para cima por props exigiria reescrever a rota.
// ============================================================

import { create } from "zustand";

interface PdvModo {
  vendendo: boolean;
  setVendendo: (v: boolean) => void;
}

export const usePdvModo = create<PdvModo>((set) => ({
  vendendo: false,
  setVendendo: (vendendo) => set({ vendendo }),
}));
