// ============================================================
// Relatório da contadora — as notas do mês, impressas e em ZIP.
//
// Pedido da loja (10/10/2026): escolher o mês, ver todas as notas que
// subiram para a Receita, imprimir o relatório e mandar os XML compactados
// para a contadora. Regras em src/lib/relatorio-contadora.ts.
//
// É da filial do seletor do topo: cada loja tem CNPJ, e a contadora apura
// por CNPJ.
// ============================================================

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { zipSync, strToU8 } from "fflate";
import { Download, FileArchive, Loader2, Printer, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useNotasDoMes } from "@/lib/notas-do-mes";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import {
  caminhoNoZip, htmlRelatorioContadora, nomeDoZip, notasDoRelatorio, resumoDasNotas, rotuloNota,
} from "@/lib/relatorio-contadora";

const mesAnterior = () => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function RelatorioContadoraPage() {
  const { lojaId, lojas } = useAutoSelectLoja();
  const loja = (lojas as any[]).find((l) => l.id === lojaId) ?? null;
  // o Painel do Contador abre aqui já no mês que estava vendo
  const [params] = useSearchParams();
  const [mes, setMes] = useState(/^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? params.get("mes")! : mesAnterior());
  const [incluirHomologacao, setIncluirHomologacao] = useState(false);
  const [zipando, setZipando] = useState<string | null>(null);

  const { data, isLoading } = useNotasDoMes(lojaId, mes);

  const notas = useMemo(() => notasDoRelatorio(data?.notas ?? [], incluirHomologacao), [data, incluirHomologacao]);
  const inutilizacoes = useMemo(() => (data?.inutilizacoes ?? []).filter((i: any) => incluirHomologacao || i.ambiente === "producao"), [data, incluirHomologacao]);
  const entradas = data?.entradas ?? [];
  const resumo = resumoDasNotas(notas);
  const homologacaoNoMes = (data?.notas ?? []).filter((n) => n.ambiente !== "producao" && (n.status === "autorizada" || n.status === "cancelada")).length;

  const html = () => htmlRelatorioContadora({
    mes, loja: loja?.apelido ?? loja?.nome ?? "", cnpj: loja?.cnpj, notas, entradas, inutilizacoes, homologacao: incluirHomologacao,
  });

  const imprimir = () => {
    const w = window.open("", "_blank", "width=1100,height=850");
    if (!w) { toast.error("Libere pop-ups deste site para imprimir."); return; }
    w.document.write(html()); w.document.close();
  };

  const baixarZip = async () => {
    const arquivos: Record<string, Uint8Array> = {};
    const faltando: string[] = [];
    try {
      let k = 0;
      for (const n of notas) {
        k++; setZipando(`Baixando XML ${k} de ${notas.length}…`);
        if (!n.xml_path) { faltando.push(`${rotuloNota(n)} ${n.numero}`); continue; }
        const { data: arq, error } = await supabase.storage.from("fiscal").download(n.xml_path);
        if (error || !arq) { faltando.push(`${rotuloNota(n)} ${n.numero}`); continue; }
        arquivos[caminhoNoZip(n)] = new Uint8Array(await arq.arrayBuffer());
      }
      // XML dos eventos (cancelamento, CC-e) das notas do relatório e das
      // inutilizações: guardados desde 10/10/2026 — os anteriores não existem
      const idsNoRelatorio = new Set(notas.map((n) => n.id));
      const arquivosExtra = [
        ...(data?.eventos ?? []).filter((ev) => idsNoRelatorio.has(ev.nota_id))
          .map((ev) => ({ path: ev.xml_path, pasta: "eventos", nome: `${ev.tipo} ${ev.nota_id.slice(0, 8)}` })),
        ...inutilizacoes.map((i) => ({ path: i.xml_path, pasta: "inutilizacoes", nome: `inutilização ${i.serie}/${i.numero_inicial}-${i.numero_final}` })),
      ];
      for (const x of arquivosExtra) {
        if (!x.path) { faltando.push(x.nome); continue; }
        const { data: arq, error } = await supabase.storage.from("fiscal").download(x.path);
        if (error || !arq) { faltando.push(x.nome); continue; }
        arquivos[`${x.pasta}/${x.path.split("/").pop()}`] = new Uint8Array(await arq.arrayBuffer());
      }
      if (entradas.length) {
        setZipando("Baixando notas de entrada…");
        const { data: xmls } = await supabase.from("erp_nfe_entrada").select("chave_acesso, numero, xml_original")
          .in("id", entradas.map((e: any) => e.id));
        for (const e of xmls ?? []) {
          if (e.xml_original) arquivos[`entradas/${e.chave_acesso || e.numero}.xml`] = strToU8(e.xml_original);
          else faltando.push(`entrada ${e.numero}`);
        }
      }
      arquivos["relatorio.html"] = strToU8(html().replace(/<script>.*?<\/script>/s, ""));
      setZipando("Compactando…");
      const zip = zipSync(arquivos, { level: 6 });
      const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = nomeDoZip(mes, loja?.apelido ?? "loja"); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`ZIP pronto: ${Object.keys(arquivos).length - 1} XML + relatório.`);
      if (faltando.length) toast.warning(`Sem XML guardado: ${faltando.join(", ")}`, { duration: 12000 });
    } catch (e: any) {
      toast.error(`Falha ao montar o ZIP: ${e?.message ?? e}`);
    } finally {
      setZipando(null);
    }
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Relatório da Contadora" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Calculator className="h-6 w-6" /> Relatório da Contadora</h1>
        <p className="text-sm text-muted-foreground">
          As notas do mês desta filial ({loja?.apelido ?? "—"}{loja?.cnpj ? ` · CNPJ ${loja.cnpj}` : ""}): imprimir e baixar todos os XML num ZIP.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div><Label className="text-xs">Mês</Label><Input type="month" className="mt-1 h-10 w-44" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={incluirHomologacao} onChange={(e) => setIncluirHomologacao(e.target.checked)} />
            Incluir notas de homologação (teste, sem valor fiscal)
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={imprimir} disabled={isLoading}><Printer className="mr-1 h-4 w-4" /> Imprimir relatório</Button>
            <Button onClick={() => void baixarZip()} disabled={isLoading || !!zipando || (notas.length + entradas.length) === 0}>
              {zipando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileArchive className="mr-1 h-4 w-4" />}
              {zipando ?? "Baixar XML (ZIP)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!incluirHomologacao && homologacaoNoMes > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20">
          {homologacaoNoMes} nota(s) de homologação neste mês ficaram de fora — não têm valor fiscal.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Autorizadas", String(resumo.autorizadas), "bg-green-600"],
          ["Canceladas", String(resumo.canceladas), resumo.canceladas ? "bg-red-600" : "bg-neutral-800"],
          ["Valor autorizado", brl(resumo.valorAutorizado), "bg-neutral-800"],
          ["Notas de entrada", String(entradas.length), "bg-neutral-800"],
          ["Inutilizações", String(inutilizacoes.length), "bg-neutral-800"],
        ].map(([r, v, c]) => (
          <div key={r} className={`rounded-lg px-4 py-3 text-white ${c}`}>
            <p className="text-[11px] uppercase opacity-80">{r}</p>
            <p className="text-xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Notas emitidas no mês</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
            <table className="w-full text-sm">
              <thead><tr><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Série/Nº</th><th className="p-2 text-left">Emissão</th><th className="p-2 text-left">Situação</th><th className="p-2 text-right">Valor</th><th className="p-2 text-left">Chave</th><th className="p-2"></th></tr></thead>
              <tbody>
                {notas.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma nota neste mês.</td></tr>
                ) : notas.map((n) => (
                  <tr key={n.id} className="border-b last:border-0">
                    <td className="p-2">{rotuloNota(n)}{n.ambiente !== "producao" && <Badge variant="outline" className="ml-1 text-[10px]">Homologação</Badge>}</td>
                    <td className="p-2 text-right tabular-nums">{n.serie}/{n.numero}</td>
                    <td className="p-2 whitespace-nowrap">{n.data_emissao ? new Date(n.data_emissao).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-2"><Badge variant={n.status === "cancelada" ? "destructive" : "default"}>{n.status}</Badge></td>
                    <td className="p-2 text-right tabular-nums">{brl(Number(n.valor_total) || 0)}</td>
                    <td className="p-2 font-mono text-[10px]">{n.chave_acesso}</td>
                    <td className="p-2 text-right">
                      {n.xml_path && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" title="Baixar este XML"
                          onClick={async () => {
                            const { data: arq } = await supabase.storage.from("fiscal").download(n.xml_path!);
                            if (!arq) { toast.error("XML não encontrado."); return; }
                            const u = URL.createObjectURL(arq); const a = document.createElement("a");
                            a.href = u; a.download = `${n.chave_acesso ?? n.numero}.xml`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000);
                          }}>
                          <Download className="h-3.5 w-3.5" />
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

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Notas de entrada (compras) no mês</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="p-2 text-left">Nº</th><th className="p-2 text-left">Fornecedor</th><th className="p-2 text-left">Emissão</th><th className="p-2 text-right">Valor</th></tr></thead>
            <tbody>
              {entradas.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma nota de entrada neste mês.</td></tr>
              ) : entradas.map((e: any) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-2">{e.numero}</td><td className="p-2">{e.emitente_nome}</td>
                  <td className="p-2">{e.data_emissao ? new Date(e.data_emissao).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{brl(Number(e.valor_total) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        O ZIP traz o XML de cada nota (pastas nfce, nfe, devolucoes, canceladas e entradas), o XML dos eventos de
        cancelamento e carta de correção (eventos), o das inutilizações (inutilizacoes) e o relatório em HTML.
        Eventos e inutilizações anteriores a 10/10/2026 não tiveram o XML guardado.
      </p>
    </div>
  );
}

export default RelatorioContadoraPage;
