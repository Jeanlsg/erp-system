// ============================================================
// Ficha do produto — custo, preço, estoque e toda a movimentação numa tela.
//
// Pedido da loja (10/10/2026, vídeo do "histórico de alteração" do sistema
// anterior): clicar no produto e poder alterar custo, preço de venda e
// estoque (reposição, ajuste) e ver o que saiu por venda e o dia que entrou,
// escolhendo o período e imprimindo. Regras em src/lib/ficha-produto.ts.
//
// Tudo é da filial do seletor do topo: estoque e movimentação são por loja.
// ============================================================

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, History, Loader2, PackagePlus, Printer, Save, SlidersHorizontal, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useFichaProduto, useMovimentosDoProduto, useUpdateProduto, useAjustarEstoque, useReporEstoque,
  useAuditoria, useUsuarios, isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import {
  ROTULO_CAMPO_PRECO, TIPOS_MOVIMENTO, alteracoesDePreco, htmlFichaProduto, resumoMovimentos, rotuloOrigem, sinalDoMovimento,
} from "@/lib/ficha-produto";
import { precoAtacadoNoPayload, precoAtacadoOriginal } from "@/lib/preco-atacado";

// Data LOCAL (AAAA-MM-DD). toISOString() é UTC: à noite em Recife já é o dia
// seguinte, e a tela mostrava "até amanhã".
const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoje = () => dataLocal(new Date());
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dataLocal(d); };

export function ProdutoFichaPage() {
  const { id } = useParams<{ id: string }>();
  const { lojaId, lojas } = useAutoSelectLoja();
  const lojaAtual = (lojas as any[]).find((l) => l.id === lojaId) ?? null;
  const { can } = useAuth();
  const [de, setDe] = useState(diasAtras(30));
  const [ate, setAte] = useState(hoje());

  const { data: ficha, isLoading } = useFichaProduto(id, lojaId);
  const { data: movimentos = [], isLoading: carregandoMov } = useMovimentosDoProduto(id, lojaId, de, ate);
  const podeVerPrecos = can("produto.editar");
  const { data: auditoria = [] } = useAuditoria({ tabela: "erp_produtos", registroId: id, limite: 500 });
  const { data: usuarios = [] } = useUsuarios();
  const nomeUsuario = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usuarios as any[]) m.set(u.id, u.nome ?? u.email);
    return (uid?: string | null) => (uid ? m.get(uid) ?? "—" : "Sistema");
  }, [usuarios]);

  const atualizar = useUpdateProduto();
  const ajustar = useAjustarEstoque();
  const repor = useReporEstoque();

  const produto = ficha?.produto;
  const estoque = Number(ficha?.estoque?.quantidade ?? 0);
  // Produto importado por planilha tem custo no cadastro e custo médio zerado
  // na loja (nenhuma entrada com custo ainda): mostra o do cadastro.
  const custoMedioLoja = Number(ficha?.estoque?.custo_medio) || 0;
  const custoMedio = custoMedioLoja || Number(produto?.preco_custo ?? 0);

  // ---- preços ----
  const [custo, setCusto] = useState<number | "">("");
  const [venda, setVenda] = useState<number | "">("");
  const custoTela = custo === "" ? Number(produto?.preco_custo ?? 0) : custo;
  const vendaTela = venda === "" ? Number(produto?.preco_venda ?? 0) : venda;
  const margem = vendaTela > 0 ? ((vendaTela - custoTela) / vendaTela) * 100 : 0;
  // Atacado (migration 115) é opcional: vazio = sem atacado, então "" não
  // serve de "não mexi" como nos dois de cima — undefined é que serve.
  const [atacado, setAtacado] = useState<number | "" | undefined>(undefined);
  const atacadoGravado = precoAtacadoOriginal(produto);
  const atacadoTela = atacado === undefined ? (atacadoGravado ?? "") : atacado;
  const atacadoPayload = precoAtacadoNoPayload(String(atacadoTela), atacadoGravado);
  const atacadoMudou = atacado !== undefined && (!atacadoPayload.ok || "preco_atacado" in atacadoPayload.campos);
  const precoMudou = produto && (
    ((custo !== "" || venda !== "")
      && (Number(custoTela) !== Number(produto.preco_custo) || Number(vendaTela) !== Number(produto.preco_venda)))
    || atacadoMudou);

  const salvarPrecos = async () => {
    if (!produto) return;
    if (!atacadoPayload.ok) { toast.error(atacadoPayload.erro); return; }
    try {
      await atualizar.mutateAsync({
        id: produto.id, preco_custo: Number(custoTela), preco_venda: Number(vendaTela), ...atacadoPayload.campos,
      } as any);
      setCusto(""); setVenda(""); setAtacado(undefined);
      toast.success("Preços salvos. A alteração fica no histórico abaixo.");
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
  };

  // ---- estoque ----
  const [modo, setModo] = useState<"repor" | "ajustar" | null>(null);
  const [qtd, setQtd] = useState("");
  const [custoRepo, setCustoRepo] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const confirmarEstoque = async () => {
    if (!produto || !lojaId) return;
    const n = parseInt(qtd, 10);
    try {
      if (modo === "repor") {
        if (!(n > 0)) { toast.error("Informe a quantidade que entrou."); return; }
        await repor.mutateAsync({ lojaId, produtoId: produto.id, quantidade: n, custo: custoRepo === "" ? null : Number(custoRepo) });
        toast.success(`Reposição de ${n} lançada.`);
      } else {
        if (!(n >= 0)) { toast.error("Informe a quantidade contada."); return; }
        if (motivo.trim().length < 3) { toast.error("Informe o motivo do ajuste."); return; }
        await ajustar.mutateAsync({ lojaId, produtoId: produto.id, novaQuantidade: n, observacao: motivo.trim() });
        toast.success(`Estoque ajustado para ${n}.`);
      }
      setModo(null); setQtd(""); setCustoRepo(""); setMotivo("");
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
  };

  const resumo = resumoMovimentos(movimentos);
  const historicoPreco = alteracoesDePreco(auditoria as any[]);

  const imprimir = () => {
    if (!produto) return;
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) { toast.error("Libere pop-ups deste site para imprimir."); return; }
    w.document.write(htmlFichaProduto({
      produto, loja: lojaAtual?.apelido ?? lojaAtual?.nome ?? "", de, ate, estoque, custo: custoMedio,
      preco: Number(produto.preco_venda ?? 0),
      atacado: atacadoGravado,
      movimentos: movimentos.map((m: any) => ({ ...m, usuario: nomeUsuario(m.usuario_id) })),
    }));
    w.document.close();
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Ficha do produto" />;
  if (isLoading) return <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!produto) return <div className="p-10 text-center text-muted-foreground">Produto não encontrado.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/produtos-estoque-lotes" className="mb-1 inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3 w-3" /> Estoque Produtos
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{produto.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {[produto.sku && `SKU ${produto.sku}`, produto.codigo_barras && `Cód. barras ${produto.codigo_barras}`, lojaAtual?.apelido].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button variant="outline" onClick={imprimir}><Printer className="mr-1 h-4 w-4" /> Imprimir movimentação</Button>
      </div>

      {/* Números do produto nesta loja */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Estoque atual", String(estoque), estoque <= 0 ? "bg-red-600" : "bg-neutral-800"],
          [custoMedioLoja ? "Custo médio" : "Custo (cadastro)", brl(custoMedio), "bg-neutral-800"],
          ["Preço de venda", brl(produto.preco_venda), "bg-neutral-800"],
          ["Margem", `${margem.toFixed(1)}%`, margem < 20 ? "bg-red-600" : "bg-green-600"],
        ].map(([rot, val, cor]) => (
          <div key={rot} className={`rounded-lg px-4 py-3 text-white ${cor}`}>
            <p className="text-[11px] uppercase opacity-80">{rot}</p>
            <p className="text-2xl font-bold tabular-nums">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Preços */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Custo e preços</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!podeVerPrecos && <p className="text-xs text-muted-foreground">Seu usuário não pode alterar preços.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><Label className="text-xs">Preço de custo</Label>
                <InputMoeda className="mt-1" value={custoTela} disabled={!podeVerPrecos} onChange={(v) => setCusto(v === "" ? 0 : v)} /></div>
              <div><Label className="text-xs">Preço de venda</Label>
                <InputMoeda className="mt-1" value={vendaTela} disabled={!podeVerPrecos} onChange={(v) => setVenda(v === "" ? 0 : v)} /></div>
              <div><Label className="text-xs">Valor de atacado</Label>
                <InputMoeda className="mt-1" value={atacadoTela} placeholder="Sem atacado" disabled={!podeVerPrecos} onChange={setAtacado} /></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Margem com estes valores: <b>{margem.toFixed(1)}%</b></span>
              <Button size="sm" disabled={!precoMudou || atualizar.isPending} onClick={() => void salvarPrecos()}>
                {atualizar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Salvar preços
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estoque */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Estoque nesta loja</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={modo === "repor" ? "default" : "outline"} onClick={() => setModo(modo === "repor" ? null : "repor")} disabled={!can("estoque.ajustar")}>
                <PackagePlus className="mr-1 h-4 w-4" /> Reposição (entrada)
              </Button>
              <Button size="sm" variant={modo === "ajustar" ? "default" : "outline"} onClick={() => setModo(modo === "ajustar" ? null : "ajustar")} disabled={!can("estoque.ajustar")}>
                <SlidersHorizontal className="mr-1 h-4 w-4" /> Ajustar contagem
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/estoque.transferencia"><ArrowLeftRight className="mr-1 h-4 w-4" /> Transferir para outra loja</Link>
              </Button>
            </div>
            {modo && (
              <div className="space-y-2 rounded-md border-2 border-red-600/60 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{modo === "repor" ? "Quantidade que entrou" : "Quantidade contada (novo saldo)"}</Label>
                    <Input className="mt-1" type="number" min="0" step="1" value={qtd} onChange={(e) => setQtd(e.target.value)} />
                  </div>
                  {modo === "repor" ? (
                    <div><Label className="text-xs">Custo unitário (opcional)</Label>
                      <InputMoeda className="mt-1" value={custoRepo} onChange={setCustoRepo} /></div>
                  ) : (
                    <div><Label className="text-xs">Motivo *</Label>
                      <Input className="mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: contagem do balanço" /></div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {modo === "repor"
                    ? "Entra no Kardex como Reposição. Com custo informado, o custo médio da loja é recalculado."
                    : `Saldo atual ${estoque}. O ajuste entra no Kardex com o motivo e o seu usuário.`}
                </p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setModo(null)}>Cancelar</Button>
                  <Button size="sm" onClick={() => void confirmarEstoque()} disabled={repor.isPending || ajustar.isPending}>
                    {(repor.isPending || ajustar.isPending) && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Confirmar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movimentação */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle className="text-base">Movimentação do produto</CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <div><Label className="text-xs">De</Label><Input type="date" className="mt-1 h-9" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" className="mt-1 h-9" value={ate} min={de} onChange={(e) => setAte(e.target.value)} /></div>
              {[["7 dias", 7], ["30 dias", 30], ["90 dias", 90]].map(([r, n]) => (
                <Button key={r} size="sm" variant="outline" className="h-9" onClick={() => { setDe(diasAtras(n as number)); setAte(hoje()); }}>{r}</Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className="text-green-700">Entradas: {resumo.entradas}</Badge>
            <Badge variant="outline" className="text-red-700">Saídas: {resumo.saidas}</Badge>
            <Badge variant="outline">Vendidas: {resumo.vendidas}</Badge>
            <Badge variant="outline">Movimentos: {movimentos.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Origem</th>
                  <th className="p-2 text-right">Qtd</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Custo un.</th>
                  <th className="p-2 text-left">Usuário / observação</th>
                </tr>
              </thead>
              <tbody>
                {carregandoMov ? (
                  <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : movimentos.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma movimentação no período.</td></tr>
                ) : movimentos.map((m: any) => {
                  const s = sinalDoMovimento(m);
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{TIPOS_MOVIMENTO[m.tipo] ?? m.tipo}</td>
                      <td className="p-2">{rotuloOrigem(m.origem)}</td>
                      <td className={`p-2 text-right font-semibold tabular-nums ${s > 0 ? "text-green-700" : "text-red-700"}`}>{s > 0 ? "+" : "−"}{Math.abs(m.quantidade)}</td>
                      <td className="p-2 text-right tabular-nums">{m.saldo_anterior} → {m.saldo_posterior}</td>
                      <td className="p-2 text-right tabular-nums">{m.custo_unitario != null ? brl(m.custo_unitario) : "—"}</td>
                      <td className="p-2 text-xs">{nomeUsuario(m.usuario_id)}{m.observacao ? ` · ${m.observacao}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de preço e custo (auditoria: só admin/gerente leem) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Histórico de preços e custo</CardTitle></CardHeader>
        <CardContent>
          {historicoPreco.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma alteração registrada{can("usuario.ver") ? "." : " (o histórico só aparece para administrador e gerente)."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Campo</th><th className="p-2 text-right">Antes</th><th className="p-2 text-right">Depois</th><th className="p-2 text-left">Usuário</th></tr></thead>
              <tbody>
                {historicoPreco.map((h, k) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="p-2 whitespace-nowrap">{new Date(h.data).toLocaleString("pt-BR")}</td>
                    <td className="p-2">{ROTULO_CAMPO_PRECO[h.campo]}</td>
                    <td className="p-2 text-right tabular-nums">{h.antes == null ? "—" : brl(h.antes)}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{h.depois == null ? "—" : brl(h.depois)}</td>
                    <td className="p-2">{nomeUsuario(h.usuario_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProdutoFichaPage;
