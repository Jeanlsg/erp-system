import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Plus, Loader2, Lock, Unlock } from "lucide-react";
import { useCaixas, useCreateSangria, useCreateEntradaExtra, useSangrias, useEntradasExtras, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function CaixaPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const { data: caixas = [], isLoading } = useCaixas(lojaId ?? undefined);
  const { data: sangrias = [] } = useSangrias();
  const { data: entradas = [] } = useEntradasExtras();
  const createSangria = useCreateSangria();
  const createEntrada = useCreateEntradaExtra();

  const [sangriaModal, setSangriaModal] = useState(false);
  const [entradaModal, setEntradaModal] = useState(false);
  const [valorSangria, setValorSangria] = useState("");
  const [motivoSangria, setMotivoSangria] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [motivoEntrada, setMotivoEntrada] = useState("");
  const [formaEntrada, setFormaEntrada] = useState("dinheiro");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Caixa" />;

  const caixaAberto = caixas.find((c: any) => c.status === "aberto");

  const handleSangria = async () => {
    if (!caixaAberto || !valorSangria || !motivoSangria) return;
    await createSangria.mutateAsync({
      caixa_id: caixaAberto.id,
      usuario_id: user?.id,
      motivo: motivoSangria,
      valor: parseFloat(valorSangria),
    });
    setSangriaModal(false);
    setValorSangria("");
    setMotivoSangria("");
  };

  const handleEntrada = async () => {
    if (!caixaAberto || !valorEntrada || !motivoEntrada) return;
    await createEntrada.mutateAsync({
      caixa_id: caixaAberto.id,
      usuario_id: user?.id,
      motivo: motivoEntrada,
      forma_pagamento: formaEntrada,
      valor: parseFloat(valorEntrada),
    });
    setEntradaModal(false);
    setValorEntrada("");
    setMotivoEntrada("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6" /> Caixa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {caixaAberto ? `Caixa #${caixaAberto.numero_caixa ?? "—"} aberto` : "Nenhum caixa aberto"}
          </p>
        </div>
        <div className="flex gap-2">
          {caixaAberto && (
            <>
              <Button variant="outline" onClick={() => setSangriaModal(true)}>
                Sangria
              </Button>
              <Button onClick={() => setEntradaModal(true)}>
                <Plus className="mr-2 h-4 w-4" /> Entrada Extra
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Status</p>
            <p className="text-2xl font-semibold">
              {caixaAberto ? (
                <span className="text-green-600 flex items-center gap-2"><Unlock className="h-5 w-5" /> Aberto</span>
              ) : (
                <span className="text-red-600 flex items-center gap-2"><Lock className="h-5 w-5" /> Fechado</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Sangrias Hoje</p>
            <p className="text-2xl font-semibold text-red-600">{sangrias.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Entradas Extras Hoje</p>
            <p className="text-2xl font-semibold text-green-600">{entradas.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico de Caixas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : caixas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum caixa registrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº Caixa</th>
                  <th className="text-left p-3">Abertura</th>
                  <th className="text-left p-3">Fechamento</th>
                  <th className="text-right p-3">Valor Inicial</th>
                  <th className="text-right p-3">Valor Final</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {caixas.slice(0, 30).map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono">#{c.numero_caixa ?? "—"}</td>
                    <td className="p-3 text-sm">{c.data_abertura ? new Date(c.data_abertura).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3 text-sm">{c.data_fechamento ? new Date(c.data_fechamento).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(c.valor_inicial ?? 0)}</td>
                    <td className="p-3 text-right tabular-nums">{c.valor_final ? brl(c.valor_final) : "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={c.status === "aberto" ? "default" : "outline"}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={sangriaModal} onOpenChange={setSangriaModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Sangria</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={valorSangria} onChange={(e) => setValorSangria(e.target.value)} /></div>
            <div><Label>Motivo</Label><Input value={motivoSangria} onChange={(e) => setMotivoSangria(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSangriaModal(false)}>Cancelar</Button>
            <Button onClick={handleSangria} disabled={!valorSangria || !motivoSangria}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={entradaModal} onOpenChange={setEntradaModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Entrada Extra</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={valorEntrada} onChange={(e) => setValorEntrada(e.target.value)} /></div>
            <div><Label>Motivo</Label><Input value={motivoEntrada} onChange={(e) => setMotivoEntrada(e.target.value)} /></div>
            <div>
              <Label>Forma de Pagamento</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={formaEntrada} onChange={(e) => setFormaEntrada(e.target.value)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="cartao_debito">Cartão Débito</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntradaModal(false)}>Cancelar</Button>
            <Button onClick={handleEntrada} disabled={!valorEntrada || !motivoEntrada}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}