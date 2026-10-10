// ============================================================
// Vendas recusadas pelo servidor — ver e resolver.
//
// Venda feita sem internet sobe sozinha quando a conexão volta. Se o servidor
// recusa (estoque, permissão, regra da venda), ela fica guardada SÓ neste
// computador, marcada como recusada. O aviso antigo mandava "verificar em
// Vendas", onde ela não aparece — a loja ficou com "2 vendas recusadas" sem
// saber o que eram (10/10/2026). Aqui: o que foi vendido, o motivo, e as duas
// saídas — tentar de novo (depois de corrigir a causa) ou descartar.
// ============================================================

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { descartarDaFila, reabilitarNaFila, type useFilaVendas } from "@/lib/offline/fila-vendas";
import { brl } from "@/lib/format";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  fila: ReturnType<typeof useFilaVendas>;
}

export function VendasRecusadasDialog({ aberto, aoFechar, fila }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const recusadas = fila.itens.filter((i) => i.status === "bloqueada");

  const tentar = async (item: (typeof recusadas)[number]) => {
    setOcupado(item.uuid_local);
    try {
      await reabilitarNaFila(item);
      const r = await fila.drenar();
      if (r.enviadas > 0) toast.success("Venda enviada.");
      else if (r.falharam > 0) toast.warning("Sem conexão com o servidor agora — ela sobe quando a internet voltar.");
      else toast.warning("O servidor recusou de novo — veja o motivo atualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setOcupado(null);
      await fila.recarregar();
    }
  };

  const descartar = async (item: (typeof recusadas)[number]) => {
    const total = brl(Number(item.payload?.total ?? 0));
    if (!confirm(`Descartar a venda de ${total} feita em ${new Date(item.criado_em).toLocaleString("pt-BR")}?\n\n` +
      "Ela some deste computador e NÃO entra no sistema (nem estoque, nem caixa). Use só se a venda não aconteceu " +
      "ou já foi lançada de novo.")) return;
    setOcupado(item.uuid_local);
    try {
      await descartarDaFila(item.uuid_local);
      toast.success("Venda descartada.");
    } finally {
      setOcupado(null);
      await fila.recarregar();
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" /> Vendas recusadas pelo servidor
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Foram feitas neste computador e o servidor não aceitou ao enviar. Corrija a causa (por exemplo,
          o estoque) e clique em <b>Tentar de novo</b>; se a venda não aconteceu ou já foi lançada, <b>Descarte</b>.
        </p>
        {recusadas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda recusada.</p>
        ) : (
          <div className="space-y-3">
            {recusadas.map((v) => {
              const itens: any[] = v.payload?.itens ?? [];
              return (
                <div key={v.uuid_local} className="rounded-md border border-red-200 p-3 dark:border-red-900">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{brl(Number(v.payload?.total ?? 0))}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.criado_em).toLocaleString("pt-BR")} · {v.tentativas} tentativa(s)
                    </span>
                  </div>
                  <ul className="mt-1 text-sm">
                    {itens.map((i, k) => (
                      <li key={k}>{i.quantidade} × {i.nome} — {brl(Number(i.subtotal ?? 0))}</li>
                    ))}
                  </ul>
                  <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    Motivo: {v.ultimo_erro || "não informado pelo servidor"}
                  </p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => void descartar(v)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Descartar
                    </Button>
                    <Button size="sm" disabled={!!ocupado} onClick={() => void tentar(v)}>
                      {ocupado === v.uuid_local ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                      Tentar de novo
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
