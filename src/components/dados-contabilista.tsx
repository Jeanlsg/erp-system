// ============================================================
// Dados do contabilista — registro 0100 do SPED.
//
// Existiam só como seis linhas na lista chave/valor de Configurações
// do Sistema, onde o rótulo é a chave crua (`sped_contador_nome`,
// em fonte monoespaçada) e o grupo era "OUTROS". Ninguém preenche
// assim um dado que o contador dita pelo telefone — e, vazio, o
// registro 0100 sai em branco e a EFD volta do PVA.
//
// Agora o formulário fica NA TELA QUE GERA o arquivo, com rótulo em
// português, validação de CPF/CNPJ e aviso do que falta.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Calculator, Check, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfiguracoesGerais, useUpsertConfiguracao } from "@/lib/supabase-queries";
import { soDigitos } from "@/lib/importar-csv";

/** chave no banco → rótulo na tela, na ordem em que o 0100 pede */
const CAMPOS = [
  { chave: "sped_contador_nome",  rotulo: "Nome do contabilista", obrigatorio: true,
    dica: "Como consta no CRC. Vai no campo NOME do registro 0100." },
  { chave: "sped_contador_cpf",   rotulo: "CPF do contabilista", digitos: 11,
    dica: "Só números, 11 dígitos." },
  { chave: "sped_contador_crc",   rotulo: "CRC", dica: "Registro no Conselho Regional de Contabilidade." },
  { chave: "sped_contador_cnpj",  rotulo: "CNPJ do escritório contábil", digitos: 14,
    dica: "Deixe vazio se o contabilista for autônomo." },
  { chave: "sped_contador_fone",  rotulo: "Telefone", dica: "Com DDD." },
  { chave: "sped_contador_email", rotulo: "E-mail" },
] as const;

export function DadosContabilistaCard() {
  const { data: configs = [], isLoading } = useConfiguracoesGerais();
  const upsert = useUpsertConfiguracao();

  const salvos = useMemo(() => {
    const m: Record<string, string> = {};
    configs.forEach((c: any) => {
      if (c.chave?.startsWith("sped_contador_")) m[c.chave] = c.valor ?? "";
    });
    return m;
  }, [configs]);

  const [form, setForm] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  // carrega o que está no banco assim que chega, sem sobrescrever o que o
  // operador já começou a digitar
  useEffect(() => {
    if (!isLoading) setForm((f) => (Object.keys(f).length ? f : salvos));
  }, [isLoading, salvos]);

  const valor = (chave: string) => form[chave] ?? salvos[chave] ?? "";

  const erros = useMemo(() => {
    const e: Record<string, string> = {};
    for (const c of CAMPOS) {
      const v = valor(c.chave).trim();
      if ("obrigatorio" in c && c.obrigatorio && !v) {
        e[c.chave] = "Sem este campo o registro 0100 sai vazio.";
      }
      if ("digitos" in c && c.digitos && v) {
        const d = soDigitos(v);
        if (d.length !== c.digitos) e[c.chave] = `Esperado ${c.digitos} dígitos, tem ${d.length}.`;
      }
    }
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, salvos]);

  const alterados = CAMPOS.filter((c) => valor(c.chave) !== (salvos[c.chave] ?? ""));
  const podeSalvar = alterados.length > 0 && Object.keys(erros).length === 0;

  const completo = CAMPOS.every((c) => {
    // CNPJ do escritório é legitimamente opcional (contabilista autônomo)
    if (c.chave === "sped_contador_cnpj") return true;
    return valor(c.chave).trim() !== "";
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      for (const c of alterados) {
        // CPF e CNPJ entram só com dígitos: é assim que o 0100 espera, e
        // deixar a pontuação do jeito que o contador ditou reprova no PVA
        const bruto = valor(c.chave).trim();
        const limpo = "digitos" in c && c.digitos ? soDigitos(bruto) : bruto;
        await upsert.mutateAsync({ chave: c.chave, valor: limpo });
      }
      toast.success(
        alterados.length === 1
          ? "Dado do contabilista salvo."
          : `${alterados.length} dados do contabilista salvos.`,
      );
    } catch (e: any) {
      // a lista chave/valor salvava no blur sem dizer nada quando falhava;
      // aqui a falha é dita
      toast.error(`Não foi possível salvar: ${e.message ?? e}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" /> Dados do contabilista
          {completo ? (
            <span className="flex items-center gap-1 text-xs font-normal text-green-600">
              <Check className="h-3.5 w-3.5" /> completo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-normal text-amber-600">
              <TriangleAlert className="h-3.5 w-3.5" /> incompleto
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Vão no <b>registro 0100</b> de toda EFD gerada. São os mesmos para as duas lojas.
          Peça ao contador — ele dita em um minuto, e sem isso o arquivo volta do PVA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {CAMPOS.map((c) => (
                <div key={c.chave} className="space-y-1.5">
                  <Label htmlFor={c.chave}>
                    {c.rotulo}
                    {"obrigatorio" in c && c.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <Input
                    id={c.chave}
                    value={valor(c.chave)}
                    onChange={(e) => setForm((f) => ({ ...f, [c.chave]: e.target.value }))}
                    aria-invalid={!!erros[c.chave]}
                    className={erros[c.chave] ? "border-destructive" : undefined}
                  />
                  {erros[c.chave] ? (
                    <p className="text-xs text-destructive">{erros[c.chave]}</p>
                  ) : "dica" in c && c.dica ? (
                    <p className="text-xs text-muted-foreground">{c.dica}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {alterados.length === 0
                  ? "Nada alterado."
                  : `${alterados.length} campo(s) alterado(s) — ainda não salvo(s).`}
              </p>
              <Button onClick={() => void salvar()} disabled={!podeSalvar || salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar dados do contabilista
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
