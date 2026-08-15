import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Calculator, Plus, Trash2, Loader2, ShoppingCart, Package,
  CreditCard, Banknote, QrCode, Lock, Unlock, Settings,
  Check, X, AlertCircle, Receipt,
} from "lucide-react";
import {
  useProdutos, useClientes, useCaixaAberto, useCreateCaixa, useFecharCaixa,
  useCreateVenda, useBaixarEstoqueVenda, useCaixas,
  useCreateSangria, useCreateEntradaExtra, useCaixaConfig, useUpdateCaixaConfig,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { toast } from "sonner";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth } from "@/lib/store/auth-store";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

interface CartItem {
  produto_id: string;
  nome: string;
  sku: string;
  preco_unitario: number;
  preco_custo: number;
  quantidade: number;
  imagem_url?: string | null;
}

export function PDVPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const createVenda = useCreateVenda();
  const baixarEstoque = useBaixarEstoqueVenda();
  const createCaixa = useCreateCaixa();
  const fecharCaixa = useFecharCaixa();
  const createSangria = useCreateSangria();
  const createEntrada = useCreateEntradaExtra();
  const updateCaixaConfig = useUpdateCaixaConfig();

  // Queries
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const { data: clientes = [] } = useClientes();
  const { data: caixaAberto } = useCaixaAberto(user?.id);
  const { data: caixas = [] } = useCaixas(lojaId ?? undefined);
  const { data: configCaixa } = useCaixaConfig();

  const caixasAbertos = caixas.filter((c) => c.status === "aberto");

  // Estados principais
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [desconto, setDesconto] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState(false);

  // Estados de pagamento
  const [forma, setForma] = useState<"dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "crediario" | "boleto">("dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [acrescimo, setAcrescimo] = useState("");

  // Estados de abertura de caixa
  const [saldoInicial, setSaldoInicial] = useState("");
  const [caixaSelecionado, setCaixaSelecionado] = useState<number | null>(null);

  // Estados de modais
  const [modalAbertura, setModalAbertura] = useState(false);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalConfigCaixa, setModalConfigCaixa] = useState(false);
  const [modalCaixasAbertos, setModalCaixasAbertos] = useState(false);
  const [modalConfirmarVenda, setModalConfirmarVenda] = useState(false);
  const [quantidadeCaixas, setQuantidadeCaixas] = useState(2);

  // Calculados
  const subtotal = cart.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  const desc = parseFloat(desconto) || 0;
  const acresc = parseFloat(acrescimo) || 0;
  const totalDesconto = descontoPercentual ? subtotal * (desc / 100) : desc;
  const total = Math.max(0, subtotal - totalDesconto + acresc);
  const valorRec = parseFloat(valorRecebido) || 0;
  // Troco só existe em pagamento em dinheiro
  const troco = forma === "dinheiro" ? Math.max(0, valorRec - total) : 0;

  // Valor esperado em gaveta (para o fechamento de caixa)
  const valorEsperadoCaixa =
    (caixaAberto?.valor_inicial || 0) +
    (caixaAberto?.total_vendas || 0) -
    (caixaAberto?.total_sangrias || 0) +
    (caixaAberto?.total_entradas_extras || 0) -
    (caixaAberto?.valor_troco || 0);

  // Carregar config de caixas
  useEffect(() => {
    if (configCaixa) {
      setQuantidadeCaixas(configCaixa.quantidade_caixas ?? 2);
    }
  }, [configCaixa]);

  // Filtrar produtos
  const filtrados = useMemo(() => {
    if (!search) return produtos.slice(0, 50);
    const s = search.toLowerCase();
    return produtos.filter((p) =>
      p.nome.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(s))
    ).slice(0, 50);
  }, [produtos, search]);

  // Adicionar produto ao carrinho
  const adicionar = useCallback((p: any) => {
    setCart((prev) => {
      const existe = prev.find((i) => i.produto_id === p.id);
      if (existe) {
        return prev.map((i) =>
          i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...prev, {
        produto_id: p.id,
        nome: p.nome,
        sku: p.sku,
        preco_unitario: Number(p.preco_venda),
        preco_custo: Number(p.preco_custo),
        quantidade: 1,
        imagem_url: p.imagem_url,
      }];
    });
  }, []);

  // Atualizar quantidade
  const atualizarQuantidade = useCallback((id: string, qtd: number) => {
    if (qtd <= 0) {
      setCart((prev) => prev.filter((i) => i.produto_id !== id));
    } else {
      setCart((prev) =>
        prev.map((i) => (i.produto_id === id ? { ...i, quantidade: qtd } : i))
      );
    }
  }, []);

  // Remover item
  const remover = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.produto_id !== id));
  }, []);

  // Limpar carrinho
  const limparCarrinho = useCallback(() => {
    setCart([]);
    setDesconto("");
    setAcrescimo("");
    setValorRecebido("");
    setForma("dinheiro");
  }, []);

  // Abrir caixa
  const handleAbrirCaixa = async () => {
    if (!user || !lojaId || !caixaSelecionado) return;
    await createCaixa.mutateAsync({
      loja_id: lojaId,
      usuario_id: user.id,
      numero_caixa: caixaSelecionado,
      valor_inicial: parseFloat(saldoInicial) || 0,
      data_abertura: new Date().toISOString(),
      status: "aberto",
    });
    setModalAbertura(false);
    setSaldoInicial("");
  };

  // Fechar caixa (valor final = valor contado em gaveta pelo operador)
  const [valorContado, setValorContado] = useState("");

  const handleFecharCaixa = async () => {
    if (!caixaAberto) return;
    const contado = parseFloat(valorContado);
    if (isNaN(contado) || contado < 0) {
      toast.error("Informe o valor contado em gaveta para fechar o caixa.");
      return;
    }
    try {
      await fecharCaixa.mutateAsync({
        caixaId: caixaAberto.id,
        valorFinal: contado,
        valorDinheiro: contado,
        observacoes: "",
        encerradoPor: user?.id,
      });
      setModalFechamento(false);
      setValorContado("");
      limparCarrinho();
      toast.success("Caixa fechado com sucesso.");
    } catch (err: any) {
      toast.error(`Erro ao fechar caixa: ${err?.message ?? "erro desconhecido"}`);
    }
  };

  // Finalizar venda
  const handleFinalizarVenda = async () => {
    if (!lojaId || !user || cart.length === 0) return;

    const custoTotal = cart.reduce((s, i) => s + i.preco_custo * i.quantidade, 0);

    try {
      await createVenda.mutateAsync({
        loja_id: lojaId,
        cliente_id: clienteId || null,
        usuario_id: user.id,
        subtotal,
        desconto: totalDesconto,
        desconto_percentual: descontoPercentual ? desc : 0,
        acrescimo: acresc,
        troco,
        valor_recebido: valorRec,
        total,
        custo_total: custoTotal,
        lucro_total: total - custoTotal,
        forma_pagamento: forma,
        status: "finalizada",
        tipo_venda: "pdv",
        observacoes: "",
        numero_pedido: 0,
        itens: cart.map((i) => ({
          produto_id: i.produto_id,
          nome: i.nome,
          preco_unitario: i.preco_unitario,
          preco_custo: i.preco_custo,
          quantidade: i.quantidade,
          subtotal: i.preco_unitario * i.quantidade,
        })),
        caixa_id: caixaAberto?.id,
      });

      // Baixar estoque
      await baixarEstoque.mutateAsync({
        lojaId,
        itens: cart,
      });

      limparCarrinho();
      setModalConfirmarVenda(false);
      toast.success("Venda finalizada com sucesso.");
    } catch (err: any) {
      console.error("Erro ao finalizar venda:", err);
      toast.error(
        `Erro ao finalizar venda: ${err?.message ?? "erro desconhecido"}. Verifique antes de tentar novamente.`,
        { duration: 10000 }
      );
    }
  };

  // Sangria
  const [sangriaValor, setSangriaValor] = useState("");
  const [sangriaMotivo, setSangriaMotivo] = useState("");
  const [modalSangria, setModalSangria] = useState(false);

  const handleSangria = async () => {
    if (!caixaAberto || !user || !sangriaValor || !sangriaMotivo) return;
    await createSangria.mutateAsync({
      caixa_id: caixaAberto.id,
      usuario_id: user.id,
      valor: parseFloat(sangriaValor),
      motivo: sangriaMotivo,
    });
    setSangriaValor("");
    setSangriaMotivo("");
    setModalSangria(false);
  };

  // Entrada Extra
  const [entradaValor, setEntradaValor] = useState("");
  const [entradaMotivo, setEntradaMotivo] = useState("");
  const [modalEntrada, setModalEntrada] = useState(false);

  const handleEntrada = async () => {
    if (!caixaAberto || !user || !entradaValor || !entradaMotivo) return;
    await createEntrada.mutateAsync({
      caixa_id: caixaAberto.id,
      usuario_id: user.id,
      valor: parseFloat(entradaValor),
      motivo: entradaMotivo,
      forma_pagamento: forma,
    });
    setEntradaValor("");
    setEntradaMotivo("");
    setModalEntrada(false);
  };

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="PDV / Frente de Caixa" />;

  // =================== RENDER ===================
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Frente de Caixa - PDV</h1>
          {caixaAberto ? (
            <Badge variant="default" className="bg-green-600">
              <Unlock className="h-3 w-3 mr-1" />
              Caixa #{caixaAberto.numero_caixa} Aberto
            </Badge>
          ) : (
            <Badge variant="destructive">
              <Lock className="h-3 w-3 mr-1" />
              Caixa Fechado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalCaixasAbertos(true)}>
            Caixas em Aberto
          </Button>
          <Button variant="outline" size="sm" onClick={() => setModalConfigCaixa(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Configurações
          </Button>
          {caixaAberto && (
            <>
              <Button variant="outline" size="sm" onClick={() => setModalSangria(true)}>
                Sangria
              </Button>
              <Button variant="outline" size="sm" onClick={() => setModalEntrada(true)}>
                Entrada Extra
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setModalFechamento(true)}>
                Fechar Caixa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sem caixa aberto - mostrar abertura */}
      {!caixaAberto ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Card 1: Selecionar Caixa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selecione o Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: quantidadeCaixas }, (_, i) => i + 1).map((n) => (
                    <Button
                      key={n}
                      variant={caixaSelecionado === n ? "default" : "outline"}
                      onClick={() => setCaixaSelecionado(n)}
                    >
                      CAIXA {String(n).padStart(3, "0")}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Usuário e Saldo Inicial */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Abertura de Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Operador</Label>
                    <Input value={user?.nome || ""} disabled />
                  </div>
                  <div>
                    <Label>Saldo Inicial (Troco)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={saldoInicial}
                      onChange={(e) => setSaldoInicial(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  disabled={!caixaSelecionado}
                  onClick={() => setModalAbertura(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Abrir Caixa
                </Button>
              </CardContent>
            </Card>

            {/* Card 3: Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Selecione um caixa e clique em "Abrir Caixa" para iniciar as vendas.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Com caixa aberto - mostrar PDV */
        <div className="flex-1 flex overflow-hidden">
          {/* Painel Esquerdo: Produtos */}
          <div className="flex-1 flex flex-col overflow-hidden border-r">
            {/* Busca */}
            <div className="p-4 border-b">
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
            </div>

            {/* Grid de Produtos */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtrados.map((p) => (
                  <Card
                    key={p.id}
                    className="hover:border-primary cursor-pointer transition-all hover:shadow-md"
                    onClick={() => adicionar(p)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{p.nome}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">{p.sku}</p>
                        </div>
                        {p.imagem_url && (
                          <img src={p.imagem_url} alt="" className="h-10 w-10 object-cover rounded" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-green-600">{brl(p.preco_venda)}</span>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filtrados.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Painel Direito: Carrinho e Pagamento */}
          <div className="w-[420px] flex flex-col overflow-hidden bg-muted/30">
            {/* Cliente */}
            <div className="p-4 border-b">
              <Label className="text-xs">Cliente</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm mt-1"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Consumidor Final</option>
                {clientes.slice(0, 50).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_razao}</option>
                ))}
              </select>
            </div>

            {/* Carrinho */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Carrinho
                  </h3>
                  <span className="text-xs text-muted-foreground">{cart.length} item(s)</span>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Carrinho vazio</p>
                    <p className="text-xs">Clique em um produto para adicionar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.produto_id} className="flex items-center gap-2 p-2 bg-background rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium line-clamp-1">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {brl(item.preco_unitario)} x {item.quantidade}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => atualizarQuantidade(item.produto_id, item.quantidade - 1)}
                          >
                            <span className="text-xs">-</span>
                          </Button>
                          <span className="text-xs w-6 text-center">{item.quantidade}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => remover(item.produto_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <p className="text-xs font-semibold">{brl(item.preco_unitario * item.quantidade)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Totais e Pagamento */}
            <div className="border-t bg-background p-4 space-y-3">
              {/* Subtotal */}
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>

              {/* Desconto */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Desconto</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={desconto}
                      onChange={(e) => setDesconto(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      variant={descontoPercentual ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setDescontoPercentual(!descontoPercentual)}
                    >
                      %
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Acréscimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={acrescimo}
                    onChange={(e) => setAcrescimo(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>TOTAL</span>
                <span className="text-green-600">{brl(total)}</span>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <Label className="text-xs">Forma de Pagamento</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { value: "dinheiro", label: "Dinheiro", icon: Banknote },
                    { value: "pix", label: "PIX", icon: QrCode },
                    { value: "cartao_credito", label: "Crédito", icon: CreditCard },
                    { value: "cartao_debito", label: "Débito", icon: CreditCard },
                    { value: "crediario", label: "Crediário", icon: Receipt },
                    { value: "boleto", label: "Boleto", icon: Receipt },
                  ].map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={forma === value ? "default" : "outline"}
                      size="sm"
                      className="h-auto py-2 flex-col gap-1"
                      onClick={() => {
                        if (forma !== value) setValorRecebido("");
                        setForma(value as any);
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Valor Recebido (para dinheiro) */}
              {forma === "dinheiro" && (
                <div>
                  <Label className="text-xs">Valor Recebido</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="R$ 0,00"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="h-9 text-base"
                  />
                  {troco > 0 && (
                    <div className="flex justify-between mt-1 text-sm text-muted-foreground">
                      <span>Troco</span>
                      <span className="text-orange-600 font-semibold">{brl(troco)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={limparCarrinho}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={cart.length === 0}
                  onClick={() => setModalConfirmarVenda(true)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Finalizar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Abertura de Caixa */}
      <Dialog open={modalAbertura} onOpenChange={setModalAbertura}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center">
              Deseja Realmente Abrir o Caixa #{caixaSelecionado} com Valor Inicial (Troco) de:
            </p>
            <p className="text-center text-2xl font-bold mt-2">
              {brl(parseFloat(saldoInicial) || 0)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAbertura(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAbrirCaixa} disabled={createCaixa.isPending}>
              {createCaixa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmação de Venda */}
      <Dialog open={modalConfirmarVenda} onOpenChange={setModalConfirmarVenda}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Venda</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <div className="flex justify-between">
              <span>Itens:</span>
              <span>{cart.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{brl(subtotal)}</span>
            </div>
            {totalDesconto > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Desconto:</span>
                <span>-{brl(totalDesconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span className="text-green-600">{brl(total)}</span>
            </div>
            {forma === "dinheiro" && (
              <>
                <div className="flex justify-between">
                  <span>Recebido:</span>
                  <span>{brl(valorRec)}</span>
                </div>
                <div className="flex justify-between text-orange-600 font-semibold">
                  <span>Troco:</span>
                  <span>{brl(troco)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Forma:</span>
              <span className="capitalize">{forma.replace("_", " ")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfirmarVenda(false)}>
              Voltar
            </Button>
            <Button onClick={handleFinalizarVenda} disabled={createVenda.isPending || baixarEstoque.isPending} className="bg-green-600 hover:bg-green-700">
              {createVenda.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Fechamento de Caixa */}
      <Dialog open={modalFechamento} onOpenChange={setModalFechamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechamento de Caixa</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex justify-between">
              <span>Caixa #{caixaAberto?.numero_caixa}:</span>
              <span>{user?.nome || "Operador"}</span>
            </div>
            <div className="flex justify-between">
              <span>Abertura:</span>
              <span>{caixaAberto?.data_abertura ? new Date(caixaAberto.data_abertura).toLocaleString("pt-BR") : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span>Saldo Inicial:</span>
              <span>{brl(caixaAberto?.valor_inicial || 0)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Vendas:</span>
              <span className="text-green-600">{brl(caixaAberto?.total_vendas || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Sangrias:</span>
              <span className="text-red-600">-{brl(caixaAberto?.total_sangrias || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Entradas:</span>
              <span className="text-green-600">+{brl(caixaAberto?.total_entradas_extras || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Troco:</span>
              <span className="text-red-600">-{brl(caixaAberto?.valor_troco || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Valor Esperado em Gaveta:</span>
              <span className="text-primary">{brl(valorEsperadoCaixa)}</span>
            </div>
            <div className="border-t pt-3">
              <Label>Valor contado em gaveta</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="R$ 0,00"
                value={valorContado}
                onChange={(e) => setValorContado(e.target.value)}
                className="mt-1"
              />
              {valorContado !== "" && !isNaN(parseFloat(valorContado)) && (
                <p className={`text-xs mt-1 ${parseFloat(valorContado) - valorEsperadoCaixa === 0 ? "text-green-600" : "text-orange-600"}`}>
                  Diferença: {brl(parseFloat(valorContado) - valorEsperadoCaixa)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalFechamento(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleFecharCaixa}
              disabled={fecharCaixa.isPending || valorContado === ""}
            >
              {fecharCaixa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fechar Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Sangria */}
      <Dialog open={modalSangria} onOpenChange={setModalSangria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Sangria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={sangriaValor} onChange={(e) => setSangriaValor(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={sangriaMotivo} onChange={(e) => setSangriaMotivo(e.target.value)} placeholder="Ex: Repasse ao gerente" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalSangria(false)}>Cancelar</Button>
            <Button onClick={handleSangria} disabled={!sangriaValor || !sangriaMotivo || createSangria.isPending}>
              {createSangria.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Entrada Extra */}
      <Dialog open={modalEntrada} onOpenChange={setModalEntrada}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrada Extra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={entradaValor} onChange={(e) => setEntradaValor(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={entradaMotivo} onChange={(e) => setEntradaMotivo(e.target.value)} placeholder="Ex: Suprimento" />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={forma}
                onChange={(e) => setForma(e.target.value as any)}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="cartao_debito">Cartão Débito</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEntrada(false)}>Cancelar</Button>
            <Button onClick={handleEntrada} disabled={!entradaValor || !entradaMotivo || createEntrada.isPending}>
              {createEntrada.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Configurações de Caixa */}
      <Dialog open={modalConfigCaixa} onOpenChange={setModalConfigCaixa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações de Caixa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Quantidade de Caixas</Label>
            <Input
              type="number"
              min="1"
              max="99"
              value={quantidadeCaixas}
              onChange={(e) => setQuantidadeCaixas(parseInt(e.target.value) || 2)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quantidade máxima de caixas operacionais no sistema.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfigCaixa(false)}>Cancelar</Button>
            <Button
              disabled={updateCaixaConfig.isPending}
              onClick={async () => {
                try {
                  await updateCaixaConfig.mutateAsync(quantidadeCaixas);
                  setModalConfigCaixa(false);
                  toast.success("Configuração de caixas salva.");
                } catch (err: any) {
                  toast.error(`Erro ao salvar configuração: ${err?.message ?? "erro desconhecido"}`);
                }
              }}
            >
              {updateCaixaConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Caixas em Aberto */}
      <Dialog open={modalCaixasAbertos} onOpenChange={setModalCaixasAbertos}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Caixas em Aberto</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {caixasAbertos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum caixa aberto no momento.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Caixa</th>
                    <th className="text-left p-2">Usuário</th>
                    <th className="text-left p-2">Abertura</th>
                    <th className="text-left p-2">Saldo Inicial</th>
                    <th className="text-left p-2">Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {caixasAbertos.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="p-2">#{c.numero_caixa || "-"}</td>
                      <td className="p-2">{(c as any).usuario?.nome || "-"}</td>
                      <td className="p-2">
                        {c.data_abertura ? new Date(c.data_abertura).toLocaleString("pt-BR") : "-"}
                      </td>
                      <td className="p-2">{brl(c.valor_inicial || 0)}</td>
                      <td className="p-2 text-green-600">{brl(c.total_vendas || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCaixasAbertos(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
