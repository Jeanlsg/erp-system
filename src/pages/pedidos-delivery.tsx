// ============================================================
// Página: Ciclo de pedidos — Kanban de logística
//
// Pagamento → Separação → Despacho → Entregue, com o pedido andando por
// arrastar-e-soltar (e por botão, porque tablet no balcão não arrasta bem).
//
// O quadro é a fila de trabalho da loja: o que cada coluna mostra é o que
// alguém precisa FAZER agora — conferir o pagamento, separar a sacola,
// despachar o entregador. Pedido parado há muito tempo na mesma coluna
// fica marcado, porque atraso invisível é pedido esquecido.
// ============================================================

import { useMemo, useState } from "react";
import {
  Bike, CircleDollarSign, Loader2, PackageCheck, PackageOpen, Phone, XCircle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePedidos, useUpdatePedidoStatus, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import { toast } from "sonner";

const COLUNAS = [
  {
    id: "pendente", titulo: "Pagamento", Icone: CircleDollarSign,
    dica: "Pedido novo, aguardando confirmar o pagamento",
    // minutos até o pedido ser considerado atrasado nesta coluna
    alerta_min: 15,
  },
  {
    id: "em_preparo", titulo: "Separação", Icone: PackageOpen,
    dica: "Pagamento ok — separar a mercadoria",
    alerta_min: 30,
  },
  {
    id: "saiu_entrega", titulo: "Despacho", Icone: Bike,
    dica: "Saiu para entrega",
    alerta_min: 90,
  },
  {
    id: "entregue", titulo: "Entregue", Icone: PackageCheck,
    dica: "Concluído",
    alerta_min: 0,
  },
] as const;

type StatusCol = (typeof COLUNAS)[number]["id"];
const ORDEM: StatusCol[] = ["pendente", "em_preparo", "saiu_entrega", "entregue"];

function minutosDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}
function tempoCurto(min: number): string {
  if (min < 60) return `${min}min`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
  return `${Math.floor(min / 60 / 24)}d`;
}

export function PedidosDeliveryPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: pedidos = [], isLoading } = usePedidos({ lojaId: lojaId ?? undefined });
  const update = useUpdatePedidoStatus();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<StatusCol | null>(null);

  const porColuna = useMemo(() => {
    const m = new Map<string, any[]>(COLUNAS.map((c) => [c.id, []]));
    for (const p of pedidos) {
      if (m.has(p.status)) m.get(p.status)!.push(p);
    }
    return m;
  }, [pedidos]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Pedidos" />;

  async function mover(id: string, para: StatusCol) {
    try {
      await update.mutateAsync({ id, status: para });
    } catch (e: any) {
      toast.error(`Falha ao mover: ${e.message}`);
    }
  }

  async function cancelar(p: any) {
    if (!window.confirm(`Cancelar o pedido de ${p.cliente?.nome_razao ?? "cliente"}?`)) return;
    await mover(p.id, "cancelado" as StatusCol);
  }

  const cancelados = pedidos.filter((p: any) => p.status === "cancelado").length;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ciclo de pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Arraste o pedido pela esteira — ou use o botão do cartão. Pedido parado além do
          normal fica marcado em vermelho.
          {cancelados > 0 && ` · ${cancelados} cancelado(s) hoje fora do quadro.`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> carregando…
        </div>
      ) : (
        <div className="grid flex-1 gap-3 overflow-x-auto md:grid-cols-4" style={{ minWidth: 0 }}>
          {COLUNAS.map((col) => {
            const itens = porColuna.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                className={`flex min-h-[16rem] flex-col rounded-lg border bg-muted/30 ${
                  sobre === col.id ? "border-primary bg-primary/5" : ""
                }`}
                onDragOver={(e) => { e.preventDefault(); setSobre(col.id); }}
                onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const id = e.dataTransfer.getData("text/pedido");
                  if (id) void mover(id, col.id);
                }}
              >
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <col.Icone className="h-4 w-4" /> {col.titulo}
                    <Badge variant="outline" className="ml-1">{itens.length}</Badge>
                  </div>
                </div>
                <p className="px-3 pt-1 text-[11px] text-muted-foreground">{col.dica}</p>

                <div className="flex flex-1 flex-col gap-2 p-2">
                  {itens.map((p: any) => {
                    const min = minutosDesde(p.created_at);
                    const atrasado = col.alerta_min > 0 && min > col.alerta_min;
                    const prox = ORDEM[ORDEM.indexOf(col.id) + 1];
                    const tel = p.cliente?.celular ?? p.cliente?.telefone;
                    return (
                      <Card
                        key={p.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/pedido", p.id);
                          setArrastando(p.id);
                        }}
                        onDragEnd={() => setArrastando(null)}
                        className={`cursor-grab active:cursor-grabbing ${
                          arrastando === p.id ? "opacity-50" : ""
                        } ${atrasado ? "border-red-400" : ""}`}
                      >
                        <CardContent className="space-y-1.5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {p.cliente?.nome_razao ?? "Sem cliente"}
                              </p>
                              {p.venda?.numero_pedido != null && (
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  venda #{p.venda.numero_pedido}
                                </p>
                              )}
                            </div>
                            <span className={`whitespace-nowrap font-mono text-[11px] ${
                              atrasado ? "font-semibold text-red-600" : "text-muted-foreground"
                            }`}>
                              {tempoCurto(min)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{brl(Number(p.venda?.total ?? 0) + Number(p.taxa_entrega ?? 0))}</span>
                            <span className="text-[11px] text-muted-foreground">{String(p.forma_pagamento ?? "")}</span>
                          </div>

                          {p.endereco_entrega?.bairro && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {p.endereco_entrega.logradouro ?? ""} {p.endereco_entrega.numero ?? ""} · {p.endereco_entrega.bairro}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex gap-1">
                              {tel && (
                                <a href={`https://wa.me/${String(tel).replace(/\D/g, "")}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-muted-foreground hover:text-foreground" title="Chamar no WhatsApp">
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {col.id !== "entregue" && (
                                <button onClick={() => void cancelar(p)}
                                  className="text-muted-foreground hover:text-red-600" title="Cancelar pedido">
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {prox && (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                disabled={update.isPending}
                                onClick={() => void mover(p.id, prox)}>
                                {COLUNAS.find((c) => c.id === prox)!.titulo} →
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {itens.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
