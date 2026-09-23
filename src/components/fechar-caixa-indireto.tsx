// ============================================================
// Fechar caixa por fora (fechamento indireto, migration 089).
//
// Fechar o turno de outra pessoa — o caixa que ficou aberto de ontem, o
// operador que saiu sem fechar. É ato de supervisão: o banco recusa quem não
// for admin/gerente, exige o valor contado e um motivo, e grava os dois no
// relatório junto com quem fechou.
//
// Mora num componente porque aparece em dois lugares — na tela de Caixa e na
// frente de caixa, onde o caixa de outra pessoa impede abrir o seu. Duas
// cópias da mesma regra de dinheiro acabam discordando.
// ============================================================

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/format";

interface Props {
  /** o caixa a fechar; null fecha o diálogo */
  caixa: any | null;
  aoFechar: () => void;
  /** chamado depois que o banco confirmou o fechamento */
  aoConcluir?: () => void;
}

export function FecharCaixaIndiretoDialog({ caixa, aoFechar, aoConcluir }: Props) {
  const qc = useQueryClient();
  const [valor, setValor] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [fechando, setFechando] = useState(false);

  // cada caixa começa com o formulário limpo
  useEffect(() => { setValor(""); setMotivo(""); }, [caixa?.id]);

  const fechar = async () => {
    if (!caixa) return;
    if (valor === "" || valor < 0) { toast.error("Informe o valor contado na gaveta."); return; }
    if (!motivo.trim()) { toast.error("Informe o motivo — ele fica no relatório."); return; }
    setFechando(true);
    try {
      const { data, error } = await supabase.schema("erp").rpc("fechar_caixa_indireto", {
        p_caixa_id: caixa.id, p_valor_contado: valor, p_motivo: motivo.trim(),
      });
      if (error) throw error;
      const r = data as any;
      toast.success(
        Math.abs(Number(r?.diferenca ?? 0)) < 0.01
          ? "Caixa fechado. A gaveta conferia."
          : `Caixa fechado com diferença de ${brl(Number(r?.diferenca ?? 0))}.`);
      void qc.invalidateQueries({ queryKey: ["erp_caixa"] });
      void qc.invalidateQueries({ queryKey: ["erp_caixa-aberto"] });
      aoConcluir?.();
      aoFechar();
    } catch (e: any) {
      toast.error(`Não foi possível fechar: ${e.message ?? e}`);
    } finally {
      setFechando(false);
    }
  };

  return (
    <Dialog open={!!caixa} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa por fora</DialogTitle>
        </DialogHeader>
        {caixa && (
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {caixa.ponto?.nome ?? `Caixa ${caixa.numero_caixa}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {caixa.usuario?.nome ?? "—"} · aberto em{" "}
                {new Date(caixa.data_abertura).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs">
                Esperado na gaveta:{" "}
                <b>{brl(Number(caixa.valor_esperado_gaveta ?? caixa.valor_inicial ?? 0))}</b>
              </p>
            </div>
            <div>
              <Label>Valor contado na gaveta *</Label>
              <InputMoeda autoFocus className="mt-1" value={valor} onChange={setValor} />
            </div>
            <div>
              <Label>Motivo *</Label>
              <Input className="mt-1" value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: operador saiu e esqueceu o caixa aberto" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Fica registrado no relatório, junto com o seu nome.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={() => void fechar()} disabled={fechando}>
            {fechando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fechar caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
