// ============================================================
// Importação de produtos por planilha (CSV) — a porta de entrada
// dos dados reais vindos de outro sistema.
//
// Aceita CSV com ; ou , (Excel BR exporta com ;), cabeçalho com ou
// sem acento, números no formato brasileiro (1.234,56). Produto que
// já existe (mesmo SKU ou código de barras) é PULADO e reportado —
// importar duas vezes não duplica nada. Categorias que não existem
// são criadas pelo nome. Se a planilha tiver coluna de estoque, o
// saldo entra como estoque inicial na loja escolhida.
// ============================================================

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/format";
import {
  parseCSV, parseNumeroBR, semAcento, baixarModeloCSV,
  interpretarPlanilha, type LinhaImportacao,
} from "@/lib/importar-csv";

// ---------- parse ----------
// A maquinaria de CSV (separador, acento, número e data em formato
// brasileiro) vive em @/lib/importar-csv, compartilhada com as
// importações de pessoas e de contas: uma correção lá vale para as três.

/** cabeçalho da planilha → campo do produto */
const ALIASES: Record<string, string> = {
  nome: "nome", produto: "nome", nome_produto: "nome", "nome do produto": "nome",
  sku: "sku", codigo: "sku", cod: "sku", referencia: "sku", ref: "sku", "codigo interno": "sku",
  codigo_barras: "codigo_barras", "codigo de barras": "codigo_barras", ean: "codigo_barras",
  gtin: "codigo_barras", barras: "codigo_barras",
  categoria: "categoria", grupo: "categoria",
  preco_custo: "preco_custo", custo: "preco_custo", "preco de custo": "preco_custo",
  preco_venda: "preco_venda", venda: "preco_venda", "preco de venda": "preco_venda", preco: "preco_venda",
  estoque: "estoque", quantidade: "estoque", qtd: "estoque", saldo: "estoque",
  estoque_minimo: "estoque_minimo", minimo: "estoque_minimo", "estoque minimo": "estoque_minimo",
  ncm: "ncm", cest: "cest", csosn: "csosn", cfop: "cfop_padrao", cfop_padrao: "cfop_padrao",
  unidade: "unidade", un: "unidade", marca: "marca",
  validade_dias: "duracao_dias", duracao_dias: "duracao_dias", "validade em dias": "duracao_dias",
};

function validar(d: Record<string, string>): string[] {
  const erros: string[] = [];
  if (!d.nome) erros.push("sem nome");
  const venda = parseNumeroBR(d.preco_venda ?? "");
  if (venda === null || venda <= 0) erros.push("preço de venda ausente ou inválido");
  return erros;
}

const MODELO_CSV =
  "nome;sku;codigo_barras;categoria;preco_custo;preco_venda;estoque;estoque_minimo;ncm;cest;csosn;unidade;marca;validade_dias\n" +
  "Whey Protein 900g Chocolate;WHEY-900-CHOC;7891234567890;Proteinas;89,90;149,90;10;3;21061000;1706200;102;UN;Marca X;540\n" +
  "Creatina 300g;CREAT-300;7899876543210;Creatinas;45,00;119,90;15;5;21069090;1706200;102;UN;Marca Y;720\n";

// ---------- componente ----------

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lojas: any[];
  lojaIdInicial?: string | null;
  categorias: any[];
}

export function ImportarProdutosDialog({ open, onOpenChange, lojas, lojaIdInicial, categorias }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [itens, setItens] = useState<LinhaImportacao[]>([]);
  const [lojaEstoque, setLojaEstoque] = useState<string>(lojaIdInicial ?? "");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string[] | null>(null);

  const validos = useMemo(() => itens.filter((i) => i.erros.length === 0), [itens]);
  const invalidos = useMemo(() => itens.filter((i) => i.erros.length > 0), [itens]);
  const temEstoque = useMemo(() => validos.some((i) => i.dados.estoque), [validos]);

  const lerArquivo = async (arquivo: File) => {
    setResultado(null);
    setNomeArquivo(arquivo.name);
    const texto = await arquivo.text();
    const { itens: parsed, planilhaInvalida } = interpretarPlanilha(
      parseCSV(texto), ALIASES, "nome", validar,
    );
    if (planilhaInvalida) {
      toast.error("Planilha sem coluna de nome do produto — baixe o modelo para ver o formato.");
      setItens([]);
      return;
    }
    setItens(parsed);
  };

  const importar = async () => {
    if (validos.length === 0) { toast.error("Nenhuma linha válida para importar."); return; }
    if (temEstoque && !lojaEstoque) { toast.error("Escolha a loja que recebe o estoque inicial."); return; }
    setImportando(true);
    try {
      // ---- duplicados: por SKU e código de barras já cadastrados ----
      const { data: existentes, error: exErr } = await supabase
        .from("erp_produtos").select("sku, codigo_barras");
      if (exErr) throw exErr;
      const skusEx = new Set((existentes ?? []).map((p: any) => p.sku?.toUpperCase()).filter(Boolean));
      const eansEx = new Set((existentes ?? []).map((p: any) => p.codigo_barras).filter(Boolean));

      // ---- categorias: cria as que faltam ----
      const catPorNome = new Map(categorias.map((c: any) => [semAcento(c.nome), c.id]));
      const catsNovas = Array.from(new Set(
        validos.map((i) => i.dados.categoria).filter((c): c is string => !!c && !catPorNome.has(semAcento(c))),
      ));
      for (const nome of catsNovas) {
        const { data, error } = await supabase.from("erp_categorias")
          .insert({ nome, ativo: true }).select("id, nome").single();
        if (error) throw new Error(`categoria "${nome}": ${error.message}`);
        catPorNome.set(semAcento(data.nome), data.id);
      }

      // ---- monta as linhas, pulando existentes e duplicadas na planilha ----
      const puladas: string[] = [];
      const vistoSku = new Set<string>();
      const agora = Date.now().toString(36).toUpperCase();
      const paraInserir: any[] = [];
      const estoquePorSku = new Map<string, number>();
      validos.forEach((i, idx) => {
        const d = i.dados;
        const sku = (d.sku ?? `IMP-${agora}-${String(idx + 1).padStart(4, "0")}`).toUpperCase();
        if (skusEx.has(sku)) { puladas.push(`linha ${i.linha}: SKU ${sku} já cadastrado`); return; }
        if (d.codigo_barras && eansEx.has(d.codigo_barras)) {
          puladas.push(`linha ${i.linha}: código de barras ${d.codigo_barras} já cadastrado`); return;
        }
        if (vistoSku.has(sku)) { puladas.push(`linha ${i.linha}: SKU ${sku} repetido na planilha`); return; }
        vistoSku.add(sku);
        const estoque = parseNumeroBR(d.estoque ?? "");
        if (estoque && estoque > 0) estoquePorSku.set(sku, estoque);
        paraInserir.push({
          sku,
          nome: d.nome,
          codigo_barras: d.codigo_barras ?? null,
          categoria_id: d.categoria ? catPorNome.get(semAcento(d.categoria)) ?? null : null,
          preco_custo: parseNumeroBR(d.preco_custo ?? "") ?? 0,
          preco_venda: parseNumeroBR(d.preco_venda!) ?? 0,
          estoque_minimo: parseNumeroBR(d.estoque_minimo ?? "") ?? 0,
          ncm: d.ncm ?? null,
          cest: d.cest ?? null,
          csosn: d.csosn ?? "102",
          cfop_padrao: d.cfop_padrao ?? "5102",
          unidade: d.unidade ?? "UN",
          marca: d.marca ?? null,
          duracao_dias: parseNumeroBR(d.duracao_dias ?? "") ?? null,
          ativo: true,
        });
      });

      // ---- insere em lotes ----
      let inseridos = 0;
      const inseridosIds = new Map<string, string>(); // sku → id
      for (let i = 0; i < paraInserir.length; i += 200) {
        const lote = paraInserir.slice(i, i + 200);
        const { data, error } = await supabase.from("erp_produtos")
          .insert(lote).select("id, sku");
        if (error) throw new Error(`inserção (lote ${i / 200 + 1}): ${error.message}`);
        (data ?? []).forEach((p: any) => inseridosIds.set(p.sku, p.id));
        inseridos += lote.length;
      }

      // ---- estoque inicial ----
      let comEstoque = 0;
      if (lojaEstoque && estoquePorSku.size > 0) {
        const linhas = Array.from(estoquePorSku.entries())
          .filter(([sku]) => inseridosIds.has(sku))
          .map(([sku, qtd]) => ({
            produto_id: inseridosIds.get(sku)!,
            loja_id: lojaEstoque,
            quantidade: qtd,
          }));
        for (let i = 0; i < linhas.length; i += 200) {
          const { error } = await supabase.from("erp_estoque")
            .upsert(linhas.slice(i, i + 200), { onConflict: "produto_id,loja_id" });
          if (error) throw new Error(`estoque inicial: ${error.message}`);
        }
        comEstoque = linhas.length;
      }

      const resumo = [
        `${inseridos} produto(s) importado(s)`,
        ...(catsNovas.length ? [`${catsNovas.length} categoria(s) criada(s): ${catsNovas.join(", ")}`] : []),
        ...(comEstoque ? [`${comEstoque} produto(s) com estoque inicial na loja escolhida`] : []),
        ...(invalidos.length ? [`${invalidos.length} linha(s) inválida(s) ignorada(s)`] : []),
        ...puladas.map((p) => `pulada — ${p}`),
      ];
      setResultado(resumo);
      toast.success(`Importação concluída: ${inseridos} produto(s).`);
      void qc.invalidateQueries({ queryKey: ["erp_produtos"] });
      void qc.invalidateQueries({ queryKey: ["erp_produtos_completo"] });
      void qc.invalidateQueries({ queryKey: ["erp_categorias"] });
      setItens([]);
      setNomeArquivo("");
    } catch (e: any) {
      toast.error(`Importação interrompida: ${e.message ?? e}`);
    } finally {
      setImportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setItens([]); setNomeArquivo(""); setResultado(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar Produtos (planilha)
          </DialogTitle>
          <DialogDescription>
            CSV com cabeçalho — exporte do Excel como &quot;CSV (separado por ponto e vírgula)&quot;.
            Produtos com SKU ou código de barras já cadastrados são pulados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Escolher arquivo
            </Button>
            <Button variant="ghost" onClick={() => baixarModeloCSV(MODELO_CSV, "modelo-importacao-produtos.csv")}>
              <Download className="mr-2 h-4 w-4" /> Baixar modelo
            </Button>
          </div>

          {nomeArquivo && (
            <p className="text-sm">
              <b>{nomeArquivo}</b>: {validos.length} linha(s) válida(s)
              {invalidos.length > 0 && <span className="text-destructive"> · {invalidos.length} com erro</span>}
            </p>
          )}

          {invalidos.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs max-h-24 overflow-y-auto">
              {invalidos.slice(0, 10).map((i) => (
                <p key={i.linha}>linha {i.linha}: {i.erros.join("; ")}</p>
              ))}
              {invalidos.length > 10 && <p>… e mais {invalidos.length - 10}</p>}
            </div>
          )}

          {validos.length > 0 && (
            <div className="rounded-md border overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-muted-foreground sticky top-0 bg-background">
                  <tr>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-right p-2">Venda</th>
                    <th className="text-right p-2">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {validos.slice(0, 50).map((i) => (
                    <tr key={i.linha} className="border-b">
                      <td className="p-2">{i.dados.nome}</td>
                      <td className="p-2 font-mono">{i.dados.sku ?? "(auto)"}</td>
                      <td className="p-2">{i.dados.categoria ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">{brl(parseNumeroBR(i.dados.preco_venda!) ?? 0)}</td>
                      <td className="p-2 text-right tabular-nums">{i.dados.estoque ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validos.length > 50 && (
                <p className="p-2 text-xs text-muted-foreground">Mostrando 50 de {validos.length} linhas.</p>
              )}
            </div>
          )}

          {temEstoque && (
            <div className="space-y-1.5">
              <Label>Loja que recebe o estoque inicial</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={lojaEstoque}
                onChange={(e) => setLojaEstoque(e.target.value)}
              >
                <option value="">Selecione…</option>
                {lojas.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.apelido ?? l.nome}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Para a outra loja, importe de novo com a coluna de estoque dela, ou use o Inventário.
              </p>
            </div>
          )}

          {resultado && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1 max-h-40 overflow-y-auto">
              {resultado.map((r, i) => <p key={i}>• {r}</p>)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => void importar()} disabled={importando || validos.length === 0}>
            {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar {validos.length > 0 ? `${validos.length} produto(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
