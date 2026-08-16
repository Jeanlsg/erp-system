import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ClipboardCheck, Loader2, Settings2, PackageOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useEstoqueMovimentacoes, useLojas, useProdutos } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { isSupabaseConfigured } from "@/lib/supabase";

const TIPOS: Record<string, { label: string; cor: string; Icone: typeof ArrowDownCircle }> = {
  entrada:       { label: "Entrada",       cor: "text-emerald-600", Icone: ArrowDownCircle },
  saida:         { label: "Saída",         cor: "text-red-600",     Icone: ArrowUpCircle },
  ajuste:        { label: "Ajuste",        cor: "text-amber-600",   Icone: Settings2 },
  inventario:    { label: "Inventário",    cor: "text-blue-600",    Icone: ClipboardCheck },
  saldo_inicial: { label: "Saldo inicial", cor: "text-muted-foreground", Icone: PackageOpen },
};

const ORIGENS: Record<string, string> = {
  venda: "Venda",
  remessa: "Remessa",
  nfe_entrada: "NF-e de entrada",
  entrada: "Entrada",
  manual: "Manual",
  migracao: "Migração",
};

function moeda(v: number | null | undefined) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function EstoqueMovimentacoesPage() {
  const [lojaId, setLojaId] = useState<string>("todas");
  const [produtoId, setProdutoId] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const { data: lojas = [] } = useLojas();
  const { data: produtos = [] } = useProdutos();
  const { data: movimentos = [], isLoading, isError, error } = useEstoqueMovimentacoes({
    lojaId: lojaId === "todas" ? undefined : lojaId,
    produtoId: produtoId === "todos" ? undefined : produtoId,
    tipo: tipo === "todos" ? undefined : tipo,
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured />;

  const filtrados = movimentos.filter((m: any) => {
    if (!busca.trim()) return true;
    const alvo = `${m.produto?.nome ?? ""} ${m.produto?.sku ?? ""} ${m.observacao ?? ""}`.toLowerCase();
    return alvo.includes(busca.trim().toLowerCase());
  });

  const totalEntradas = filtrados
    .filter((m: any) => m.tipo === "entrada")
    .reduce((s: number, m: any) => s + Number(m.valor_total || 0), 0);
  const totalSaidas = filtrados
    .filter((m: any) => m.tipo === "saida")
    .reduce((s: number, m: any) => s + Number(m.valor_total || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Movimentações de Estoque</h1>
        <p className="text-muted-foreground">
          Livro de movimentação (kardex). Cada entrada, saída e ajuste fica registrado com saldo e
          custo do momento — o histórico não é editável; correções entram como novo ajuste.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Movimentos listados</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold tabular-nums">{filtrados.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Entradas (custo)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600 tabular-nums">{moeda(totalEntradas)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saídas (CMV)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600 tabular-nums">{moeda(totalSaidas)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Buscar produto</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, SKU ou observação" />
          </div>
          <div className="space-y-1">
            <Label>Loja</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {lojas.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Produto</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {produtos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando movimentações...
            </div>
          ) : isError ? (
            <div className="p-10 text-center text-red-600">
              Erro ao carregar movimentações: {(error as any)?.message ?? "erro desconhecido"}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhuma movimentação encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Produto</th>
                    <th className="p-3 font-medium">Tipo</th>
                    <th className="p-3 font-medium">Origem</th>
                    <th className="p-3 text-right font-medium">Qtd</th>
                    <th className="p-3 text-right font-medium">Saldo</th>
                    <th className="p-3 text-right font-medium">Custo unit.</th>
                    <th className="p-3 text-right font-medium">Custo médio</th>
                    <th className="p-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((m: any) => {
                    const info = TIPOS[m.tipo] ?? TIPOS.ajuste;
                    const Icone = info.Icone;
                    return (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="whitespace-nowrap p-3 text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{m.produto?.nome ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.produto?.sku ?? ""} {m.loja?.nome ? `· ${m.loja.nome}` : ""}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 font-medium ${info.cor}`}>
                            <Icone className="h-4 w-4" /> {info.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{ORIGENS[m.origem] ?? m.origem}</Badge>
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {m.tipo === "saida" ? "−" : "+"}{m.quantidade}
                        </td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">
                          {m.saldo_anterior} → <span className="font-medium text-foreground">{m.saldo_posterior}</span>
                        </td>
                        <td className="p-3 text-right tabular-nums">{moeda(m.custo_unitario)}</td>
                        <td className="p-3 text-right tabular-nums">{moeda(m.custo_medio_posterior)}</td>
                        <td className="p-3 text-right font-medium tabular-nums">{moeda(m.valor_total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
