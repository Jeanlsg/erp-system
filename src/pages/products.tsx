import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Plus, Search, Barcode, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { useProdutosComEstoque, useLotesVencendo, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function ProductsPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: produtos = [], isLoading } = useProdutosComEstoque(lojaId ?? undefined);
  const { data: lotesVencendo = [] } = useLotesVencendo(lojaId ?? undefined);
  const [search, setSearch] = useState("");

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Produtos" />;
  }

  if (!lojaId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtrados = produtos.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.nome.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.codigo_barras ?? "").includes(s) ||
      (p.marca ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" /> Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {produtos.length} produto(s) cadastrado(s)
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {lotesVencendo.length > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {lotesVencendo.length} lote(s) próximo(s) do vencimento
              </p>
              <p className="text-xs text-muted-foreground">
                {lotesVencendo.filter((l) => l.severidade === "vencido").length} vencido(s) ·{" "}
                {lotesVencendo.filter((l) => l.severidade === "critico").length} crítico(s)
              </p>
            </div>
            <Button variant="outline" size="sm">Ver lotes</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU, código de barras ou marca..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm">
          <Barcode className="mr-2 h-4 w-4" /> Ler código
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando produtos...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado. Cadastre produtos no Supabase."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-center">Validade</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const estoque = lojaId ? p.estoque_por_loja[lojaId] ?? 0 : 0;
                  const baixo = estoque <= p.estoque_minimo;
                  const loteVenc = lotesVencendo.find((l) => l.produto_id === p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{p.nome}</div>
                        {p.codigo_barras && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Barcode className="h-3 w-3" />
                            {p.codigo_barras}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{p.marca ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(p.preco_custo)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{brl(p.preco_venda)}</TableCell>
                      <TableCell className="text-right tabular-nums">{estoque}</TableCell>
                      <TableCell className="text-center">
                        {loteVenc ? (
                          <Badge variant={loteVenc.severidade === "vencido" ? "destructive" : loteVenc.severidade === "critico" ? "destructive" : "outline"}>
                            <Calendar className="mr-1 h-3 w-3" />
                            {loteVenc.dias_para_vencer}d
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {baixo ? <Badge variant="destructive">Baixo</Badge> : <Badge variant="outline">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}