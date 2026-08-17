// ============================================================
// Página: Escrituração fiscal (EFD ICMS/IPI e SINTEGRA)
//
// A tela existe para gerar o arquivo e, principalmente, para mostrar o que
// o gerador NÃO conseguiu preencher com dado real. Um arquivo que sai sem
// reclamar parece pronto — e é assim que se entrega escrituração errada.
//
// O arquivo gerado aqui é rascunho até passar pelo PVA da Receita.
// ============================================================

import { useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useLojas, useSpedArquivos, useGerarSped, baixarSped } from "@/lib/supabase-queries";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { dateTime } from "@/lib/format";
import { toast } from "sonner";

const TIPO_ROTULO: Record<string, string> = {
  efd_icms_ipi: "EFD ICMS/IPI",
  sintegra: "SINTEGRA",
};

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FiscalSpedPage() {
  const { data: lojas = [] } = useLojas();
  const [lojaId, setLojaId] = useState("");
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [tipo, setTipo] = useState<"efd" | "sintegra">("efd");
  const [finalidade, setFinalidade] = useState<"0" | "1">("0");
  const [ultimo, setUltimo] = useState<any>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const lojaAtual = lojaId || lojas[0]?.id || "";
  const { data: arquivos = [] } = useSpedArquivos(lojaAtual || undefined);
  const gerar = useGerarSped();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured />;

  async function handleGerar() {
    try {
      const r: any = await gerar.mutateAsync({
        loja_id: lojaAtual, competencia, tipo, finalidade,
      });
      setUltimo(r);
      toast.success(`${r.linhas} linhas geradas`, {
        description: `${r.documentos.saidas} saída(s) e ${r.documentos.entradas} entrada(s)`,
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // O download vem do navegador, montando um Blob com o conteúdo guardado.
  async function handleBaixar(arq: any) {
    setBaixando(arq.id);
    try {
      const conteudo = await baixarSped(arq.id);
      const loja = lojas.find((l: any) => l.id === arq.loja_id);
      const comp = String(arq.competencia).slice(0, 7).replace("-", "");
      const nome = arq.tipo === "sintegra"
        ? `SINTEGRA_${comp}_${(loja?.nome ?? "loja").replace(/\W+/g, "")}.txt`
        : `EFD_${comp}_${(loja?.nome ?? "loja").replace(/\W+/g, "")}.txt`;
      // O arquivo fiscal é ANSI/latin1 na prática; o PVA aceita UTF-8 sem BOM,
      // mas BOM quebra o primeiro registro — daí o Blob cru.
      const url = URL.createObjectURL(new Blob([conteudo], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBaixando(null);
    }
  }

  const avisosAtuais: string[] = ultimo?.avisos ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Escrituração fiscal</h1>
        <p className="text-muted-foreground">
          EFD ICMS/IPI e SINTEGRA a partir das notas, do kardex e do inventário já registrados.
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">O arquivo gerado aqui é rascunho até passar pelo PVA.</p>
            <p className="text-muted-foreground">
              O Programa Validador e Assinador da Receita é quem confere leiaute, códigos e
              consistência entre registros. Nada aqui substitui essa validação, e a
              transmissão continua sendo feita por lá.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gerar arquivo</CardTitle>
          <CardDescription>
            Perfil, regime e dados do contabilista vêm de Configurações do sistema — dependem do
            enquadramento definido pelo contador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label className="text-xs">Loja</Label>
              <Select value={lojaAtual} onValueChange={setLojaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {lojas.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome} — {l.uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="w-44">
              <Label className="text-xs">Arquivo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efd">EFD ICMS/IPI</SelectItem>
                  <SelectItem value="sintegra">SINTEGRA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipo === "efd" && (
              <div className="w-52">
                <Label className="text-xs">Finalidade</Label>
                <Select value={finalidade} onValueChange={(v) => setFinalidade(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Original</SelectItem>
                    <SelectItem value="1">Substituto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleGerar} disabled={!lojaAtual || gerar.isPending}>
              {gerar.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <FileText className="mr-2 h-4 w-4" />}
              Gerar
            </Button>
          </div>

          {tipo === "sintegra" && (
            <p className="mt-3 text-sm text-muted-foreground">
              O SINTEGRA foi dispensado na maioria dos estados para quem entrega a EFD.
              Confirme com o contador se BA/PE ainda exigem.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Os avisos são o produto mais útil desta tela: dizem exatamente o que
          o Fisco vai cobrar antes de ele cobrar. */}
      {ultimo && (
        <Card className={avisosAtuais.length > 1 ? "border-amber-300" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              O que o gerador não conseguiu preencher
            </CardTitle>
            <CardDescription>
              {ultimo.linhas} linhas · {ultimo.documentos.saidas} saída(s) ·{" "}
              {ultimo.documentos.entradas} entrada(s) · {ultimo.produtos} produto(s) ·{" "}
              {ultimo.inventario ? "com inventário" : "sem inventário no período"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {avisosAtuais.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-600">•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivos gerados</CardTitle>
          <CardDescription>
            Guardados como foram gerados: um ajuste lançado depois mudaria o conteúdo, e o que
            foi entregue precisa ser recuperável.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {arquivos.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum arquivo gerado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Gerado em</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Tamanho</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arquivos.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {String(a.competencia).slice(0, 7)}
                      {a.finalidade === "1" && (
                        <Badge variant="outline" className="ml-2">substituto</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {TIPO_ROTULO[a.tipo] ?? a.tipo}
                      {a.perfil && <span className="ml-1 text-xs text-muted-foreground">perfil {a.perfil}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {dateTime(a.created_at)}
                    </TableCell>
                    <TableCell className="text-right">{a.linhas}</TableCell>
                    <TableCell className="text-right">{tamanho(a.bytes)}</TableCell>
                    <TableCell>
                      {(a.avisos ?? []).length > 0 && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          {(a.avisos ?? []).length}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={baixando === a.id}
                        onClick={() => handleBaixar(a)}>
                        {baixando === a.id
                          ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          : <Download className="mr-1 h-3.5 w-3.5" />}
                        Baixar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
