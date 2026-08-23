// ============================================================
// Promissórias — emissão, impressão e baixa.
//
// A promissória impressa é título executivo extrajudicial: o texto
// segue a fórmula legal (Decreto 2.044/1908 + LUG) com valor por
// extenso obrigatório. O cliente assina no balcão e a loja guarda
// a via; aqui fica o registro e a reimpressão.
// ============================================================

import { useMemo, useState } from "react";
import { FileText, Loader2, Plus, Printer, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  usePromissorias, useClientes, useLojas, isSupabaseConfigured, supabase,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { valorPorExtenso } from "@/lib/extenso";

function htmlPromissoria(p: {
  numero: string; valor: number; extenso: string; vencimento: string;
  devedorNome: string; devedorDoc: string; devedorEndereco: string;
  credorNome: string; credorCnpj: string; praca: string;
}) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const venc = new Date(p.vencimento + "T12:00:00").toLocaleDateString("pt-BR");
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Nota Promissória ${esc(p.numero)}</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#111;line-height:1.7}
  .caixa{border:2px solid #111;padding:28px 32px}
  .topo{display:flex;justify-content:space-between;font-size:14px;margin-bottom:14px}
  h1{text-align:center;font-size:20px;letter-spacing:4px;margin:6px 0 18px}
  .valor{font-size:18px;font-weight:bold}
  .texto{text-align:justify;font-size:15px}
  .extenso{text-transform:uppercase;font-weight:bold}
  .dados{margin-top:22px;font-size:14px}
  .ass{margin-top:64px;text-align:center}
  .linha{border-top:1px solid #111;width:70%;margin:0 auto;padding-top:6px;font-size:13px}
  @media print{body{margin:10mm auto}}
</style></head><body><div class="caixa">
  <div class="topo"><span>Nº ${esc(p.numero)}</span><span>Vencimento: <b>${venc}</b></span><span class="valor">${brl(p.valor)}</span></div>
  <h1>NOTA PROMISSÓRIA</h1>
  <p class="texto">No dia <b>${venc}</b> pagarei por esta única via de NOTA PROMISSÓRIA
  a <b>${esc(p.credorNome)}</b>, CNPJ ${esc(p.credorCnpj)}, ou à sua ordem, a quantia de
  <b>${brl(p.valor)}</b> (<span class="extenso">${esc(p.extenso)}</span>),
  em moeda corrente deste país, pagável em ${esc(p.praca)}.</p>
  <div class="dados">
    <p><b>Emitente (devedor):</b> ${esc(p.devedorNome)}<br>
    <b>CPF/CNPJ:</b> ${esc(p.devedorDoc)}<br>
    <b>Endereço:</b> ${esc(p.devedorEndereco)}</p>
    <p>${esc(p.praca)}, ${hoje}.</p>
  </div>
  <div class="ass"><div class="linha">Assinatura do emitente</div></div>
</div>
<script>window.onload = () => window.print();</scr` + `ipt></body></html>`;
}

export function PromissoriaPage() {
  const { lojaId } = useAutoSelectLoja();
  const qc = useQueryClient();
  const { data: promissorias = [], isLoading } = usePromissorias({ lojaId: lojaId ?? undefined });
  const { data: clientes = [] } = useClientes();
  const { data: lojas = [] } = useLojas();
  const loja = lojas.find((l: any) => l.id === lojaId);

  const [aberto, setAberto] = useState(false);
  const [pessoaId, setPessoaId] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const itensClientes = useMemo(() => clientes.map((c: any) => ({
    id: c.id, rotulo: c.nome_razao, detalhe: c.cpf_cnpj ?? c.telefone ?? undefined,
  })), [clientes]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Promissórias" />;

  const imprimir = (p: any) => {
    const pessoa = clientes.find((c: any) => c.id === p.pessoa_id);
    const w = window.open("", "_blank", "width=860,height=640");
    if (!w) { toast.error("Pop-up bloqueado — libere para imprimir."); return; }
    w.document.write(htmlPromissoria({
      numero: p.numero ?? "S/N",
      valor: Number(p.valor),
      extenso: p.valor_extenso ?? valorPorExtenso(Number(p.valor)),
      vencimento: p.data_vencimento,
      devedorNome: pessoa?.nome_razao ?? "—",
      devedorDoc: pessoa?.cpf_cnpj ?? "—",
      devedorEndereco: pessoa?.endereco ?? "—",
      credorNome: loja?.nome ?? "X-Life Suplementos",
      credorCnpj: loja?.cnpj ?? "—",
      praca: loja ? `${loja.cidade ?? ""}/${loja.uf ?? ""}` : "—",
    }));
    w.document.close();
  };

  const emitir = async () => {
    const v = Number(valor.replace(",", "."));
    if (!pessoaId) { toast.error("Escolha o cliente."); return; }
    if (!v || v <= 0) { toast.error("Informe um valor válido."); return; }
    if (!vencimento) { toast.error("Informe o vencimento."); return; }
    if (!lojaId) { toast.error("Selecione a loja."); return; }
    setSalvando(true);
    try {
      const numero = `PN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(promissorias.length + 1).padStart(3, "0")}`;
      const { data, error } = await supabase.from("erp_promissorias").insert({
        loja_id: lojaId,
        pessoa_id: pessoaId,
        tipo: "emitida",
        numero,
        valor: v,
        valor_extenso: valorPorExtenso(v),
        data_emissao: new Date().toISOString().slice(0, 10),
        data_vencimento: vencimento,
        status: "pendente",
        observacoes: obs || null,
      }).select().single();
      if (error) throw error;
      toast.success(`Promissória ${numero} emitida.`);
      setAberto(false);
      setPessoaId(""); setValor(""); setVencimento(""); setObs("");
      void qc.invalidateQueries({ queryKey: ["erp_promissorias"] });
      imprimir(data);
    } catch (e: any) {
      toast.error(`Erro ao emitir: ${e.message ?? e}`);
    } finally {
      setSalvando(false);
    }
  };

  const quitar = async (p: any) => {
    const { error } = await supabase.from("erp_promissorias")
      .update({ status: "paga", data_pagamento: new Date().toISOString().slice(0, 10) })
      .eq("id", p.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    toast.success(`Promissória ${p.numero ?? ""} baixada como paga.`);
    void qc.invalidateQueries({ queryKey: ["erp_promissorias"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" /> Promissórias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{promissorias.length} promissória(s)</p>
        </div>
        <Button onClick={() => setAberto(true)}><Plus className="mr-2 h-4 w-4" /> Emitir Promissória</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Promissórias Emitidas/Recebidas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : promissorias.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma promissória cadastrada</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Número</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {promissorias.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">{p.numero ?? "—"}</td>
                    <td className="p-3 text-sm">{clientes.find((c: any) => c.id === p.pessoa_id)?.nome_razao ?? "—"}</td>
                    <td className="p-3 text-sm">{p.data_vencimento ? date(p.data_vencimento) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.valor)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={p.status === "paga" ? "default" : "outline"}>{p.status}</Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => imprimir(p)} title="Imprimir">
                        <Printer className="h-4 w-4" />
                      </Button>
                      {p.status !== "paga" && (
                        <Button variant="ghost" size="sm" onClick={() => void quitar(p)} title="Dar baixa (paga)">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Emitir Nota Promissória</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cliente (devedor)</Label>
              <ComboboxBusca itens={itensClientes} value={pessoaId} onChange={setPessoaId} placeholder="Buscar cliente…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </div>
            </div>
            {valor && Number(valor.replace(",", ".")) > 0 && (
              <p className="text-xs text-muted-foreground italic">
                {valorPorExtenso(Number(valor.replace(",", ".")))}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: referente à venda 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => void emitir()} disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Emitir e imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
