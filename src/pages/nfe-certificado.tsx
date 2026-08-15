// ============================================================
// Página: Certificado Digital e-CNPJ A1
// Permite upload real do arquivo .pfx para o Supabase Storage,
// extração automática de dados do certificado (titular, CNPJ, validade),
// armazenamento criptografado e gestão de múltiplos certificados.
// ============================================================

import { useState, useRef } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock, Upload, FileKey2, AlertTriangle, Loader2, CheckCircle2,
  Eye, EyeOff, Trash2, Calendar, Hash,
  Info, Download, AlertCircle, Clock, FlaskConical,
} from "lucide-react";
import {
  useCertificados, useCreateCertificado, useDeleteCertificado,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { supabase } from "@/lib/supabase";
import { date } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface CertificadoExtraido {
  arquivo_nome: string;
  arquivo_path: string;
  arquivo_tamanho: number;
  titular: string;
  cnpj_cpf: string;
  emissor: string;
  numero_serie: string;
  data_validade: string;
  data_emissao?: string;
}

export function NfeCertificadoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: certificados = [], isLoading } = useCertificados(lojaId ?? undefined);
  const create = useCreateCertificado();
  const del = useDeleteCertificado();

  const [modal, setModal] = useState(false);
  const [step, setStep] = useState<"upload" | "dados" | "concluido">("upload");
  const [processando, setProcessando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultadoTeste, setResultadoTeste] = useState<any>(null);
  const [certExtraido, setCertExtraido] = useState<CertificadoExtraido | null>(null);
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [apelido, setApelido] = useState("");
  const [arquivoFile, setArquivoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Certificado Digital e-CNPJ" />;
  }

  const ativos = certificados.filter((c: any) => c.ativo);

  // Calcular dias até vencer
  const diasVencimento = (dataValidade: string) => {
    const dias = Math.floor(
      (new Date(dataValidade).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return dias;
  };

  const vencendo = certificados.filter((c: any) => {
    if (!c.data_validade) return false;
    const dias = diasVencimento(c.data_validade);
    return dias >= 0 && dias <= 30;
  });

  const vencidos = certificados.filter((c: any) => {
    if (!c.data_validade) return false;
    return diasVencimento(c.data_validade) < 0;
  });

  const resetar = () => {
    setModal(false);
    setStep("upload");
    setProcessando(false);
    setTestando(false);
    setProgresso(0);
    setCertExtraido(null);
    setResultadoTeste(null);
    setSenha("");
    setShowSenha(false);
    setApelido("");
    setArquivoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Testar certificado (valida senha + extrai dados via Edge Function)
  const testarCertificado = async () => {
    if (!arquivoFile || !senha) {
      toast.error("Selecione o arquivo e informe a senha");
      return;
    }

    setTestando(true);
    setResultadoTeste(null);
    try {
      // Converter para base64
      const buffer = await arquivoFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("testar-certificado", {
        body: {
          arquivo_base64: base64,
          arquivo_nome: arquivoFile.name,
          senha,
        },
      });

      if (error) {
        // Distinguir REJEIÇÃO da função (respondeu não-2xx com corpo) de
        // INDISPONIBILIDADE (erro de rede / função não deployada / 404)
        const status = (error as any).context?.status;
        const isIndisponivel =
          (error as any).name === "FunctionsFetchError" ||
          (error as any).name === "FunctionsRelayError" ||
          status === 404;

        if (!isIndisponivel) {
          // A Edge Function respondeu recusando — NÃO cair no fallback
          let detalhe = error.message;
          try {
            const ctx = await (error as any).context?.json?.();
            if (ctx?.error) detalhe = ctx.error;
          } catch { /* mantém a mensagem padrão */ }
          setResultadoTeste({ ok: false, validado: false, error: detalhe });
          toast.error(`Certificado rejeitado: ${detalhe}`);
          return;
        }

        // Fallback client-side APENAS para indisponibilidade — nunca marca ok
        console.warn("Edge Function indisponível, fazendo checagem client-side limitada:", error);
        const ehPKCS12 = arquivoFile.name.toLowerCase().match(/\.(pfx|p12)$/);
        if (!ehPKCS12) {
          setResultadoTeste({ ok: false, validado: false, error: "Arquivo não parece ser um certificado válido (.pfx ou .p12)" });
          toast.error("Arquivo não parece ser um certificado válido (.pfx ou .p12)");
          return;
        }
        setResultadoTeste({
          ok: false,
          validado: false,
          mensagem: "Não validado — serviço de validação indisponível. Tente novamente mais tarde.",
          arquivo_nome: arquivoFile.name,
          arquivo_tamanho: arquivoFile.size,
          data_validade: extrairValidadeLocal(buffer),
        });
        toast.warning("Não foi possível validar o certificado (serviço indisponível). O cadastro exige validação.");
        return;
      }

      if (data?.success) {
        setResultadoTeste({ ok: true, validado: true, ...data.data });
        toast.success("Certificado validado com sucesso!");
        // Auto-preencher dados extraídos
        if (data.data?.titular || data.data?.data_validade) {
          setCertExtraido((prev) => ({
            ...prev!,
            titular: data.data.titular || prev?.titular || "",
            cnpj_cpf: data.data.cnpj_cpf || prev?.cnpj_cpf || "",
            emissor: data.data.emissor || prev?.emissor || "",
            numero_serie: data.data.numero_serie || prev?.numero_serie || "",
            data_validade: data.data.data_validade || prev?.data_validade || "",
          }));
        }
      } else {
        // Rejeição explícita da Edge Function (success === false) — sem fallback
        const motivo = data?.error || "Certificado ou senha inválidos";
        setResultadoTeste({ ok: false, validado: false, error: motivo });
        toast.error(`Validação falhou: ${motivo}`);
      }
    } catch (err: any) {
      setResultadoTeste({ ok: false, validado: false, error: err.message });
      toast.error(`Erro: ${err.message}`);
    } finally {
      setTestando(false);
    }
  };

  // Extrair validade via parsing DER local (fallback)
  const extrairValidadeLocal = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const matches = hex.matchAll(/170d([0-9]{12})5a/g);
    for (const match of matches) {
      const ts = match[1];
      const yy = parseInt(ts.slice(0, 2), 10);
      const mm = parseInt(ts.slice(2, 4), 10);
      const dd = parseInt(ts.slice(4, 6), 10);
      const year = yy < 50 ? 2000 + yy : 1900 + yy;
      const date = new Date(Date.UTC(year, mm - 1, dd));
      if (date > new Date()) return date.toISOString().split("T")[0];
    }
    return "";
  };

  // Processar upload do .pfx
  const handleFile = async (file: File) => {
    if (!lojaId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    // Validações
    if (!file.name.toLowerCase().endsWith(".pfx") && !file.name.toLowerCase().endsWith(".p12")) {
      toast.error("Arquivo deve ser .pfx ou .p12");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }

    setProcessando(true);
    setProgresso(10);
    setArquivoFile(file);

    try {
      setProgresso(30);

      // 2. Enviar para Supabase Storage (privado)
      const arquivoPath = `${lojaId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("certificados")
        .upload(arquivoPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/x-pkcs12",
        });

      if (uploadErr) throw uploadErr;
      setProgresso(70);

      // 3. Extrair metadados do certificado (.pfx/.p12)
      // Como o navegador não consegue ler .pfx sem bibliotecas PKCS#12,
      // pedimos para o usuário inserir a senha e validar manualmente.
      // Os dados básicos (titular, validade, CNPJ) precisam ser informados pelo usuário
      // ou extraídos via API/backend dedicado.

      // Definimos dados básicos extraídos do arquivo (nome)
      setCertExtraido({
        arquivo_nome: file.name,
        arquivo_path: arquivoPath,
        arquivo_tamanho: file.size,
        titular: "",
        cnpj_cpf: "",
        emissor: "",
        numero_serie: "",
        data_validade: "",
      });

      setProgresso(100);
      setStep("dados");
      toast.success("Arquivo enviado! Agora preencha os dados do certificado.");
    } catch (err: any) {
      console.error("Erro no upload:", err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleSalvar = async () => {
    if (!certExtraido || !lojaId) return;
    if (!certExtraido.titular || !certExtraido.cnpj_cpf || !certExtraido.data_validade || !senha) {
      toast.error("Preencha todos os campos obrigatórios (incluindo a senha)");
      return;
    }
    if (!resultadoTeste?.ok) {
      toast.error("Teste o certificado (botão \"Testar certificado\") antes de cadastrar.");
      return;
    }

    try {
      // Criptografar a senha via RPC da migration 031 (erp.criptografar_senha_cert)
      const { data: senhaCripto, error: criptoErr } = await supabase
        .schema("erp")
        .rpc("criptografar_senha_cert", { plaintext: senha });
      if (criptoErr || !senhaCripto) {
        throw new Error(`Falha ao criptografar a senha do certificado: ${criptoErr?.message ?? "retorno vazio"}`);
      }

      await create.mutateAsync({
        loja_id: lojaId,
        tipo: "A1",
        nome: apelido || `Certificado A1 - ${certExtraido.cnpj_cpf}`,
        titular: certExtraido.titular,
        cnpj_cpf: certExtraido.cnpj_cpf,
        emissor: certExtraido.emissor || null,
        numero_serie: certExtraido.numero_serie || null,
        data_validade: certExtraido.data_validade,
        arquivo_path: certExtraido.arquivo_path,
        // Senha SOMENTE criptografada (nunca em texto plano)
        senha_armazenada_cripto: senhaCripto,
        ativo: true,
      });

      setStep("concluido");
      toast.success("Certificado cadastrado com sucesso!");
      setTimeout(() => resetar(), 2500);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  // Cancelar o fluxo de cadastro: remove o arquivo já enviado ao storage
  const handleCancelarFluxo = async () => {
    if (step !== "concluido" && certExtraido?.arquivo_path) {
      const { error: rmErr } = await supabase.storage
        .from("certificados")
        .remove([certExtraido.arquivo_path]);
      if (rmErr) console.warn("Falha ao remover arquivo do storage no cancelamento:", rmErr.message);
    }
    resetar();
  };

  const handleExcluir = async (cert: any) => {
    if (!confirm(`Excluir o certificado de ${cert.titular}?\nEsta ação também removerá o arquivo .pfx.`)) return;

    try {
      // 1. Remover o registro primeiro (se falhar, o arquivo permanece intacto)
      await del.mutateAsync(cert.id);

      // 2. Remover arquivo do storage, checando o retorno
      if (cert.arquivo_path) {
        const { error: rmErr } = await supabase.storage
          .from("certificados")
          .remove([cert.arquivo_path]);
        if (rmErr) {
          toast.warning(`Registro excluído, mas o arquivo .pfx não foi removido do storage: ${rmErr.message}`);
          return;
        }
      }
      toast.success("Certificado excluído");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleDownload = async (cert: any) => {
    if (!cert.arquivo_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("certificados")
        .download(cert.arquivo_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificado_${cert.cnpj_cpf}.pfx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(`Erro ao baixar: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Lock className="h-6 w-6" /> Certificado Digital e-CNPJ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de certificados A1 para emissão de NF-e / NFC-e
          </p>
        </div>
        <Button onClick={() => setModal(true)}>
          <Upload className="mr-2 h-4 w-4" /> Novo Certificado
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Ativos</p>
            <p className="text-2xl font-semibold text-green-600">{ativos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{certificados.length}</p>
          </CardContent>
        </Card>
        <Card className={vencendo.length > 0 ? "border-orange-500" : ""}>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vencendo 30d</p>
            <p className={`text-2xl font-semibold ${vencendo.length > 0 ? "text-orange-600" : ""}`}>
              {vencendo.length}
            </p>
          </CardContent>
        </Card>
        <Card className={vencidos.length > 0 ? "border-red-500" : ""}>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Vencidos</p>
            <p className={`text-2xl font-semibold ${vencidos.length > 0 ? "text-red-600" : ""}`}>
              {vencidos.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de vencimento */}
      {vencendo.length > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                {vencendo.length} certificado(s) vencendo nos próximos 30 dias
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                Renove o quanto antes para não interromper a emissão de NF-e.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Certificados */}
      <Card>
        <CardHeader>
          <CardTitle>Certificados Cadastrados</CardTitle>
          <CardDescription>
            Cada loja pode ter múltiplos certificados A1. Apenas um por loja pode estar ativo por vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : certificados.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileKey2 className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum certificado cadastrado</p>
              <Button onClick={() => setModal(true)} variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Cadastrar primeiro certificado
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {certificados.map((c: any) => {
                const dias = c.data_validade ? diasVencimento(c.data_validade) : null;
                const statusVencimento = dias === null ? "ok" : dias < 0 ? "vencido" : dias <= 30 ? "vencendo" : "ok";
                return (
                  <div key={c.id} className="p-4 hover:bg-accent">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          c.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          <Lock className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{c.nome || c.titular}</p>
                            <Badge variant="outline">A1</Badge>
                            {c.ativo && <Badge variant="default">Ativo</Badge>}
                            {statusVencimento === "vencendo" && (
                              <Badge variant="outline" className="border-orange-500 text-orange-600">
                                <Clock className="h-3 w-3 mr-1" /> Vence em {dias}d
                              </Badge>
                            )}
                            {statusVencimento === "vencido" && (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" /> Vencido
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Titular</p>
                              <p className="font-medium truncate">{c.titular}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
                              <p className="font-mono">{c.cnpj_cpf}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Emissor</p>
                              <p className="truncate">{c.emissor || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Validade</p>
                              <p className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {date(c.data_validade)}
                              </p>
                            </div>
                          </div>
                          {c.numero_serie && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <Hash className="h-3 w-3 inline" /> Série: {c.numero_serie}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {c.arquivo_path && (
                          <Button size="sm" variant="ghost" onClick={() => handleDownload(c)} title="Baixar .pfx">
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleExcluir(c)} title="Excluir">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Upload */}
      <Dialog open={modal} onOpenChange={(open) => !open && handleCancelarFluxo()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileKey2 className="h-5 w-5" />
              {step === "upload" && "Upload do Certificado A1"}
              {step === "dados" && "Dados do Certificado"}
              {step === "concluido" && "Certificado Cadastrado!"}
            </DialogTitle>
            <DialogClose />
          </DialogHeader>

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">Como funciona:</p>
                    <ol className="text-xs text-muted-foreground mt-1 list-decimal list-inside space-y-1">
                      <li>Faça upload do arquivo <strong>.pfx</strong> ou <strong>.p12</strong> (certificado A1)</li>
                      <li>O arquivo é armazenado de forma segura no Supabase Storage</li>
                      <li>Preencha os dados (titular, CNPJ, validade) e a senha do certificado</li>
                      <li>O certificado fica disponível para emitir NF-e</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-500 rounded p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">
                    <strong>Onde conseguir o certificado A1?</strong><br />
                    Adquira com uma Autoridade Certificadora credenciada à ICP-Brasil:
                    <br />• <a href="https://www.serasaexperian.com.br" target="_blank" className="underline">Serasa Experian</a> ·
                    <a href="https://www.certisign.com.br" target="_blank" className="underline">Certisign</a> ·
                    <a href="https://www.valid.com.br" target="_blank" className="underline">Valid</a> ·
                    <a href="https://www.soluti.com.br" target="_blank" className="underline">Soluti</a>
                  </p>
                </div>
              </div>

              <label className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 flex flex-col items-center gap-3 cursor-pointer hover:bg-accent transition-colors">
                {processando ? (
                  <>
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="font-medium">Enviando arquivo...</p>
                    <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{progresso}%</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="font-medium">Clique para selecionar o certificado</p>
                    <p className="text-xs text-muted-foreground">
                      Arquivos .pfx ou .p12 · Máximo 5MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  disabled={processando}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </label>
            </div>
          )}

          {/* Step 2: Dados + Senha + Teste */}
          {step === "dados" && certExtraido && (
            <div className="space-y-4">
              {certExtraido.arquivo_path && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-500 rounded p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div className="text-sm">
                    <p className="font-medium">{certExtraido.arquivo_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {(certExtraido.arquivo_tamanho / 1024).toFixed(2)} KB · enviado com sucesso
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="apelido">Apelido (opcional)</Label>
                <Input
                  id="apelido"
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  placeholder="Ex: Certificado Produção - Loja Centro"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Titular *</Label>
                  <Input
                    value={certExtraido.titular}
                    onChange={(e) => setCertExtraido({ ...certExtraido, titular: e.target.value })}
                    placeholder="Razão Social do titular"
                  />
                </div>
                <div>
                  <Label>CNPJ/CPF *</Label>
                  <Input
                    value={certExtraido.cnpj_cpf}
                    onChange={(e) => setCertExtraido({ ...certExtraido, cnpj_cpf: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Emissor</Label>
                  <Input
                    value={certExtraido.emissor}
                    onChange={(e) => setCertExtraido({ ...certExtraido, emissor: e.target.value })}
                    placeholder="Ex: AC Certisign"
                  />
                </div>
                <div>
                  <Label>Nº Série</Label>
                  <Input
                    value={certExtraido.numero_serie}
                    onChange={(e) => setCertExtraido({ ...certExtraido, numero_serie: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <Label>Data de Validade *</Label>
                <Input
                  type="date"
                  value={certExtraido.data_validade}
                  onChange={(e) => setCertExtraido({ ...certExtraido, data_validade: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="senha">Senha do Certificado *</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value);
                      // Alterou a senha → o teste anterior deixa de valer
                      setResultadoTeste(null);
                    }}
                    placeholder="Senha definida quando você gerou o .pfx"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ Esta senha fica armazenada no banco (criptografada).
                  É necessária para emissão automática de NF-e.
                </p>
              </div>

              {/* Resultado do teste do certificado */}
              {resultadoTeste && (
                <div
                  className={`rounded border p-3 flex items-start gap-2 text-sm ${
                    resultadoTeste.ok
                      ? "bg-green-50 dark:bg-green-950/20 border-green-500"
                      : "bg-red-50 dark:bg-red-950/20 border-red-500"
                  }`}
                >
                  {resultadoTeste.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <p>
                    {resultadoTeste.ok
                      ? "Certificado validado com sucesso. Você já pode cadastrar."
                      : resultadoTeste.error ?? resultadoTeste.mensagem ?? "Certificado não validado."}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Voltar
                </Button>
                <Button
                  variant="secondary"
                  onClick={testarCertificado}
                  disabled={testando || !senha || !arquivoFile}
                >
                  {testando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testando...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="mr-2 h-4 w-4" /> Testar certificado
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSalvar}
                  disabled={
                    create.isPending ||
                    !certExtraido.titular ||
                    !certExtraido.cnpj_cpf ||
                    !certExtraido.data_validade ||
                    !senha ||
                    !resultadoTeste?.ok
                  }
                >
                  {create.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Cadastrar Certificado
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Concluído */}
          {step === "concluido" && (
            <div className="py-8 text-center space-y-4">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Certificado cadastrado!</h2>
              <p className="text-muted-foreground">
                O certificado foi salvo e está pronto para uso na emissão de NF-e.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}