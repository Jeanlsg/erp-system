// ============================================================
// Painel do Contador — o mês fiscal da filial numa tela.
//
// Pedido da loja (10/10/2026, item 6): ligar o painel aos dados. Antes ele
// mostrava "Notas fiscais emitidas: —" e dois botões "SPED" que montavam um
// arquivo de mentira a partir das vendas (registros incompletos, campos com
// "—"). O SPED de verdade é a tela Escrituração; o painel agora resume as
// notas do mês (a mesma consulta do Relatório da Contadora), as vendas sem
// nota e o financeiro do mês, e leva às telas que geram os arquivos.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Calculator, FileArchive, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useContas } from "@/lib/supabase-queries";
import { lerTudo } from "@/lib/ler-tudo";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import { useNotasDoMes } from "@/lib/notas-do-mes";
import { intervaloDoMes, notasDoRelatorio, resumoDasNotas, vendasSemNota } from "@/lib/relatorio-contadora";

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Parser simples de OFX: extrai as transações (STMTTRN). */
function parseOfx(texto: string) {
  const trans: { data: string; valor: number; memo: string }[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const dt = /<DTPOSTED>(\d{8})/i.exec(b)?.[1] ?? "";
    const valor = parseFloat(/<TRNAMT>(-?[\d.,]+)/i.exec(b)?.[1]?.replace(",", ".") ?? "0");
    const memo = /<MEMO>([^<\r\n]+)/i.exec(b)?.[1]?.trim() ?? "";
    if (dt) trans.push({ data: `${dt.slice(6, 8)}/${dt.slice(4, 6)}/${dt.slice(0, 4)}`, valor, memo });
  }
  return trans;
}

export function PainelContadorPage() {
  const { lojaId, lojas } = useAutoSelectLoja();
  const loja = (lojas as any[]).find((l) => l.id === lojaId) ?? null;
  const [mes, setMes] = useState(mesAtual());
  const [incluirHomologacao, setIncluirHomologacao] = useState(false);
  const [ofxTrans, setOfxTrans] = useState<{ data: string; valor: number; memo: string }[] | null>(null);

  const { data, isLoading } = useNotasDoMes(lojaId, mes);
  const { de, ate } = /^\d{4}-\d{2}$/.test(mes) ? intervaloDoMes(mes) : { de: "", ate: "" };

  const { data: vendas = [] } = useQuery({
    queryKey: ["erp_painel_contador_vendas", lojaId, mes],
    enabled: !!lojaId && !!de,
    queryFn: () => lerTudo<{ id: string; total: number; status: string }>(() => supabase.from("erp_vendas")
      .select("id, total, status").eq("loja_id", lojaId!).gte("data_venda", de).lt("data_venda", ate)
      .order("data_venda").order("id")),
  });
  const { data: contas = [] } = useContas({
    lojaId: lojaId ?? undefined, status: "paga", campoData: "pagamento",
    dataInicio: de ? de.slice(0, 10) : undefined,
    dataFim: ate ? new Date(new Date(ate).getTime() - 1).toLocaleDateString("sv-SE") : undefined,
  });

  const notas = useMemo(() => notasDoRelatorio(data?.notas ?? [], incluirHomologacao), [data, incluirHomologacao]);
  const resumo = resumoDasNotas(notas);
  const inutilizacoes = (data?.inutilizacoes ?? []).filter((i) => incluirHomologacao || i.ambiente === "producao");
  const entradas = data?.entradas ?? [];
  const finalizadas = vendas.filter((v) => v.status === "finalizada");
  const semNota = vendasSemNota(vendas, data?.notas ?? [], incluirHomologacao);
  const recebido = contas.filter((c: any) => c.tipo === "receber").reduce((s: number, c: any) => s + Number(c.valor_pago ?? c.valor), 0);
  const pago = contas.filter((c: any) => c.tipo === "pagar").reduce((s: number, c: any) => s + Number(c.valor_pago ?? c.valor), 0);
  const tipo = (r: string) => resumo.porTipo.find((t) => t.rotulo === r) ?? { quantidade: 0, valor: 0 };

  const importarOfx = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ofx,.OFX,.txt";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const trans = parseOfx(await file.text());
      if (trans.length === 0) { toast.error("Nenhuma transação encontrada no arquivo OFX."); return; }
      setOfxTrans(trans);
    };
    input.click();
  };
  /** Concilia transação do extrato com contas do mês pelo valor. */
  const conciliar = (valor: number) => contas.find((c: any) => Math.abs(Number(c.valor_pago ?? c.valor) - Math.abs(valor)) < 0.01);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Painel do Contador" />;

  const blocos: [string, string, string, string][] = [
    ["NFC-e autorizadas", String(tipo("NFC-e").quantidade), brl(tipo("NFC-e").valor), "bg-green-600"],
    ["NF-e autorizadas", String(tipo("NF-e").quantidade), brl(tipo("NF-e").valor), "bg-green-700"],
    ["Devoluções", String(tipo("Devolução").quantidade), brl(tipo("Devolução").valor), "bg-neutral-800"],
    ["Canceladas", String(resumo.canceladas), "", resumo.canceladas ? "bg-red-600" : "bg-neutral-800"],
    ["Inutilizações", String(inutilizacoes.length), "", "bg-neutral-800"],
    ["Notas de entrada", String(entradas.length), brl(entradas.reduce((s: number, e: any) => s + (Number(e.valor_total) || 0), 0)), "bg-neutral-800"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Briefcase className="h-6 w-6" /> Painel do Contador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O mês fiscal desta loja ({loja?.apelido ?? "—"}{loja?.cnpj ? ` · CNPJ ${loja.cnpj}` : ""}): notas, vendas sem nota e financeiro.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div><Label className="text-xs">Mês</Label><Input type="month" className="mt-1 h-10 w-44" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={incluirHomologacao} onChange={(e) => setIncluirHomologacao(e.target.checked)} />
            Incluir notas de homologação (teste, sem valor fiscal)
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {blocos.map(([rotulo, qtd, valor, cor]) => (
          <div key={rotulo} className={`rounded-lg px-4 py-3 text-white ${cor}`}>
            <p className="text-[11px] uppercase opacity-80">{rotulo}</p>
            <p className="text-2xl font-bold tabular-nums">{isLoading ? "…" : qtd}</p>
            {valor && <p className="text-xs tabular-nums opacity-90">{valor}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Vendas do mês</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between border-b py-2"><span>Vendas finalizadas</span>
              <span className="font-semibold tabular-nums">{finalizadas.length} · {brl(finalizadas.reduce((s, v) => s + (Number(v.total) || 0), 0))}</span></div>
            <div className="flex justify-between border-b py-2"><span>Valor em notas autorizadas</span>
              <span className="font-semibold tabular-nums">{brl(resumo.valorAutorizado)}</span></div>
            <div className="flex justify-between py-2"><span>Vendas sem nota autorizada</span>
              <span className={`font-semibold tabular-nums ${semNota.quantidade ? "text-red-600" : ""}`}>{semNota.quantidade} · {brl(semNota.valor)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contas pagas e recebidas no mês</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between border-b py-2"><span>Contas a receber que foram recebidas</span><span className="font-semibold tabular-nums text-green-700">{brl(recebido)}</span></div>
            <div className="flex justify-between border-b py-2"><span>Contas a pagar que foram pagas</span><span className="font-semibold tabular-nums text-red-600">{brl(pago)}</span></div>
            <div className="flex justify-between py-2"><span>Saldo</span><span className="font-semibold tabular-nums">{brl(recebido - pago)}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <FileArchive className="mx-auto mb-2 h-10 w-10 text-red-600" />
            <p className="font-semibold">Relatório e XML do mês</p>
            <p className="mt-1 text-xs text-muted-foreground">Imprimir e baixar o ZIP para a contadora</p>
            <Button asChild variant="outline" size="sm" className="mt-3"><Link to={`/fiscal/relatorio-contadora?mes=${mes}`}>Abrir</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Calculator className="mx-auto mb-2 h-10 w-10 text-neutral-800 dark:text-neutral-200" />
            <p className="font-semibold">Escrituração (SPED)</p>
            <p className="mt-1 text-xs text-muted-foreground">EFD ICMS/IPI e SINTEGRA</p>
            <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/fiscal/escrituracao">Abrir</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="mx-auto mb-2 h-10 w-10 text-green-600" />
            <p className="font-semibold">Conciliação bancária</p>
            <p className="mt-1 text-xs text-muted-foreground">Extrato OFX contra as contas pagas no mês</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={importarOfx}><Upload className="mr-1 h-3 w-3" /> Importar OFX</Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!ofxTrans} onOpenChange={(o) => !o && setOfxTrans(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Conciliação Bancária — {ofxTrans?.length ?? 0} transação(ões)</DialogTitle><DialogClose /></DialogHeader>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-right">Valor</th><th className="p-2 text-center">Conciliação</th></tr>
              </thead>
              <tbody>
                {(ofxTrans ?? []).map((tr, i) => {
                  const match = conciliar(tr.valor);
                  return (
                    <tr key={i} className="border-b">
                      <td className="p-2">{tr.data}</td>
                      <td className="p-2">{tr.memo || "—"}</td>
                      <td className={`p-2 text-right tabular-nums ${tr.valor < 0 ? "text-red-600" : "text-green-600"}`}>{brl(tr.valor)}</td>
                      <td className="p-2 text-center">
                        {match ? <Badge className="text-[10px]">{match.descricao}</Badge> : <Badge variant="outline" className="text-[10px]">sem correspondência</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PainelContadorPage;
