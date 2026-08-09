import { create } from "zustand";

export interface Produto {
  id: string;
  nome: string;
  sku: string;
  categoria: string;
  precoCusto: number;
  precoVenda: number;
  estoqueMinimo: number;
}

interface ProductsState {
  produtos: Produto[];
  estoquePorLoja: Record<string, Record<string, number>>;
  addProduto: (p: Produto) => void;
  updateProduto: (id: string, p: Partial<Produto>) => void;
  setEstoque: (produtoId: string, lojaId: string, qty: number) => void;
  getEstoqueLoja: (produtoId: string, lojaId: string) => number;
}

const seedProdutos: Produto[] = [
  { id: "p1", nome: "Whey Protein 1kg", sku: "WHEY-1KG", categoria: "Suplementos", precoCusto: 80, precoVenda: 149.9, estoqueMinimo: 10 },
  { id: "p2", nome: "Creatina 300g", sku: "CREAT-300", categoria: "Suplementos", precoCusto: 35, precoVenda: 79.9, estoqueMinimo: 15 },
  { id: "p3", nome: "BCAA 2400mg 60 caps", sku: "BCAA-60", categoria: "Aminoácidos", precoCusto: 25, precoVenda: 59.9, estoqueMinimo: 20 },
  { id: "p4", nome: "Pré-Treino 300g", sku: "PRE-300", categoria: "Pré-Treino", precoCusto: 45, precoVenda: 99.9, estoqueMinimo: 10 },
  { id: "p5", nome: "Multivitamínico 60 caps", sku: "MULTI-60", categoria: "Vitaminas", precoCusto: 18, precoVenda: 39.9, estoqueMinimo: 25 },
];

export const useProductsStore = create<ProductsState>((set, get) => ({
  produtos: seedProdutos,
  estoquePorLoja: {
    "loja-01": { p1: 50, p2: 80, p3: 100, p4: 35, p5: 60 },
    "loja-02": { p1: 30, p2: 45, p3: 60, p4: 20, p5: 40 },
  },
  addProduto: (p) => set((s) => ({ produtos: [...s.produtos, p] })),
  updateProduto: (id, p) =>
    set((s) => ({ produtos: s.produtos.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  setEstoque: (produtoId, lojaId, qty) =>
    set((s) => ({
      estoquePorLoja: {
        ...s.estoquePorLoja,
        [lojaId]: { ...s.estoquePorLoja[lojaId], [produtoId]: qty },
      },
    })),
  getEstoqueLoja: (produtoId, lojaId) => {
    const s = get();
    return s.estoquePorLoja[lojaId]?.[produtoId] ?? 0;
  },
}));

export function useProdutos() {
  return useProductsStore((s) => s.produtos);
}

export function useEstoquePorLoja() {
  return useProductsStore((s) => s.estoquePorLoja);
}

export function getEstoqueLoja(produtoId: string, lojaId: string) {
  return useProductsStore.getState().getEstoqueLoja(produtoId, lojaId);
}