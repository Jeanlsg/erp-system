// ============================================================
// Novo pedido pelo balcão.
//
// A esteira do Ciclo de pedidos funcionava, mas nenhuma tela do ERP criava
// pedido de entrega: as duas fontes previstas (iFood e ExApp) dependem de
// integração que não existe, então o quadro vivia vazio. Quem vende pelo
// caixa e vai entregar não tinha por onde entrar na fila.
//
// O pedido nasce em "Pagamento" e anda pela esteira como qualquer outro —
// com ou sem e-commerce, é o mesmo fluxo de trabalho da loja.
// ============================================================

import { useMemo, useState } from "react";
import { Bike, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputMoeda } from "@/components/ui/input-moeda";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useClientes, useCreatePedido, useRegioesEntrega } from "@/lib/supabase-queries";

const VAZIO = {
  cliente_id: "", cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf: "", referencia: "",
  taxa: "0", forma: "dinheiro", troco_para: "", previsao: "", observacoes: "",
};

export function NovoPedidoBalcaoDialog({
  open, onOpenChange, lojaId,
}: { open: boolean; onOpenChange: (v: boolean) => void; lojaId?: string | null }) {
  const { data: clientes = [] } = useClientes();
  const { data: regioes = [] } = useRegioesEntrega();
  const criar = useCreatePedido();
  const [form, setForm] = useState(VAZIO);
  const [regiao, setRegiao] = useState("");

  const cliente = useMemo(
    () => (clientes as any[]).find((c) => c.id === form.cliente_id),
    [clientes, form.cliente_id],
  );

  const escolherRegiao = (id: string) => {
    setRegiao(id);
    const r = (regioes as any[]).find((x) => x.id === id);
    if (r) setForm((f) => ({ ...f, taxa: String(r.taxa ?? r.valor ?? 0), bairro: f.bairro || (r.nome ?? "") }));
  };

  const salvar = async () => {
    if (!lojaId) { toast.error("Escolha a loja no topo da tela."); return; }
    if (!form.cliente_id) { toast.error("Escolha o cliente do pedido."); return; }
    if (!form.logradouro.trim() || !form.numero.trim()) {
      toast.error("Endereço de entrega precisa de rua e número."); return;
    }
    try {
      await criar.mutateAsync({
        loja_id: lojaId,
        cliente_id: form.cliente_id,
        // a coluna é jsonb: guarda o endereço inteiro, do jeito que foi digitado
        endereco_entrega: {
          cep: form.cep || null, logradouro: form.logradouro, numero: form.numero,
          complemento: form.complemento || null, bairro: form.bairro || null,
          cidade: form.cidade || null, uf: form.uf || null,
          referencia: form.referencia || null,
        },
        tipo_pedido: "balcao",
        taxa_entrega: Number(form.taxa) || 0,
        observacoes: form.observacoes.trim() || null,
        previsao_entrega: form.previsao ? new Date(form.previsao).toISOString() : null,
        status: "pendente",
      });
      toast.success("Pedido criado — está na coluna Pagamento da esteira.");
      setForm(VAZIO); setRegiao("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Não foi possível criar: ${e.message ?? e}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5" /> Novo pedido de entrega
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        <div className="min-w-0 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
          <p className="text-xs text-muted-foreground">
            Para o que foi vendido no balcão e vai ser entregue. Sem e-commerce, sem integração:
            entra na esteira como qualquer outro pedido.
          </p>

          <div>
            <Label>Cliente *</Label>
            <ComboboxBusca
              className="mt-1"
              itens={(clientes as any[]).map((c) => ({
                id: c.id, rotulo: c.nome_razao,
                detalhe: [c.cpf_cnpj, c.celular ?? c.telefone].filter(Boolean).join(" · "),
              }))}
              value={form.cliente_id}
              onChange={(id) => setForm({ ...form, cliente_id: id })}
              vazio="Escolha o cliente"
            />
            {cliente && (cliente.celular || cliente.telefone) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Contato: {cliente.celular ?? cliente.telefone}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" /></div>
            <div className="col-span-2"><Label>Rua *</Label><Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Número *</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Apto, bloco" /></div>
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
            <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
          </div>
          <div>
            <Label>Ponto de referência</Label>
            <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })}
              placeholder="Ex.: portão verde, em frente à praça" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {regioes.length > 0 && (
              <div>
                <Label>Região</Label>
                <Select value={regiao} onValueChange={escolherRegiao}>
                  <SelectTrigger className="mt-0"><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>
                    {(regioes as any[]).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Taxa de entrega</Label>
              <InputMoeda value={form.taxa} onChange={(v) => setForm({ ...form, taxa: String(v) })} />
            </div>
            <div>
              <Label>Pagamento</Label>
              <Select value={form.forma} onValueChange={(v) => setForm({ ...form, forma: v })}>
                <SelectTrigger className="mt-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.forma === "dinheiro" && (
              <div>
                <Label>Troco para</Label>
                <InputMoeda value={form.troco_para} onChange={(v) => setForm({ ...form, troco_para: String(v) })} />
              </div>
            )}
            <div>
              <Label>Previsão de entrega</Label>
              <Input type="datetime-local" value={form.previsao}
                onChange={(e) => setForm({ ...form, previsao: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Ex.: entregar após as 18h" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={criar.isPending || !form.cliente_id}>
            {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Criar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
