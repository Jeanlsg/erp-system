import { create } from "zustand";

export type FormaPagamento = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "crediario";

export interface VendaItem {
  produtoId: string;
  nome: string;
  precoCusto: number;
  precoUnit: number;
  descontoUnit: number;
  quantidade: number;
}

export interface Venda {
  id: string;
  lojaId: string;
  data: string;
  total: number;
  formaPagamento: FormaPagamento;
  itens: VendaItem[];
  clienteId?: string;
}

interface SalesState {
  vendas: Venda[];
  addVenda: (venda: Venda) => void;
  cancelarVenda: (id: string) => void;
}

const seedVendas: Venda[] = [
  {
    id: "v1",
    lojaId: "loja-01",
    data: new Date().toISOString(),
    total: 199.8,
    formaPagamento: "pix",
    itens: [
      { produtoId: "p1", nome: "Whey Protein 1kg", precoCusto: 80, precoUnit: 149.9, descontoUnit: 0, quantidade: 1 },
      { produtoId: "p3", nome: "BCAA 2400mg 60 caps", precoCusto: 25, precoUnit: 59.9, descontoUnit: 10, quantidade: 1 },
    ],
  },
];

export const useSalesStore = create<SalesState>((set) => ({
  vendas: seedVendas,
  addVenda: (venda) => set((s) => ({ vendas: [...s.vendas, venda] })),
  cancelarVenda: (id) => set((s) => ({ vendas: s.vendas.filter((v) => v.id !== id) })),
}));

export function useVendas() {
  return useSalesStore((s) => s.vendas);
}