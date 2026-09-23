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
  /**
   * Qual caixa aberto a tela está operando, quando há mais de um no mesmo
   * nome (admin). Fica aqui pelo mesmo motivo do `vendendo`: o casco também
   * precisa saber, para travar o cabeçalho na loja do caixa CERTO — e não na
   * do caixa mais recente, que pode ser o outro.
   */
  caixaAtivoId: string | null;
  setCaixaAtivoId: (id: string | null) => void;
  /**
   * Há venda em andamento? O topo trava a troca de filial só nesse caso: o
   * cupom começado numa loja não pode terminar na outra.
   */
  cupomComItens: boolean;
  setCupomComItens: (v: boolean) => void;
}

export const usePdvModo = create<PdvModo>((set) => ({
  vendendo: false,
  setVendendo: (vendendo) => set({ vendendo }),
  caixaAtivoId: null,
  setCaixaAtivoId: (caixaAtivoId) => set({ caixaAtivoId }),
  cupomComItens: false,
  setCupomComItens: (cupomComItens) => set({ cupomComItens }),
}));
