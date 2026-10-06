// ============================================================
// Cancelar venda — a janela.
//
// Diz antes o que vai ser desfeito (nota na SEFAZ, estoque, contas, pontos,
// comissão, entrega) e pede o motivo, que é o mesmo texto da justificativa
// da nota (mínimo 15 caracteres, regra da SEFAZ). A ordem dos passos está em
// src/lib/cancelar-venda.ts.
// ============================================================

import { useEffect, useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useCancelarVenda } from "@/lib/supabase-queries";
import { MOTIVO_MINIMO, resumoCancelamento } from "@/lib/cancelar-venda";
import { brl } from "@/lib/format";

interface Props {
  venda: { id: string; numero_pedido?: number | null; total?: number | null } | null;
  aoFechar: () => void;
}

export function CancelarVendaDialog({ venda, aoFechar }: Props) {
  const [motivo, setMotivo] = useState("");
  const [etapa, setEtapa] = useState<string | null>(null);
  const cancelar = useCancelarVenda();

  // venda nova, motivo novo — o texto de uma não vale para a outra
  useEffect(() => { setMotivo(""); setEtapa(null); }, [venda?.id]);

  const curto = motivo.trim().length < MOTIVO_MINIMO;

  const confirmar = async () => {
    if (!venda || curto) return;
    try {
      const { resultado, notasCanceladas } = await cancelar.mutateAsync({
        vendaId: venda.id, motivo: motivo.trim(), aoAvancar: setEtapa,
      });
      toast.success(`Venda #${venda.numero_pedido ?? ""} cancelada. ${resumoCancelamento(resultado, notasCanceladas)}`, { duration: 10000 });
      if (resultado.comissao_ja_paga) {
        toast.warning("A comissão desta venda já tinha sido paga ao vendedor: desconte no próximo pagamento.", { duration: 12000 });
      }
      aoFechar();
    } catch (e: any) {
      toast.error(e?.message ?? String(e), { duration: 12000 });
    } finally {
      setEtapa(null);
    }
  };

  return (
    <Dialog open={!!venda} onOpenChange={(o) => { if (!o && !cancelar.isPending) aoFechar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" /> Cancelar venda #{venda?.numero_pedido ?? ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            A venda de <b>{brl(Number(venda?.total ?? 0))}</b> é desfeita como se não tivesse acontecido:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>a nota fiscal autorizada é cancelada na SEFAZ antes;</li>
            <li>os produtos voltam ao estoque (e aos mesmos lotes);</li>
            <li>as contas a receber são canceladas — o dinheiro sai da gaveta e o esperado do caixa já desconta;</li>
            <li>os pontos de fidelidade, a comissão pendente e o pedido de entrega são cancelados.</li>
          </ul>
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/20">
            Só vale com o caixa da venda ainda aberto e sem parcela recebida. Depois disso, ou para
            devolver só parte, use <b>Devoluções</b>.
          </p>
          <div>
            <Label>Motivo *</Label>
            <Textarea className="mt-1" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cliente desistiu da compra antes de sair da loja" disabled={cancelar.isPending} />
            <p className={`mt-1 text-xs ${curto ? "text-muted-foreground" : "text-green-600"}`}>
              {motivo.trim().length}/{MOTIVO_MINIMO} caracteres no mínimo — vai também como justificativa do cancelamento da nota.
            </p>
          </div>
          {etapa && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {etapa}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={cancelar.isPending}>Voltar</Button>
          <Button variant="destructive" onClick={() => void confirmar()} disabled={curto || cancelar.isPending}>
            {cancelar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
            Cancelar venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
