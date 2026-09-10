// ============================================================
// Página: Importação de NFe (XML) de Compra
// Fluxo:
//   1. Upload do XML
//   2. Parse automático (fornecedor, itens, valores)
//   3. Auto-matching: vincular produtos existentes via EAN/SKU
//   4. Preview: usuário pode ajustar margem/ação por item
//   5. Confirmar: cria produtos novos, atualiza estoque, cria compra
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Package, Building2, Save, X, Edit2, Search, Download } from "lucide-react";
import { useProdutos, useClientes, useImportarNFe, isSupabaseConfigured, useManifestarDfe } from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
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

  const [parsed, setParsed] = useState<NFeParsed | null>(null);
  const [itens, setItens] = useState<NFeItemImportacao[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [fornecedorNovo, setFornecedorNovo] = useState(false);
  const [margemGlobal, setMargemGlobal] = useState(50); // 50%
  const [error, setError] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  // ---- Buscar nota já recebida da SEFAZ pelo NÚMERO (ou pela chave) ----
  // O operador tem o DANFE na mão com o "Nº 12345": não precisa de arquivo.
  // O número da NF-e também está dentro da chave (posições 26–34), então a
  // busca acha até nota que chegou só como resumo, sem o campo numero.
  const manifestar = useManifestarDfe();
  const [termoBusca, setTermoBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [achadas, setAchadas] = useState<any[] | null>(null);
  const [agindo, setAgindo] = useState<string | null>(null);

  const buscarNota = async () => {
    const t = termoBusca.trim();
    const digitos = t.replace(/\D/g, "");
    if (!digitos || !lojaId) { toast.error("Digite o número da nota ou a chave de acesso."); return; }
    setBuscando(true);
    try {
      let q = supabase.from("erp_nfe_entrada")
        .select("id, numero, serie, chave_acesso, emitente_nome, emitente_cnpj, data_emissao, valor_total, resumo, compra_id, tipo_manifestacao, xml_original")
        .eq("loja_id", lojaId).order("data_emissao", { ascending: false }).limit(20);
      if (digitos.length === 44) {
        q = q.eq("chave_acesso", digitos);
      } else {
        // número exato OU número embutido na chave: 25 posições + série(3) + nNF(9)
        const pad = digitos.padStart(9, "0");
        q = q.or(`numero.eq.${digitos},chave_acesso.like.${"_".repeat(28)}${pad}*`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setAchadas(data ?? []);
      if ((data ?? []).length === 0) {
        toast.info(digitos.length === 44
          ? "Nenhuma nota com essa chave — use \"Buscar na SEFAZ\"."
          : "Nenhuma nota recebida com esse número. Sincronize em Notas Recebidas (SEFAZ) ou importe o XML.");
      }
    } catch (e: any) {
      toast.error(`Falha na busca: ${e.message ?? e}`);
    } finally {
      setBuscando(false);
    }
  };

  const abrirNota = (n: any) => {
    if (!n.xml_original || !isValidNFeXML(n.xml_original)) { toast.error("Esta nota ainda não tem o XML completo."); return; }
    try { setParsed(parseNFeXML(n.xml_original)); setError(null); }
    catch (e: any) { setError(`Erro ao processar o XML da SEFAZ: ${e.message}`); }
  };

  // Só resumo → ciência da operação libera o XML completo. Não compromete nada.
  const manifestarEAbrir = async (n: any) => {
    setAgindo(n.id);
    try {
      const r: any = await manifestar.mutateAsync({ nfe_entrada_id: n.id, tipo: "ciencia" });
      const { data } = await supabase.from("erp_nfe_entrada").select("xml_original").eq("id", n.id).single();
      if (data?.xml_original && isValidNFeXML(data.xml_original)) {
        toast.success("XML completo recebido.");
        setParsed(parseNFeXML(data.xml_original)); setError(null);
      } else {
        toast.info(r?.aviso ?? "Ciência registrada. A SEFAZ costuma liberar o XML em instantes — busque de novo.");
        void buscarNota();
      }
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally { setAgindo(null); }
  };

  // Chave digitada e nada no banco → pede à SEFAZ por essa chave.
  const buscarNaSefaz = async () => {
    const chave = termoBusca.replace(/\D/g, "");
    if (chave.length !== 44 || !lojaId) return;
    setAgindo("sefaz");
    try {
      const { data, error } = await supabase.functions.invoke("erp-dfe", { body: { acao: "baixar_chave", loja_id: lojaId, chave } });
      if (error) throw error;
      if (data?.ok === false) { toast.error(data.erro ?? "a SEFAZ não devolveu a nota", { description: data.dica ?? undefined }); return; }
      toast.success("Nota baixada da SEFAZ.");
      await buscarNota();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally { setAgindo(null); }
  };

  // Reset
  const reset = () => {
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
        setParsed(parsed);
      } catch (err: any) {
        setError(`Erro ao processar XML: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // 1b. XML vindo da distribuição DF-e
  // A tela de notas recebidas manda o XML que a SEFAZ entregou, para o
  // fornecedor não precisar enviar arquivo nenhum. Daqui para frente o
  // fluxo é idêntico ao do upload — inclusive a conferência item a item.
  const location = useLocation();
  const xmlDfeRef = useRef<string | null>(null);
  useEffect(() => {
    const xml = (location.state as any)?.xmlDfe as string | undefined;
    if (!xml || xmlDfeRef.current === xml) return;
    xmlDfeRef.current = xml;
    if (!isValidNFeXML(xml)) {
      setError("O XML recebido da SEFAZ não pôde ser lido como NF-e.");
      return;
    }
    try {
      setParsed(parseNFeXML(xml));
    } catch (err: any) {
      setError(`Erro ao processar o XML da SEFAZ: ${err.message}`);
    }
  }, [location.state]);

  // 2. Auto-matching ao carregar XML
  // Só remapeia quando o XML parseado muda: refetches de produtos/pessoas
  // não podem resetar as margens já editadas pelo usuário
  const parsedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!parsed) {
      parsedKeyRef.current = null;
      return;
    }
    const parsedKey = parsed.chave_acesso || `${parsed.numero}-${parsed.serie}`;
    if (parsedKeyRef.current === parsedKey) return;
    parsedKeyRef.current = parsedKey;

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
    // margemGlobal fica de fora de propósito: ela é o valor INICIAL de cada
    // item e o usuário edita depois. Incluí-la refaria o mapeamento e
    // descartaria as margens já ajustadas à mão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <CardTitle>Buscar pelo número da nota</CardTitle>
            <CardDescription>
              Digite o número que está no DANFE (ou a chave de acesso de 44 dígitos). Busca entre as notas
              recebidas da SEFAZ para esta loja — sem precisar do arquivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Ex.: 12345 ou a chave de acesso" value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void buscarNota(); }} />
              <Button onClick={() => void buscarNota()} disabled={buscando}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {achadas && achadas.length === 0 && termoBusca.replace(/\D/g, "").length === 44 && (
              <Button variant="outline" size="sm" onClick={() => void buscarNaSefaz()} disabled={agindo === "sefaz"}>
                {agindo === "sefaz" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Buscar na SEFAZ por esta chave
              </Button>
            )}
            {achadas && achadas.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Nº / Série</th>
                      <th className="text-left p-2">Emitente</th>
                      <th className="text-left p-2">Emissão</th>
                      <th className="text-right p-2">Valor</th>
                      <th className="text-left p-2">Situação</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {achadas.map((n: any) => {
                      const nNF = n.numero ?? (n.chave_acesso ? String(parseInt(n.chave_acesso.slice(25, 34), 10)) : "—");
                      const serie = n.serie ?? (n.chave_acesso ? String(parseInt(n.chave_acesso.slice(22, 25), 10)) : "");
                      const completa = !!n.xml_original && isValidNFeXML(n.xml_original);
                      return (
                        <tr key={n.id} className="border-b last:border-0">
                          <td className="p-2 font-mono text-xs">{nNF}{serie ? `/${serie}` : ""}</td>
                          <td className="p-2">{n.emitente_nome ?? "—"}<div className="text-[11px] text-muted-foreground font-mono">{n.emitente_cnpj ? formatCNPJ(n.emitente_cnpj) : ""}</div></td>
                          <td className="p-2 text-xs">{n.data_emissao ? dateTime(n.data_emissao) : "—"}</td>
                          <td className="p-2 text-right tabular-nums">{brl(n.valor_total ?? 0)}</td>
                          <td className="p-2">
                            {n.compra_id ? <Badge variant="outline">já importada</Badge>
                              : completa ? <Badge>XML completo</Badge>
                              : <Badge variant="outline" className="border-amber-500 text-amber-600">só resumo</Badge>}
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {n.compra_id ? null : completa ? (
                              <Button size="sm" onClick={() => abrirNota(n)}>Conferir e importar</Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled={agindo === n.id} onClick={() => void manifestarEAbrir(n)}>
                                {agindo === n.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                Dar ciência e baixar XML
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!parsed && (
        <Card>
          <CardHeader>
            <CardTitle>Ou selecione o arquivo XML</CardTitle>
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