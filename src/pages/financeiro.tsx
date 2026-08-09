import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Plus, Download, Loader2 } from "lucide-react";
import { brl, date } from "@/lib/format";
import { useContas, useCreateConta, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function FinanceiroPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: contas = [], isLoading } = useContas({ lojaId: lojaId ?? undefined });
  const createConta = useCreateConta();
  const [modalAberto, setModalAberto] = useState(false);
  const [tipo, setTipo] = useState<"pagar" | "receber">("pagar");
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    data_vencimento: "",
    categoria: "",
    pessoa_id: "",
  });

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Financeiro" />;
  }

  if (!lojaId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleCriar = async () => {
    if (!lojaId) return;
    await createConta.mutateAsync({
      loja_id: lojaId,
      tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento,
      categoria: form.categoria || null,
      status: "pendente",
    });
    setModalAberto(false);
    setForm({ descricao: "", valor: "", data_vencimento: "", categoria: "", pessoa_id: "" });
  };

  // === MELHORIAS IDENTIFICADAS ===
  // TODO: Adicionar filtros por status (pendente, pago, vencido)
  // TODO: Adicionar filtros por categoria
  // TODO: Adicionar bulk actions (pagar múltiplas)
  // TODO: Exportar para Excel/PDF
  // TODO: Busca por descrição/pessoa
  // TODO: Recorrência de contas (mensal, semanal)
  // TODO: Dashboard de fluxo de caixa (entradas vs saídas)

  const contasPagar = contas.filter((c) => c.tipo === "pagar");
  const contasReceber = contas.filter((c) => c.tipo === "receber");
  const totalPagar = contasPagar.reduce((s, c) => s + Number(c.valor) - Number(c.valor_pago), 0);
  const totalReceber = contasReceber.reduce((s, c) => s + Number(c.valor) - Number(c.valor_pago), 0);

  const STATUS_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
    pendente: "outline", pago: "default", cancelado: "outline", vencido: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contas.length} contas registradas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button onClick={() => { setTipo("pagar"); setModalAberto(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nova Conta
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">A Pagar</p>
            <p className="text-2xl font-semibold text-red-600">{brl(totalPagar)}</p>
            <p className="text-xs text-muted-foreground">{contasPagar.length} contas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">A Receber</p>
            <p className="text-2xl font-semibold text-green-600">{brl(totalReceber)}</p>
            <p className="text-xs text-muted-foreground">{contasReceber.length} contas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Saldo</p>
            <p className={`text-2xl font-semibold ${totalReceber - totalPagar >= 0 ? "text-green-600" : "text-red-600"}`}>
              {brl(totalReceber - totalPagar)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vencidas</p>
            <p className="text-2xl font-semibold text-orange-600">
              {contas.filter((c) => c.status === "pendente" && new Date(c.data_vencimento) < new Date()).length}
            </p>
            <p className="text-xs text-muted-foreground">contas em atraso</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Contas a Pagar e Receber</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setTipo("pagar"); setModalAberto(true); }}>
                <Plus className="mr-2 h-3 w-3" /> A Pagar
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setTipo("receber"); setModalAberto(true); }}>
                <Plus className="mr-2 h-3 w-3" /> A Receber
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando contas...
            </div>
          ) : contas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma conta cadastrada
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-right p-3">Pago</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <Badge variant={c.tipo === "pagar" ? "destructive" : "default"}>
                        {c.tipo === "pagar" ? "A Pagar" : "A Receber"}
                      </Badge>
                    </td>
                    <td className="p-3 font-medium">{c.descricao}</td>
                    <td className="p-3">{date(c.data_vencimento)}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor)}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor_pago)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={STATUS_VARIANT[c.status] || "outline"}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta a {tipo === "pagar" ? "Pagar" : "Receber"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Fornecedor, Aluguel, Venda" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={createConta.isPending}>
              {createConta.isPending ? "Salvando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}