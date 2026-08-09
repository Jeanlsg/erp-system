import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Plus, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { useProdutos, useCreateVenda, useClientes, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAuth } from "@/lib/store/auth-store";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

interface CartItem { produto_id: string; nome: string; preco_unitario: number; preco_custo: number; quantidade: number; }

export function PDVPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const { data: clientes = [] } = useClientes();
  const createVenda = useCreateVenda();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [forma, setForma] = useState<"dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "crediario" | "boleto">("dinheiro");
  const [desconto, setDesconto] = useState("");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="PDV / Frente de Caixa" />;

  const filtrados = produtos.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nome.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  const adicionar = (p: any) => {
    setCart((prev) => {
      const existe = prev.find((i) => i.produto_id === p.id);
      if (existe) return prev.map((i) => i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { produto_id: p.id, nome: p.nome, preco_unitario: Number(p.preco_venda), preco_custo: Number(p.preco_custo), quantidade: 1 }];
    });
  };

  const remover = (id: string) => setCart((prev) => prev.filter((i) => i.produto_id !== id));

  const subtotal = cart.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  const desc = parseFloat(desconto) || 0;
  const total = Math.max(0, subtotal - desc);

  const finalizar = async () => {
    if (!lojaId || !user || cart.length === 0) return;
    await createVenda.mutateAsync({
      loja_id: lojaId,
      cliente_id: clienteId || null,
      usuario_id: user.id,
      subtotal,
      desconto: desc,
      total,
      custo_total: cart.reduce((s, i) => s + i.preco_custo * i.quantidade, 0),
      lucro_total: total - cart.reduce((s, i) => s + i.preco_custo * i.quantidade, 0),
      forma_pagamento: forma,
      status: "finalizada",
      tipo_venda: "pdv",
      itens: cart.map((i) => ({
        produto_id: i.produto_id,
        nome: i.nome,
        preco_unitario: i.preco_unitario,
        preco_custo: i.preco_custo,
        quantidade: i.quantidade,
        subtotal: i.preco_unitario * i.quantidade,
      })),
    });
    setCart([]);
    setDesconto("");
    alert("Venda registrada!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6" /> PDV / Frente de Caixa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{cart.length} item(ns) no carrinho</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-y-auto">
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {filtrados.slice(0, 30).map((p) => (
                <Card key={p.id} className="hover:border-primary cursor-pointer transition-colors" onClick={() => adicionar(p)}>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm line-clamp-1">{p.nome}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-semibold text-green-600">{brl(p.preco_venda)}</span>
                      <Plus className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Carrinho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Consumidor Final</option>
                {clientes.slice(0, 50).map((c) => <option key={c.id} value={c.id}>{c.nome_razao}</option>)}
              </select>
            </div>

            <div className="border rounded divide-y max-h-[280px] overflow-y-auto">
              {cart.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Carrinho vazio</p>
              ) : cart.map((i) => (
                <div key={i.produto_id} className="p-2 flex justify-between items-start gap-2">
                  <div className="flex-1 text-xs">
                    <p className="font-medium line-clamp-1">{i.nome}</p>
                    <p className="text-muted-foreground">{i.quantidade}x {brl(i.preco_unitario)} = {brl(i.quantidade * i.preco_unitario)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remover(i.produto_id)} className="h-6 w-6">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-2 border-t">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              <div>
                <Label className="text-xs">Desconto</Label>
                <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              </div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{brl(total)}</span></div>
            </div>

            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={forma} onChange={(e) => setForma(e.target.value as any)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="cartao_debito">Cartão Débito</option>
                <option value="crediario">Crediário</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>

            <Button onClick={finalizar} disabled={createVenda.isPending || cart.length === 0} className="w-full" size="lg">
              {createVenda.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar Venda"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}