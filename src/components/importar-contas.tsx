// ============================================================
// Importação de contas a receber e a pagar em aberto (CSV).
//
// É o saldo que vem do sistema antigo: o que os clientes já devem e
// o que a loja já deve a fornecedores. Sem isto, no dia da virada
// alguém digitaria parcela por parcela — e um crediário esquecido é
// dinheiro que a loja deixa de cobrar.
//
// Regras que a tela garante:
//   · vincula ao cliente/fornecedor pelo CPF/CNPJ, ou pelo nome exato
//   · conta com vencimento passado já entra como "vencido", não
//     "pendente" — senão o painel de inadimplência mente
//   · parcela 2/6 fica identificada como tal, para o extrato do
//     cliente não virar uma lista de dívidas soltas
//   · importar duas vezes não duplica: confere descrição + vencimento
//     + valor + pessoa
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
import { brl, date as fmtData } from "@/lib/format";
import {
  parseCSV, parseDataBR, parseNumeroBR, soDigitos, semAcento,
  interpretarPlanilha, baixarModeloCSV, type LinhaImportacao,
} from "@/lib/importar-csv";

const ALIASES: Record<string, string> = {
  descricao: "descricao", historico: "descricao", documento: "descricao",
  referencia: "descricao", "descricao da conta": "descricao",
  cliente: "pessoa", fornecedor: "pessoa", pessoa: "pessoa", nome: "pessoa",
  "nome do cliente": "pessoa", "razao social": "pessoa",
  cpf: "cpf_cnpj", cnpj: "cpf_cnpj", cpf_cnpj: "cpf_cnpj", "cpf/cnpj": "cpf_cnpj",
  valor: "valor", total: "valor", "valor total": "valor", saldo: "valor",
  "valor da parcela": "valor",
  vencimento: "data_vencimento", data_vencimento: "data_vencimento",
  "data de vencimento": "data_vencimento", venc: "data_vencimento",
  parcela: "parcela", "parcela numero": "parcela", parcela_numero: "parcela",
  parcelas: "parcela_total", parcela_total: "parcela_total", "total de parcelas": "parcela_total",
  numero_documento: "numero_documento", nf: "numero_documento", "numero do documento": "numero_documento",
  categoria: "categoria", observacoes: "observacoes", obs: "observacoes",
  forma_pagamento: "forma_pagamento", forma: "forma_pagamento",
};

const FORMAS = new Set([
  "dinheiro", "pix", "cartao_credito", "cartao_debito", "crediario",
  "boleto", "promissoria", "cheque", "transferencia",
]);

/** "Cartão de Crédito" → "cartao_credito"; o que não casar volta null. */
function normalizarForma(v: string | undefined): string | null {
  if (!v) return null;
  const s = semAcento(v).replace(/\s+de\s+/g, " ").replace(/[\s-]+/g, "_");
  if (FORMAS.has(s)) return s;
  const apelidos: Record<string, string> = {
    credito: "cartao_credito", cartao: "cartao_credito", debito: "cartao_debito",
    crediario_proprio: "crediario", carne: "crediario", nota_promissoria: "promissoria",
    ted: "transferencia", doc: "transferencia", deposito: "transferencia",
  };
  return apelidos[s] ?? null;
}

function validar(d: Record<string, string>): string[] {
  const erros: string[] = [];
  if (!d.descricao && !d.pessoa) erros.push("sem descrição e sem nome — não dá para identificar a conta");
  const valor = parseNumeroBR(d.valor ?? "");
  if (valor === null) erros.push("valor ausente ou inválido");
  else if (valor <= 0) erros.push(`valor deve ser maior que zero (lido: ${brl(valor)})`);
  if (!d.data_vencimento) erros.push("sem data de vencimento");
  else if (!parseDataBR(d.data_vencimento)) erros.push(`vencimento inválido ("${d.data_vencimento}")`);
  if (d.forma_pagamento && !normalizarForma(d.forma_pagamento)) {
    erros.push(`forma de pagamento não reconhecida ("${d.forma_pagamento}")`);
  }
  return erros;
}

const MODELO_RECEBER =
  "cliente;cpf_cnpj;descricao;valor;vencimento;parcela;parcelas;forma_pagamento;numero_documento;observacoes\n" +
  "João da Silva;123.456.789-00;Crediário compra de 10/08;149,90;15/10/2026;1;3;crediario;;Saldo vindo do sistema antigo\n" +
  "João da Silva;123.456.789-00;Crediário compra de 10/08;149,90;15/11/2026;2;3;crediario;;\n" +
  "Academia Corpo em Forma;12.345.678/0001-90;Venda a prazo NF 1234;890,00;30/09/2026;1;1;boleto;1234;\n";

const MODELO_PAGAR =
  "fornecedor;cpf_cnpj;descricao;valor;vencimento;parcela;parcelas;forma_pagamento;numero_documento;observacoes\n" +
  "Max Nutrition Indústria;11.222.333/0001-44;Compra de mercadoria NF 5678;3.450,00;20/10/2026;1;2;boleto;5678;\n" +
  "Max Nutrition Indústria;11.222.333/0001-44;Compra de mercadoria NF 5678;3.450,00;20/11/2026;2;2;boleto;5678;\n";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "receber" | "pagar";
  lojas: any[];
  lojaIdInicial?: string | null;
}

export function ImportarContasDialog({ open, onOpenChange, tipo, lojas, lojaIdInicial }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [itens, setItens] = useState<LinhaImportacao[]>([]);
  const [loja, setLoja] = useState<string>(lojaIdInicial ?? "");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string[] | null>(null);

  const ehReceber = tipo === "receber";
  const rotulo = ehReceber ? "Contas a Receber" : "Contas a Pagar";
  const quem = ehReceber ? "cliente" : "fornecedor";

  const validos = useMemo(() => itens.filter((i) => i.erros.length === 0), [itens]);
  const invalidos = useMemo(() => itens.filter((i) => i.erros.length > 0), [itens]);
  const total = useMemo(
    () => validos.reduce((s, i) => s + (parseNumeroBR(i.dados.valor ?? "") ?? 0), 0),
    [validos],
  );

  const lerArquivo = async (arquivo: File) => {
    setResultado(null);
    setNomeArquivo(arquivo.name);
    const texto = await arquivo.text();
    const { itens: parsed, planilhaInvalida } = interpretarPlanilha(
      parseCSV(texto), ALIASES, "valor", validar,
    );
    if (planilhaInvalida) {
      toast.error("Planilha sem coluna de valor — baixe o modelo para ver o formato.");
      setItens([]);
      return;
    }
    setItens(parsed);
  };

  const limpar = () => { setItens([]); setNomeArquivo(""); setResultado(null); };

  const importar = async () => {
    if (validos.length === 0) { toast.error("Nenhuma linha válida para importar."); return; }
    if (!loja) { toast.error("Escolha a loja dona dessas contas."); return; }
    setImportando(true);
    try {
      // ---- vincula à pessoa: primeiro por documento, depois por nome exato ----
      const { data: pessoas, error: pErr } = await supabase
        .from("erp_pessoas").select("id, cpf_cnpj, nome_razao");
      if (pErr) throw pErr;
      const porDoc = new Map<string, string>();
      const porNome = new Map<string, string>();
      (pessoas ?? []).forEach((p: any) => {
        const d = soDigitos(p.cpf_cnpj ?? "");
        if (d) porDoc.set(d, p.id);
        const n = semAcento(p.nome_razao ?? "");
        if (n && !porNome.has(n)) porNome.set(n, p.id);
      });

      // ---- o que já existe nesta loja, para não duplicar ----
      const { data: jaExistem, error: cErr } = await supabase
        .from("erp_contas")
        .select("descricao, data_vencimento, valor, pessoa_id")
        .eq("loja_id", loja).eq("tipo", tipo);
      if (cErr) throw cErr;
      const chaveConta = (descricao: string, venc: string, valor: number, pessoa: string | null) =>
        `${semAcento(descricao)}|${venc}|${valor.toFixed(2)}|${pessoa ?? ""}`;
      const existentes = new Set(
        (jaExistem ?? []).map((c: any) =>
          chaveConta(c.descricao ?? "", c.data_vencimento, Number(c.valor), c.pessoa_id)),
      );

      const hoje = new Date().toISOString().slice(0, 10);
      const notas: string[] = [];
      const paraInserir: any[] = [];
      const vistas = new Set<string>();
      let semVinculo = 0, vencidas = 0;

      validos.forEach((i) => {
        const d = i.dados;
        const doc = soDigitos(d.cpf_cnpj ?? "");
        let pessoaId: string | null = null;
        if (doc && porDoc.has(doc)) pessoaId = porDoc.get(doc)!;
        else if (d.pessoa && porNome.has(semAcento(d.pessoa))) pessoaId = porNome.get(semAcento(d.pessoa))!;

        if (!pessoaId && (d.pessoa || doc)) {
          semVinculo++;
          notas.push(
            `linha ${i.linha}: ${quem} "${d.pessoa ?? doc}" não está cadastrado — conta criada sem vínculo. ` +
            `Importe os ${quem}s primeiro para o extrato dele mostrar esta conta.`,
          );
        }

        const valor = parseNumeroBR(d.valor!)!;
        const venc = parseDataBR(d.data_vencimento!)!;
        const descricao = d.descricao ?? `Saldo anterior — ${d.pessoa ?? "sem identificação"}`;

        const chave = chaveConta(descricao, venc, valor, pessoaId);
        if (existentes.has(chave)) {
          notas.push(`linha ${i.linha}: já existe conta igual (${descricao}, ${fmtData(venc)}, ${brl(valor)}) — pulada`);
          return;
        }
        if (vistas.has(chave)) {
          notas.push(`linha ${i.linha}: repetida na própria planilha — pulada`); return;
        }
        vistas.add(chave);

        // vencimento no passado já nasce "vencido": deixar "pendente" faria o
        // painel de inadimplência mostrar zero no dia seguinte à virada
        const venceu = venc < hoje;
        if (venceu) vencidas++;

        paraInserir.push({
          loja_id: loja,
          tipo,
          pessoa_id: pessoaId,
          descricao,
          valor,
          data_vencimento: venc,
          status: venceu ? "vencido" : "pendente",
          valor_pago: 0,
          parcela_numero: Math.trunc(parseNumeroBR(d.parcela ?? "") ?? 1) || 1,
          parcela_total: Math.trunc(parseNumeroBR(d.parcela_total ?? "") ?? 1) || 1,
          forma_pagamento: normalizarForma(d.forma_pagamento),
          numero_documento: d.numero_documento ?? null,
          categoria: d.categoria ?? "Saldo do sistema anterior",
          observacoes: d.observacoes ?? null,
        });
      });

      let inseridos = 0;
      for (let i = 0; i < paraInserir.length; i += 200) {
        const lote = paraInserir.slice(i, i + 200);
        const { error } = await supabase.from("erp_contas").insert(lote);
        if (error) throw new Error(`inserção (lote ${i / 200 + 1}): ${error.message}`);
        inseridos += lote.length;
      }

      const somaInserida = paraInserir.reduce((s, c) => s + c.valor, 0);
      setResultado([
        `${inseridos} conta(s) importada(s), somando ${brl(somaInserida)}`,
        ...(vencidas ? [`${vencidas} já estava(m) vencida(s) e entrou(aram) com status "vencido"`] : []),
        ...(semVinculo ? [`${semVinculo} sem ${quem} cadastrado — criadas sem vínculo`] : []),
        ...(invalidos.length ? [`${invalidos.length} linha(s) inválida(s) ignorada(s)`] : []),
        ...notas,
      ]);
      toast.success(`Importação concluída: ${inseridos} conta(s), ${brl(somaInserida)}.`);
      void qc.invalidateQueries({ queryKey: ["erp_contas"] });
      void qc.invalidateQueries({ queryKey: ["erp_dashboard"] });
      setItens([]);
      setNomeArquivo("");
    } catch (e: any) {
      toast.error(`Importação interrompida: ${e.message ?? e}`);
    } finally {
      setImportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) limpar(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar {rotulo} (planilha)
          </DialogTitle>
          <DialogDescription>
            O saldo em aberto vindo do sistema anterior. Uma linha por parcela.
            Importar o mesmo arquivo duas vezes não duplica as contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Escolher arquivo
            </Button>
            <Button variant="ghost"
              onClick={() => baixarModeloCSV(
                ehReceber ? MODELO_RECEBER : MODELO_PAGAR,
                `modelo-importacao-contas-${tipo}.csv`,
              )}>
              <Download className="mr-2 h-4 w-4" /> Baixar modelo
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Loja dona dessas contas</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={loja}
              onChange={(e) => setLoja(e.target.value)}
            >
              <option value="">Selecione…</option>
              {lojas.map((l: any) => (
                <option key={l.id} value={l.id}>{l.apelido ?? l.nome}</option>
              ))}
            </select>
          </div>

          {nomeArquivo && (
            <p className="text-sm">
              <b>{nomeArquivo}</b>: {validos.length} linha(s) válida(s) · total {brl(total)}
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
                    <th className="text-left p-2">{ehReceber ? "Cliente" : "Fornecedor"}</th>
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-center p-2">Parcela</th>
                    <th className="text-left p-2">Vencimento</th>
                    <th className="text-right p-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {validos.slice(0, 50).map((i) => {
                    const venc = parseDataBR(i.dados.data_vencimento!)!;
                    const atrasada = venc < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={i.linha} className="border-b">
                        <td className="p-2">{i.dados.pessoa ?? "—"}</td>
                        <td className="p-2">{i.dados.descricao ?? "(saldo anterior)"}</td>
                        <td className="p-2 text-center">
                          {i.dados.parcela ?? 1}/{i.dados.parcela_total ?? 1}
                        </td>
                        <td className={`p-2 ${atrasada ? "text-red-600 font-medium" : ""}`}>
                          {fmtData(venc)}{atrasada && " (vencida)"}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {brl(parseNumeroBR(i.dados.valor!) ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {validos.length > 50 && (
                <p className="p-2 text-xs text-muted-foreground">Mostrando 50 de {validos.length} linhas.</p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Importe os {quem}s antes das contas: a conta é ligada pelo CPF/CNPJ (ou pelo nome
            exato) e, sem o cadastro, ela entra sem vínculo e não aparece no extrato dele.
          </p>

          {resultado && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1 max-h-40 overflow-y-auto">
              {resultado.map((r, i) => <p key={i}>• {r}</p>)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => void importar()} disabled={importando || validos.length === 0 || !loja}>
            {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar {validos.length > 0 ? `${validos.length} conta(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
