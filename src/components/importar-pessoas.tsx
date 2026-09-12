// ============================================================
// Importação de clientes e fornecedores por planilha (CSV).
//
// Existe porque a migração do sistema antigo trazia centenas de
// cadastros e o único caminho era digitar um por um. Mesmo formato
// e mesmas garantias do import de produtos: CSV do Excel BR, número
// e data no formato brasileiro, pré-visualização antes de confirmar
// e nada de duplicar ao importar duas vezes.
//
// O papel (cliente ou fornecedor) vem do contexto: a tela Clientes
// importa clientes, a de Fornecedores importa fornecedores. Quem já
// existe pelo CPF/CNPJ não é duplicado — GANHA o papel novo, porque
// o distribuidor que também compra no balcão é a mesma pessoa.
// ============================================================

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import {
  parseCSV, parseDataBR, parseNumeroBR, soDigitos, semAcento,
  interpretarPlanilha, baixarModeloCSV, type LinhaImportacao,
} from "@/lib/importar-csv";

const ALIASES: Record<string, string> = {
  nome: "nome", nome_razao: "nome", "nome razao": "nome", "razao social": "nome",
  razao_social: "nome", cliente: "nome", fornecedor: "nome", "nome completo": "nome",
  nome_fantasia: "nome_fantasia", fantasia: "nome_fantasia", "nome fantasia": "nome_fantasia",
  cpf: "cpf_cnpj", cnpj: "cpf_cnpj", cpf_cnpj: "cpf_cnpj", "cpf/cnpj": "cpf_cnpj",
  documento: "cpf_cnpj", doc: "cpf_cnpj",
  email: "email", "e-mail": "email",
  telefone: "telefone", fone: "telefone", tel: "telefone",
  celular: "celular", whatsapp: "celular", cel: "celular",
  cep: "cep", endereco: "logradouro", logradouro: "logradouro", rua: "logradouro",
  numero: "numero", num: "numero", complemento: "complemento", compl: "complemento",
  bairro: "bairro", cidade: "cidade", municipio: "cidade", uf: "uf", estado: "uf",
  inscricao_estadual: "inscricao_estadual", ie: "inscricao_estadual",
  "inscricao estadual": "inscricao_estadual",
  limite_credito: "limite_credito", limite: "limite_credito",
  "limite de credito": "limite_credito",
  data_nascimento: "data_nascimento", nascimento: "data_nascimento",
  "data de nascimento": "data_nascimento", aniversario: "data_nascimento",
  observacoes: "observacoes", obs: "observacoes", observacao: "observacoes",
};

/** CPF tem 11 dígitos, CNPJ tem 14. Qualquer outro tamanho é erro de digitação. */
function validarDoc(bruto: string | undefined): { ok: boolean; digitos: string; erro?: string } {
  const d = soDigitos(bruto ?? "");
  if (!d) return { ok: true, digitos: "" };            // documento é opcional
  if (d.length === 11 || d.length === 14) return { ok: true, digitos: d };
  return { ok: false, digitos: d, erro: `CPF/CNPJ com ${d.length} dígitos (esperado 11 ou 14)` };
}

function validar(d: Record<string, string>): string[] {
  const erros: string[] = [];
  if (!d.nome) erros.push("sem nome");
  const doc = validarDoc(d.cpf_cnpj);
  if (!doc.ok) erros.push(doc.erro!);
  if (d.data_nascimento && !parseDataBR(d.data_nascimento)) {
    erros.push(`data de nascimento inválida ("${d.data_nascimento}")`);
  }
  if (d.uf && d.uf.trim().length !== 2) erros.push(`UF deve ter 2 letras ("${d.uf}")`);
  return erros;
}

const MODELO_CLIENTES =
  "nome;cpf_cnpj;email;celular;telefone;cep;endereco;numero;bairro;cidade;uf;limite_credito;data_nascimento;observacoes\n" +
  "João da Silva;123.456.789-00;joao@email.com;(87) 99999-1111;;56300-000;Rua das Flores;120;Centro;Petrolina;PE;500,00;15/03/1990;Cliente antigo\n" +
  "Academia Corpo em Forma Ltda;12.345.678/0001-90;contato@academia.com;(87) 98888-2222;;56300-000;Av. Principal;1500;Areia Branca;Petrolina;PE;2.000,00;;Compra todo mês\n";

const MODELO_FORNECEDORES =
  "nome;nome_fantasia;cpf_cnpj;email;telefone;celular;cep;endereco;numero;bairro;cidade;uf;inscricao_estadual;observacoes\n" +
  "Max Nutrition Indústria e Comércio Ltda;Max Nutrition;11.222.333/0001-44;vendas@maxnutrition.com;(11) 3000-0000;;01310-000;Av. Paulista;1000;Bela Vista;São Paulo;SP;123456789;Prazo 30 dias\n" +
  "Suprema Importação Ltda;Suprema;22.333.444/0001-55;comercial@suprema.com;(11) 4000-0000;;04567-000;Rua do Comércio;50;Brooklin;São Paulo;SP;987654321;Frete por conta do fornecedor\n";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Define o papel gravado e os textos da tela. */
  papel: "cliente" | "fornecedor";
}

export function ImportarPessoasDialog({ open, onOpenChange, papel }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [itens, setItens] = useState<LinhaImportacao[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<string[] | null>(null);

  const ehCliente = papel === "cliente";
  const rotulo = ehCliente ? "Clientes" : "Fornecedores";
  const singular = ehCliente ? "cliente" : "fornecedor";

  const validos = useMemo(() => itens.filter((i) => i.erros.length === 0), [itens]);
  const invalidos = useMemo(() => itens.filter((i) => i.erros.length > 0), [itens]);

  const lerArquivo = async (arquivo: File) => {
    setResultado(null);
    setNomeArquivo(arquivo.name);
    const texto = await arquivo.text();
    const { itens: parsed, planilhaInvalida } = interpretarPlanilha(
      parseCSV(texto), ALIASES, "nome", validar,
    );
    if (planilhaInvalida) {
      toast.error("Planilha sem coluna de nome — baixe o modelo para ver o formato.");
      setItens([]);
      return;
    }
    setItens(parsed);
  };

  const limpar = () => { setItens([]); setNomeArquivo(""); setResultado(null); };

  const importar = async () => {
    if (validos.length === 0) { toast.error("Nenhuma linha válida para importar."); return; }
    setImportando(true);
    try {
      // ---- quem já existe, por CPF/CNPJ ----
      // cpf_cnpj é UNIQUE: inserir repetido estouraria a restrição e abortaria
      // o lote inteiro. Então os que já existem são ATUALIZADOS para ganhar o
      // papel novo, e só os inéditos são inseridos.
      const { data: existentes, error: exErr } = await supabase
        .from("erp_pessoas").select("id, cpf_cnpj, nome_razao, eh_cliente, eh_fornecedor");
      if (exErr) throw exErr;
      const porDoc = new Map<string, any>();
      const nomesEx = new Set<string>();
      (existentes ?? []).forEach((p: any) => {
        const d = soDigitos(p.cpf_cnpj ?? "");
        if (d) porDoc.set(d, p);
        nomesEx.add(semAcento(p.nome_razao ?? ""));
      });

      const notas: string[] = [];
      const paraInserir: any[] = [];
      const ganhamPapel: string[] = [];   // ids de quem já existia
      const vistoDoc = new Set<string>();
      const vistoNome = new Set<string>();

      validos.forEach((i) => {
        const d = i.dados;
        const doc = soDigitos(d.cpf_cnpj ?? "");

        // já cadastrado: só acrescenta o papel que falta
        if (doc && porDoc.has(doc)) {
          const p = porDoc.get(doc);
          const jaTem = ehCliente ? p.eh_cliente : p.eh_fornecedor;
          if (jaTem) {
            notas.push(`linha ${i.linha}: ${p.nome_razao} já é ${singular} — nada a fazer`);
          } else {
            ganhamPapel.push(p.id);
            notas.push(`linha ${i.linha}: ${p.nome_razao} já existia e passou a ser também ${singular}`);
          }
          return;
        }
        // repetida dentro da própria planilha
        if (doc && vistoDoc.has(doc)) {
          notas.push(`linha ${i.linha}: CPF/CNPJ repetido na planilha`); return;
        }
        // sem documento: cai para o nome, senão a planilha duplica cadastro
        if (!doc) {
          const chave = semAcento(d.nome);
          if (nomesEx.has(chave) || vistoNome.has(chave)) {
            notas.push(`linha ${i.linha}: "${d.nome}" sem CPF/CNPJ e com nome já cadastrado — pulada`);
            return;
          }
          vistoNome.add(chave);
        } else {
          vistoDoc.add(doc);
        }

        const temEndereco = d.cep || d.logradouro || d.cidade;
        paraInserir.push({
          tipo: doc.length === 14 ? "juridica" : "fisica",
          nome_razao: d.nome,
          nome_fantasia: d.nome_fantasia ?? null,
          // string vazia violaria o UNIQUE a partir da segunda linha sem doc
          cpf_cnpj: doc || null,
          email: d.email ?? null,
          telefone: d.telefone ?? null,
          celular: d.celular ?? null,
          uf: d.uf ? d.uf.toUpperCase().slice(0, 2) : null,
          inscricao_estadual: d.inscricao_estadual ?? null,
          limite_credito: parseNumeroBR(d.limite_credito ?? "") ?? 0,
          data_nascimento: d.data_nascimento ? parseDataBR(d.data_nascimento) : null,
          observacoes: d.observacoes ?? null,
          endereco: temEndereco ? {
            cep: d.cep ?? null, logradouro: d.logradouro ?? null, numero: d.numero ?? null,
            complemento: d.complemento ?? null, bairro: d.bairro ?? null,
            cidade: d.cidade ?? null, uf: d.uf ? d.uf.toUpperCase().slice(0, 2) : null,
          } : null,
          ativo: true,
          eh_cliente: ehCliente,
          eh_fornecedor: !ehCliente,
        });
      });

      // ---- papel novo para quem já existia ----
      let atualizados = 0;
      for (let i = 0; i < ganhamPapel.length; i += 200) {
        const lote = ganhamPapel.slice(i, i + 200);
        const { error } = await supabase.from("erp_pessoas")
          .update(ehCliente ? { eh_cliente: true } : { eh_fornecedor: true })
          .in("id", lote);
        if (error) throw new Error(`atualização de papel: ${error.message}`);
        atualizados += lote.length;
      }

      // ---- inserção em lotes ----
      let inseridos = 0;
      for (let i = 0; i < paraInserir.length; i += 200) {
        const lote = paraInserir.slice(i, i + 200);
        const { error } = await supabase.from("erp_pessoas").insert(lote);
        if (error) throw new Error(`inserção (lote ${i / 200 + 1}): ${error.message}`);
        inseridos += lote.length;
      }

      setResultado([
        `${inseridos} ${singular}(s) cadastrado(s)`,
        ...(atualizados ? [`${atualizados} cadastro(s) que já existiam passaram a ser também ${singular}`] : []),
        ...(invalidos.length ? [`${invalidos.length} linha(s) inválida(s) ignorada(s)`] : []),
        ...notas,
      ]);
      toast.success(`Importação concluída: ${inseridos} ${singular}(s).`);
      void qc.invalidateQueries({ queryKey: ["erp_clientes"] });
      void qc.invalidateQueries({ queryKey: ["erp_clientes_compras"] });
      void qc.invalidateQueries({ queryKey: ["erp_fornecedores"] });
      void qc.invalidateQueries({ queryKey: ["erp_pessoas"] });
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
            CSV com cabeçalho — exporte do Excel como &quot;CSV (separado por ponto e vírgula)&quot;.
            Quem já estiver cadastrado pelo CPF/CNPJ não é duplicado.
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
                ehCliente ? MODELO_CLIENTES : MODELO_FORNECEDORES,
                `modelo-importacao-${ehCliente ? "clientes" : "fornecedores"}.csv`,
              )}>
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
                    <th className="text-left p-2">CPF/CNPJ</th>
                    <th className="text-left p-2">Contato</th>
                    <th className="text-left p-2">Cidade/UF</th>
                  </tr>
                </thead>
                <tbody>
                  {validos.slice(0, 50).map((i) => {
                    const doc = soDigitos(i.dados.cpf_cnpj ?? "");
                    return (
                      <tr key={i.linha} className="border-b">
                        <td className="p-2">{i.dados.nome}</td>
                        <td className="p-2 font-mono">
                          {doc ? `${doc} (${doc.length === 14 ? "PJ" : "PF"})` : "—"}
                        </td>
                        <td className="p-2">{i.dados.celular ?? i.dados.telefone ?? i.dados.email ?? "—"}</td>
                        <td className="p-2">
                          {[i.dados.cidade, i.dados.uf].filter(Boolean).join("/") || "—"}
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
            Importar {validos.length > 0 ? `${validos.length} ${singular}(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
