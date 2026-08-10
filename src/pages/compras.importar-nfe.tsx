// ============================================================
// Página: Importação de NFe (XML) de Compra
// Fluxo:
//   1. Upload do XML
//   2. Parse automático (fornecedor, itens, valores)
//   3. Auto-matching: vincular produtos existentes via EAN/SKU
//   4. Preview: usuário pode ajustar margem/ação por item
//   5. Confirmar: cria produtos novos, atualiza estoque, cria compra
// ============================================================

import { useState, useEffect } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  Package, Building2, ArrowRight, Save, X, Edit2,
} from "lucide-react";
import {
  useProdutos, useClientes, useImportarNFe,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, dateTime } from "@/lib/format";
import { parseNFeXML, isValidNFeXML, formatCNPJ } from "@/lib/nfe-xml-parser";
import type { NFeParsed, NFeItemImportacao } from "@/types/nfe";

export function ImportarNFePage() {
  const { lojaId } = useAutoSelectLoja();
  const { user } = useAuth();
  const { data: produtos = [] } = useProdutos();
  const { data: pessoas = [] } = useClientes();
  const importarNFe = useImportarNFe();

  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [parsed, setParsed] = useState<NFeParsed | null>(null);
  const [itens, setItens] = useState<NFeItemImportacao[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [fornecedorNovo, setFornecedorNovo] = useState(false);
  const [margemGlobal, setMargemGlobal] = useState(50); // 50%
  const [error, setError] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  // Reset
  const reset = () => {
    setXmlContent(null);
    setParsed(null);
    setItens([]);
    setFornecedorId(null);
    setFornecedorNovo(false);
    setError(null);
    setSucessoMsg(null);
  };

  // 1. Upload do XML
  const handleFileUpload = (file: File) => {
    setError(null);
    setSucessoMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const xml = e.target?.result as string;
      if (!isValidNFeXML(xml)) {
        setError("XML inválido. Verifique se é um arquivo de NFe válido.");
        return;
      }
      try {
        const parsed = parseNFeXML(xml);
        setXmlContent(xml);
        setParsed(parsed);
      } catch (err: any) {
        setError(`Erro ao processar XML: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // 2. Auto-matching ao carregar XML
  useEffect(() => {
    if (!parsed) return;

    // Auto-match fornecedor por CNPJ
    if (parsed.emitente.cnpj) {
      const existente = pessoas.find((p: any) => p.cpf_cnpj === parsed.emitente.cnpj);
      if (existente) {
        setFornecedorId(existente.id);
      } else {
        setFornecedorNovo(true);
      }
    }

    // Auto-match produtos por EAN ou SKU
    const itensMapeados: NFeItemImportacao[] = parsed.itens.map((item) => {
      // Tentar match por EAN
      let existente = produtos.find(
        (p: any) => p.codigo_barras && item.codigo_ean && p.codigo_barras === item.codigo_ean
      );

      // Tentar match por SKU (cProd)
      if (!existente) {
        existente = produtos.find((p: any) => p.sku === item.codigo_produto);
      }

      // Tentar match por nome (fallback - match exato)
      if (!existente) {
        existente = produtos.find(
          (p: any) => p.nome.toLowerCase() === item.nome.toLowerCase()
        );
      }

      return {
        ...item,
        produto_id: existente?.id ?? null,
        produto_existente: !!existente,
        acao: existente ? "atualizar_estoque" : "criar_novo",
        preco_custo_atual: existente?.preco_custo ?? 0,
        margem_desejada: existente
          ? Number(existente.preco_venda) / Math.max(Number(existente.preco_custo), 0.01) - 1
          : margemGlobal / 100,
      };
    });

    setItens(itensMapeados);
  }, [parsed, produtos, pessoas]);

  // Aplicar margem global nos itens
  const aplicarMargemGlobal = () => {
    setItens((prev) =>
      prev.map((item) =>
        item.produto_existente
          ? item
          : { ...item, margem_desejada: margemGlobal / 100 }
      )
    );
  };

  // 3. Confirmar importação
  const handleImportar = async () => {
    if (!parsed || !lojaId || !user) return;

    try {
      const result = await importarNFe.mutateAsync({
        loja_id: lojaId,
        usuario_id: user.id,
        nfe: parsed,
        itens,
        fornecedor_id: fornecedorId ?? undefined,
      });

      setSucessoMsg(`NFe importada com sucesso! Compra #${result.compra.id.slice(0, 8)} criada.`);
      setTimeout(() => reset(), 3000);
    } catch (err: any) {
      setError(`Erro ao importar: ${err.message}`);
    }
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Importar NFe" />;
  if (!lojaId) return <div className="p-8 text-center text-muted-foreground">Selecione uma loja</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Upload className="h-6 w-6" /> Importar NFe de Compra
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Faça o upload do XML da NFe para cadastrar produtos automaticamente
        </p>
      </div>

      {/* Alertas */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {sucessoMsg && (
        <Card className="border-green-500">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-600">{sucessoMsg}</p>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Upload */}
      {!parsed && (
        <Card>
          <CardHeader>
            <CardTitle>1. Selecione o arquivo XML</CardTitle>
            <CardDescription>
              Arraste o arquivo ou clique para selecionar. Aceita .xml de NFe modelo 55.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 flex flex-col items-center gap-3 cursor-pointer hover:bg-accent transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="font-medium">Clique aqui ou arraste o XML</p>
              <p className="text-xs text-muted-foreground">Tamanho máximo: 5MB</p>
              <input
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {parsed && (
        <>
          {/* Cabeçalho NFe */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> NFe {parsed.numero}/{parsed.serie}
                </CardTitle>
                <CardDescription>
                  Emitida em {dateTime(parsed.data_emissao)} · Chave: {parsed.chave_acesso.slice(0, 20)}...
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Trocar XML
              </Button>
            </CardHeader>
          </Card>

          {/* Fornecedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CNPJ</Label>
                  <Input value={formatCNPJ(parsed.emitente.cnpj)} disabled />
                </div>
                <div>
                  <Label>Razão Social</Label>
                  <Input value={parsed.emitente.nome} disabled />
                </div>
              </div>
              {parsed.emitente.fantasia && (
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={parsed.emitente.fantasia} disabled />
                </div>
              )}
              {parsed.emitente.ie && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Inscrição Estadual</Label>
                    <Input value={parsed.emitente.ie} disabled />
                  </div>
                </div>
              )}
              {fornecedorNovo ? (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-500 rounded p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm">
                    Fornecedor será cadastrado automaticamente como pessoa jurídica.
                  </p>
                </div>
              ) : (
                <Badge variant="default" className="mt-2">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Fornecedor já cadastrado
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Totais */}
          <Card>
            <CardHeader>
              <CardTitle>Totais da NFe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Produtos</p>
                  <p className="text-lg font-semibold">{brl(parsed.valor_produtos)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frete</p>
                  <p className="text-lg">{brl(parsed.valor_frete)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ICMS</p>
                  <p className="text-lg">{brl(parsed.valor_icms)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IPI</p>
                  <p className="text-lg">{brl(parsed.valor_ipi)}</p>
                </div>
                <div className="col-span-2 md:col-span-4 pt-3 border-t">
                  <p className="text-muted-foreground">Valor Total</p>
                  <p className="text-3xl font-bold text-green-600">{brl(parsed.valor_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" /> Itens ({itens.length})
                </CardTitle>
                <CardDescription>
                  {itens.filter((i) => i.produto_existente).length} já cadastrados ·{" "}
                  {itens.filter((i) => !i.produto_existente).length} serão criados
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Margem padrão para novos:</Label>
                <Input
                  type="number"
                  value={margemGlobal}
                  onChange={(e) => setMargemGlobal(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs">%</span>
                <Button size="sm" variant="outline" onClick={aplicarMargemGlobal}>
                  Aplicar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-right p-3">Qtd</th>
                      <th className="text-right p-3">Vlr Unit</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-center p-3">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-accent">
                        <td className="p-3 text-xs font-mono">{item.numero_item}</td>
                        <td className="p-3">
                          <p className="font-medium text-sm">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.codigo_produto} {item.codigo_ean && `· EAN: ${item.codigo_ean}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            NCM: {item.ncm ?? "—"} · CFOP: {item.cfop ?? "—"} · {item.unidade}
                          </p>
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {item.quantidade}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {brl(item.valor_unitario)}
                        </td>
                        <td className="p-3 text-right tabular-nums font-semibold">
                          {brl(item.valor_total)}
                        </td>
                        <td className="p-3 text-center">
                          {item.produto_existente ? (
                            <Badge variant="default">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Já existe
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Edit2 className="h-3 w-3 mr-1" /> Será criado
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.produto_existente ? (
                            <span className="text-xs text-muted-foreground">
                              {item.preco_custo_atual
                                ? `Mantém preço venda`
                                : "—"}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              value={Math.round(item.margem_desejada * 100)}
                              onChange={(e) => {
                                const novaMargem = Number(e.target.value) / 100;
                                setItens((prev) =>
                                  prev.map((i, j) =>
                                    j === idx ? { ...i, margem_desejada: novaMargem } : i
                                  )
                                );
                              }}
                              className="w-16 mx-auto text-center"
                              min={0}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Ao confirmar, os produtos serão cadastrados e o estoque atualizado na loja atual.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImportar}
                  disabled={importarNFe.isPending || !lojaId || !user}
                >
                  {importarNFe.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> Confirmar Importação
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}