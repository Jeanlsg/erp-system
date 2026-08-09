import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, AlertTriangle, Package, Search } from "lucide-react";
import { useLojaAtualStore } from "@/lib/store/loja-atual";
import { useLotes, useCreateLote, isSupabaseConfigured } from "@/lib/supabase-queries";
import { date } from "@/lib/format";

export function LotesPage() {
  const lojaId = useLojaAtualStore((s) => s.currentLojaId);
  const { data: lotes = [], isLoading } = useLotes(lojaId ?? undefined);
  const createLote = useCreateLote();
  const [search, setSearch] = useState("");
  const [novo, setNovo] = useState({
    codigo: "",
    produto_id: "",
    data_fabricacao: "",
    data_validade: "",
    quantidade: "",
  });

  // === MELHORIAS IDENTIFICADAS ===
  // TODO: Select com autocomplete de produtos
  // TODO: Trava no cadastro se validade < fabricação
  // TODO: Impressão de etiquetas de lote
  // TODO: Relatório de perdas por vencimento
  // TODO: Rastreamento de saída (venda → qual lote)
  // TODO: Alerta automático por email/whatsapp

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Calendar className="h-6 w-6" /> Lotes e Validade
        </h1>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Configure as variáveis do Supabase no arquivo <code>.env</code>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hoje = new Date();

  const filtrados = lotes.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.codigo.toLowerCase().includes(s) ||
      (l.produto_nome ?? "").toLowerCase().includes(s)
    );
  });

  const handleCriar = async () => {
    if (!lojaId || !novo.codigo || !novo.produto_id || !novo.data_validade) return;
    await createLote.mutateAsync({
      loja_id: lojaId,
      produto_id: novo.produto_id,
      codigo: novo.codigo,
      data_fabricacao: novo.data_fabricacao || null,
      data_validade: novo.data_validade,
      quantidade: parseInt(novo.quantidade) || 0,
    });
    setNovo({ codigo: "", produto_id: "", data_fabricacao: "", data_validade: "", quantidade: "" });
  };

  const lotesVencidos = lotes.filter((l) => new Date(l.data_validade) < hoje);
  const lotesCriticos = lotes.filter((l) => {
    const dias = Math.floor((new Date(l.data_validade).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return dias >= 0 && dias <= 30;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Lotes e Validade
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lotes.length} lote(s) registrado(s)
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Lote
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total de Lotes</p>
            <p className="text-2xl font-semibold">{lotes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-xs uppercase text-red-600">Vencidos</p>
            </div>
            <p className="text-2xl font-semibold text-red-600">{lotesVencidos.length}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              <p className="text-xs uppercase text-orange-600">Vencem em 30 dias</p>
            </div>
            <p className="text-2xl font-semibold text-orange-600">{lotesCriticos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Criar novo lote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastrar Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <Label>Código do Lote</Label>
              <Input
                value={novo.codigo}
                onChange={(e) => setNovo({ ...novo, codigo: e.target.value })}
                placeholder="LOTE-2026-001"
              />
            </div>
            <div>
              <Label>Produto ID</Label>
              <Input
                value={novo.produto_id}
                onChange={(e) => setNovo({ ...novo, produto_id: e.target.value })}
                placeholder="UUID do produto"
              />
            </div>
            <div>
              <Label>Fabricação</Label>
              <Input
                type="date"
                value={novo.data_fabricacao}
                onChange={(e) => setNovo({ ...novo, data_fabricacao: e.target.value })}
              />
            </div>
            <div>
              <Label>Validade</Label>
              <Input
                type="date"
                value={novo.data_validade}
                onChange={(e) => setNovo({ ...novo, data_validade: e.target.value })}
              />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                value={novo.quantidade}
                onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })}
              />
            </div>
          </div>
          <Button
            onClick={handleCriar}
            disabled={createLote.isPending || !novo.codigo || !novo.produto_id || !novo.data_validade}
            className="mt-4"
          >
            <Plus className="mr-2 h-4 w-4" /> Cadastrar
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum lote cadastrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left p-3">Código</th>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-left p-3">Fabricação</th>
                  <th className="text-left p-3">Validade</th>
                  <th className="text-center p-3">Dias</th>
                  <th className="text-right p-3">Quantidade</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const validade = new Date(l.data_validade);
                  const dias = Math.floor((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                  const vencido = dias < 0;
                  const critico = dias >= 0 && dias <= 30;
                  const alerta = dias > 30 && dias <= 60;

                  return (
                    <tr key={l.id} className={`border-b hover:bg-accent ${vencido ? "bg-red-50 dark:bg-red-950/20" : critico ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
                      <td className="p-3 font-mono text-sm">{l.codigo}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span>{l.produto_nome ?? l.produto_id}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{l.data_fabricacao ? date(l.data_fabricacao) : "—"}</td>
                      <td className="p-3 text-sm">{date(l.data_validade)}</td>
                      <td className="p-3 text-center">
                        <span className={`font-semibold ${vencido ? "text-red-600" : critico ? "text-orange-600" : "text-muted-foreground"}`}>
                          {vencido ? `${Math.abs(dias)}d atrás` : `${dias}d`}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{l.quantidade}</td>
                      <td className="p-3 text-center">
                        {vencido ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : critico ? (
                          <Badge variant="destructive">Crítico</Badge>
                        ) : alerta ? (
                          <Badge variant="outline">Alerta</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}