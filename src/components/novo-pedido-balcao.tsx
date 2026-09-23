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

import { useEffect, useMemo, useState } from "react";
import { Bike, Loader2, Plus, MapPin, Trash2, Check } from "lucide-react";
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
import {
  useClientes, useCreatePedido, useRegioesEntrega, useProdutos,
  useEnderecosPessoa, useSalvarEnderecoPessoa,
} from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/format";

const VAZIO = {
  cliente_id: "", cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf: "", referencia: "",
  taxa: "0", forma: "dinheiro", troco_para: "", previsao: "", observacoes: "",
};

type ItemPedido = { produto_id: string | null; nome: string; quantidade: number; preco_unitario: number };

export function NovoPedidoBalcaoDialog({
  open, onOpenChange, lojaId,
}: { open: boolean; onOpenChange: (v: boolean) => void; lojaId?: string | null }) {
  const { data: clientes = [] } = useClientes();
  const { data: regioes = [] } = useRegioesEntrega();
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const criar = useCreatePedido();
  const salvarEndereco = useSalvarEnderecoPessoa();
  const [form, setForm] = useState(VAZIO);
  const [regiao, setRegiao] = useState("");

  // ---- produtos que vão na entrega ----
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [produtoEscolhido, setProdutoEscolhido] = useState("");
  const [qtdItem, setQtdItem] = useState("1");

  const totalItens = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const totalPedido = totalItens + (Number(form.taxa) || 0);

  const adicionarItem = () => {
    const p = (produtos as any[]).find((x) => x.id === produtoEscolhido);
    if (!p) { toast.error("Escolha o produto."); return; }
    const q = Math.max(1, parseFloat(qtdItem) || 1);
    setItens((cur) => {
      const i = cur.findIndex((x) => x.produto_id === p.id);
      if (i >= 0) {
        const novo = [...cur];
        novo[i] = { ...novo[i], quantidade: novo[i].quantidade + q };
        return novo;
      }
      return [...cur, { produto_id: p.id, nome: p.nome, quantidade: q, preco_unitario: Number(p.preco_venda) || 0 }];
    });
    setProdutoEscolhido(""); setQtdItem("1");
  };

  // ---- endereços salvos do cliente ----
  const { data: enderecos = [] } = useEnderecosPessoa(form.cliente_id || undefined);
  const [enderecoEscolhido, setEnderecoEscolhido] = useState<string | null>(null);
  const [salvarNoCadastro, setSalvarNoCadastro] = useState(true);

  /** Mexer no endereço reabre a opção de gravar a correção no cadastro. */
  const editouEndereco = (campo: string, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (enderecoEscolhido) setSalvarNoCadastro(true);
  };

  const usarEndereco = (e: any) => {
    setEnderecoEscolhido(e.id);
    setForm((f) => ({
      ...f,
      cep: e.cep ?? "", logradouro: e.logradouro ?? "", numero: e.numero ?? "",
      complemento: e.complemento ?? "", bairro: e.bairro ?? "", cidade: e.cidade ?? "",
      uf: e.uf ?? "", referencia: e.referencia ?? "",
    }));
    // endereço vindo do cadastro não precisa ser salvo de novo
    setSalvarNoCadastro(false);
  };

  // ao trocar de cliente, o endereço padrão dele já entra no formulário
  useEffect(() => {
    if (!form.cliente_id) { setEnderecoEscolhido(null); return; }
    const padrao = (enderecos as any[]).find((e) => e.padrao) ?? (enderecos as any[])[0];
    if (padrao && !enderecoEscolhido) usarEndereco(padrao);
  }, [enderecos, form.cliente_id]);

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
      const pedido = await criar.mutateAsync({
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
      // itens depois do pedido: a FK exige o pedido existindo. Falha aqui não
      // perde o pedido — ele fica na esteira e os itens podem ser refeitos.
      if (itens.length > 0 && pedido?.id) {
        const { error } = await supabase.from("erp_pedido_itens").insert(
          itens.map((i) => ({
            pedido_id: pedido.id, produto_id: i.produto_id, nome: i.nome,
            quantidade: i.quantidade, preco_unitario: i.preco_unitario,
            subtotal: i.quantidade * i.preco_unitario,
          })),
        );
        if (error) toast.warning(`Pedido criado, mas os produtos não foram gravados: ${error.message}`);
      }

      // guarda o endereço no cadastro, para o próximo pedido deste cliente
      if (salvarNoCadastro && form.cliente_id) {
        try {
          await salvarEndereco.mutateAsync({
            // com id, atualiza o endereço escolhido; sem id, cria outro —
            // corrigir o número da casa não pode virar endereço duplicado
            ...(enderecoEscolhido ? { id: enderecoEscolhido } : {}),
            pessoa_id: form.cliente_id,
            apelido: form.referencia?.slice(0, 30) || "Entrega",
            cep: form.cep || null, logradouro: form.logradouro, numero: form.numero,
            complemento: form.complemento || null, bairro: form.bairro || null,
            cidade: form.cidade || null, uf: form.uf || null,
            referencia: form.referencia || null,
            // o primeiro endereço do cliente já vira o padrão
            padrao: enderecos.length === 0,
          });
        } catch (e: any) {
          toast.warning(`Pedido criado; o endereço não foi salvo no cadastro: ${e.message ?? e}`);
        }
      }

      toast.success(
        itens.length
          ? `Pedido criado com ${itens.length} produto(s) — está na coluna Pagamento.`
          : "Pedido criado — está na coluna Pagamento da esteira.",
      );
      setForm(VAZIO); setRegiao(""); setItens([]); setEnderecoEscolhido(null); setSalvarNoCadastro(true);
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

          {/* Endereços que o cliente já usou: escolher em vez de ditar a rua
              toda vez. Clicar carrega nos campos abaixo, que continuam
              editáveis — endereço muda, e o do pedido é o que vale. */}
          {form.cliente_id && enderecos.length > 0 && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs">
                <MapPin className="h-3.5 w-3.5" /> Endereços salvos deste cliente
              </Label>
              <div className="flex flex-wrap gap-2">
                {(enderecos as any[]).map((e) => (
                  <button key={e.id} type="button" onClick={() => usarEndereco(e)}
                    className={`rounded-md border px-3 py-1.5 text-left text-xs transition ${
                      enderecoEscolhido === e.id ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
                    <span className="font-medium">
                      {enderecoEscolhido === e.id && <Check className="mr-1 inline h-3 w-3" />}
                      {e.apelido || "Endereço"}{e.padrao ? " · padrão" : ""}
                    </span>
                    <span className="block text-muted-foreground">
                      {e.logradouro}, {e.numero}{e.bairro ? ` — ${e.bairro}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => editouEndereco("cep", e.target.value)} placeholder="00000-000" /></div>
            <div className="col-span-2"><Label>Rua *</Label><Input value={form.logradouro} onChange={(e) => editouEndereco("logradouro", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Número *</Label><Input value={form.numero} onChange={(e) => editouEndereco("numero", e.target.value)} /></div>
            <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => editouEndereco("complemento", e.target.value)} placeholder="Apto, bloco" /></div>
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => editouEndereco("bairro", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => editouEndereco("cidade", e.target.value)} /></div>
            <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => editouEndereco("uf", e.target.value.toUpperCase())} /></div>
          </div>
          <div>
            <Label>Ponto de referência</Label>
            <Input value={form.referencia} onChange={(e) => editouEndereco("referencia", e.target.value)}
              placeholder="Ex.: portão verde, em frente à praça" />
          </div>

          {form.cliente_id && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="h-3.5 w-3.5" checked={salvarNoCadastro}
                onChange={(e) => setSalvarNoCadastro(e.target.checked)} />
              {enderecoEscolhido
                ? "Atualizar este endereço no cadastro do cliente"
                : "Guardar este endereço no cadastro do cliente para os próximos pedidos"}
            </label>
          )}

          {/* Produtos da entrega: é a lista de separação de quem monta a
              sacola, e o que compõe o valor do pedido */}
          <div className="rounded-md border p-3">
            <Label className="text-sm font-medium">Produtos que vão na entrega</Label>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <Label className="text-xs">Produto</Label>
                <ComboboxBusca
                  className="mt-1"
                  itens={(produtos as any[]).map((p: any) => ({
                    id: p.id, rotulo: p.nome,
                    detalhe: [p.sku, brl(p.preco_venda)].filter(Boolean).join(" · "),
                  }))}
                  value={produtoEscolhido}
                  onChange={setProdutoEscolhido}
                  vazio="Escolha o produto"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">Qtd</Label>
                <Input type="number" min="1" step="any" className="mt-1" value={qtdItem}
                  onChange={(e) => setQtdItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarItem(); } }} />
              </div>
              <Button type="button" variant="outline" onClick={adicionarItem} disabled={!produtoEscolhido}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </div>

            {itens.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhum produto na entrega. Sem a lista, quem separa a sacola não tem o que conferir.
              </p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-1 text-left">Produto</th>
                    <th className="p-1 text-right">Qtd</th>
                    <th className="p-1 text-right">Unit.</th>
                    <th className="p-1 text-right">Total</th>
                    <th className="p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i, idx) => (
                    <tr key={`${i.produto_id}-${idx}`} className="border-b last:border-0">
                      <td className="p-1">{i.nome}</td>
                      <td className="p-1 text-right tabular-nums">{i.quantidade}</td>
                      <td className="p-1 text-right tabular-nums">{brl(i.preco_unitario)}</td>
                      <td className="p-1 text-right font-medium tabular-nums">{brl(i.quantidade * i.preco_unitario)}</td>
                      <td className="p-1 text-right">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={() => setItens((cur) => cur.filter((_, k) => k !== idx))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t font-medium">
                  <tr>
                    <td className="p-1" colSpan={3}>Produtos</td>
                    <td className="p-1 text-right tabular-nums">{brl(totalItens)}</td>
                    <td />
                  </tr>
                  <tr className="text-muted-foreground">
                    <td className="p-1" colSpan={3}>Taxa de entrega</td>
                    <td className="p-1 text-right tabular-nums">{brl(Number(form.taxa) || 0)}</td>
                    <td />
                  </tr>
                  <tr className="text-base">
                    <td className="p-1" colSpan={3}>Total do pedido</td>
                    <td className="p-1 text-right tabular-nums">{brl(totalPedido)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
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
