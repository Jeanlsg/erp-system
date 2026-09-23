import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Calculator, Plus, Trash2, Loader2, ShoppingCart,
  CreditCard, Banknote, QrCode, Lock, Unlock, Settings,
  Check, X, AlertCircle, Receipt, CloudOff, RefreshCw, Cloud, Camera,
  UserPlus,
  Search, Keyboard,
  Bike,
} from "lucide-react";
import { useProdutos, useClientes, useCreateCaixa, useFecharCaixa, useKits, useCaixas, useCreateSangria, useCreateEntradaExtra, useEmitirNFeVenda, isSupabaseConfigured, useVendedores, useEstoqueLoja, usePontosVenda, useCriarPontoVenda, useConfigsCaixa, useSaldosPedidos, useAplicarEntradaPedido, useCaixasAbertosDoUsuario, useCaixasPermitidos } from "@/lib/supabase-queries";
import { lojaEfetivaDoPdv } from "@/lib/loja-do-caixa";
import { pontosQuePodeAbrir, caixaAtivo, podeVariosCaixas } from "@/lib/caixas-permitidos";
import { formasParaDeclarar as escolherFormas, faltaDeclarar as temFormaPendente, argumentosDeFechamento } from "@/lib/fechamento-por-forma";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAuth, useAuthStore } from "@/lib/store/auth-store";
import { usePdvModo } from "@/lib/store/pdv-modo";
import { imprimirComprovante } from "@/lib/comprovante-fechamento";
import { montarDadosFechamento } from "@/lib/dados-fechamento";
import { supabase } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";
import { useConexao } from "@/lib/offline/conexao";
import { registrarVenda, useFilaVendas } from "@/lib/offline/fila-vendas";
import { useCatalogoOffline } from "@/lib/offline/catalogo";
import { LeitorCodigoBarras } from "@/components/leitor-codigo-barras";
import { useLeitorUsb } from "@/lib/use-leitor-usb";
import { useAtalhosPdv, type Atalho } from "@/lib/use-atalhos-pdv";
import { documentoValido, mascaraDocumento } from "@/lib/documento";
import { ComboboxBusca } from "@/components/ui/combobox-busca";
import { ClienteRapidoPdvDialog } from "@/components/cliente-rapido-pdv";
import {
  PagamentosVenda, faltaPagar, trocoDe, type Pagamento,
} from "@/components/pagamentos-venda";

interface CartItem {
  produto_id: string;          // para kit: o id do kit (kit_id === produto_id)
  kit_id?: string;             // presente quando a linha é um kit
  nome: string;
  sku: string;
  preco_unitario: number;
  preco_custo: number;
  quantidade: number;
  imagem_url?: string | null;
  /** desconto NESTA linha, em reais. O desconto geral continua à parte. */
  desconto?: number;
}

export function PDVPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Quem manda na loja é o CAIXA ABERTO, não o seletor do topo.
  //
  // Com o caixa #1 aberto em Juazeiro, trocar a loja no cabeçalho fazia a
  // venda ser gravada com loja_id de Petrolina amarrada ao caixa de Juazeiro:
  // estoque baixado na loja errada e a venda fora do fechamento do caixa que
  // a recebeu. O seletor do topo só vale enquanto não há caixa aberto — é
  // assim que se escolhe ONDE abrir.
  // O admin pode manter mais de um caixa aberto (migration 092) e alternar
  // entre eles — caixa 1 de Petrolina e caixa 1 de Juazeiro ao mesmo tempo.
  // Para as outras contas a lista tem no máximo um elemento, e nada muda.
  // Sair da frente de caixa NÃO fecha o caixa: volta para a tela de seleção,
  // com o turno em aberto, como no sistema anterior da loja (F12). Fica aqui
  // em cima porque a loja da tela depende dele.
  const [saiuDaFrente, setSaiuDaFrente] = useState(false);
  const { data: caixasAbertosMeus = [] } = useCaixasAbertosDoUsuario(user?.id);
  const caixaEscolhidoId = usePdvModo((st) => st.caixaAtivoId);
  const setCaixaEscolhidoId = usePdvModo((st) => st.setCaixaAtivoId);
  const caixaAberto = caixaAtivo(caixasAbertosMeus as any[], caixaEscolhidoId) as any;
  const variosCaixas = podeVariosCaixas(user as any);
  const { lojaId: lojaDoCabecalho, lojas } = useAutoSelectLoja();
  // Fora da frente de venda a loja volta a seguir o cabeçalho: é de lá que o
  // admin abre um segundo caixa, quase sempre na outra loja.
  const lojaId = lojaEfetivaDoPdv(caixaAberto as any, lojaDoCabecalho, !saiuDaFrente);
  const emitirNFCe = useEmitirNFeVenda();
  const createCaixa = useCreateCaixa();
  const fecharCaixa = useFecharCaixa();
  // Regras de conferência ligadas pelo dono em Configurações Gerais (090)
  const { exigirValoresPorForma, ocultarEsperado } = useConfigsCaixa();
  const createSangria = useCreateSangria();
  const createEntrada = useCreateEntradaExtra();

  // Conexão e fila offline: o caixa não pode parar quando a internet cai.
  const online = useConexao();
  const fila = useFilaVendas(online);

  // Queries
  const { data: produtosServidor = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  // O saldo NÃO vem em erp_produtos (mora em erp_estoque, por loja). Sem este
  // mapa, "Qtd. Estoque" ficaria vazio e o aviso de estoque zerado dispararia
  // para todo produto — `Number(undefined ?? 0) <= 0` é verdadeiro.
  const { data: estoqueDaLoja = [] } = useEstoqueLoja(lojaId ?? undefined);
  const saldoPorProduto = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of estoqueDaLoja as any[]) m.set(e.produto_id, Number(e.quantidade) || 0);
    return m;
  }, [estoqueDaLoja]);
  /** Saldo do produto nesta loja; null quando não há posição cadastrada. */
  const saldoDe = useCallback(
    (prod: any) => (prod && saldoPorProduto.has(prod.id) ? saldoPorProduto.get(prod.id)! : null),
    [saldoPorProduto]);
  const { data: kits = [] } = useKits();
  // Kits entram no catálogo como itens vendáveis (o servidor desmembra os
  // componentes na hora da venda). Entram ANTES do espelho offline, então
  // também ficam disponíveis sem internet.
  const vendaveis = useMemo(() => [
    ...produtosServidor,
    ...kits.filter((k: any) => k.ativo && (k.itens?.length ?? 0) > 0).map((k: any) => ({
      id: k.id, nome: k.nome, sku: "KIT",
      preco_venda: k.preco_kit, preco_custo: 0,
      codigo_barras: null, imagem_url: null, ehKit: true,
    })),
  ], [produtosServidor, kits]);
  // Offline, a lista vem do espelho local salvo enquanto havia rede.
  const catalogo = useCatalogoOffline(lojaId, vendaveis, online);
  const produtos = catalogo.produtos;
  const { data: clientes = [] } = useClientes();
  const { data: caixas = [] } = useCaixas(lojaId ?? undefined);

  const caixasAbertos = caixas.filter((c) => c.status === "aberto");

  // Estados principais
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [modalCliente, setModalCliente] = useState(false);

  // ---- linha de lançamento (código → TAB → quantidade) ----
  const campoCodigo = useRef<HTMLInputElement>(null);
  const campoQtd = useRef<HTMLInputElement>(null);
  const [codigo, setCodigo] = useState("");
  const [qtdLinha, setQtdLinha] = useState("1");
  const [produtoNaLinha, setProdutoNaLinha] = useState<any | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState<string | null>(null);
  // Alterar item (F7): quantidade, preço e desconto da LINHA. Antes só dava
  // para somar de um em um pelos botões, e corrigir preço não dava de jeito
  // nenhum — o operador cancelava o item e lançava de novo.
  const [itemEditando, setItemEditando] = useState<CartItem | null>(null);
  const [edQtd, setEdQtd] = useState("");
  const [edPreco, setEdPreco] = useState("");
  const [edDesconto, setEdDesconto] = useState("");
  const [edDescontoPct, setEdDescontoPct] = useState(false);
  const [modalPrecos, setModalPrecos] = useState(false);
  const [modalLocalizar, setModalLocalizar] = useState(false);
  const [modalAtalhos, setModalAtalhos] = useState(false);
  // avisa o casco: com a venda aberta, a tela é do balcão e o menu sai
  const setVendendo = usePdvModo((s) => s.setVendendo);
  useEffect(() => {
    setVendendo(!!caixaAberto && !saiuDaFrente);
    return () => setVendendo(false);   // sair do PDV devolve o menu
  }, [caixaAberto, saiuDaFrente, setVendendo]);

  // ---- caixas cadastrados desta loja ----
  const { data: pontosVendaDaLoja = [] } = usePontosVenda(lojaId ?? undefined);
  // Caixas que ESTA conta pode abrir. O banco recusa de novo no gatilho de
  // abertura; aqui é para não oferecer o que vai ser negado.
  const { data: caixasPermitidos = [] } = useCaixasPermitidos(user?.id);
  const pontosVenda = useMemo(
    () => pontosQuePodeAbrir(pontosVendaDaLoja as any[], caixasPermitidos),
    [pontosVendaDaLoja, caixasPermitidos]);
  // Caixa já aberto não entra na lista de abertura: a gaveta é uma só.
  const pontosLivres = useMemo(() => {
    const ocupados = new Set(
      (caixas as any[]).filter((c) => c.status === "aberto").map((c) => c.ponto_venda_id));
    return pontosVenda.filter((pv: any) => !ocupados.has(pv.id));
  }, [pontosVenda, caixas]);
  const criarPonto = useCriarPontoVenda();
  const [pontoSelecionado, setPontoSelecionado] = useState<string | null>(null);
  const [modalNovoPonto, setModalNovoPonto] = useState(false);
  const [nomeNovoPonto, setNomeNovoPonto] = useState("");

  // Trocar de loja com o caixa fechado tem de limpar a escolha do caixa:
  // "Caixa 1 — Juazeiro" continuava marcado depois de mudar para Petrolina, e
  // o botão de abrir abria o caixa da loja que não estava mais na tela.
  useEffect(() => {
    if (pontoSelecionado && !pontosVenda.some((pv: any) => pv.id === pontoSelecionado)) {
      setPontoSelecionado(null);
      setCaixaSelecionado(null);
    }
  }, [pontosVenda, pontoSelecionado]);

  // Com um caixa só na loja, escolher é burocracia: já vem marcado.
  useEffect(() => {
    if (!pontoSelecionado && pontosVenda.length === 1) {
      setPontoSelecionado(pontosVenda[0].id);
      setCaixaSelecionado(pontosVenda[0].numero);
    }
  }, [pontosVenda, pontoSelecionado]);

  // ---- senha do operador na abertura ----
  const CHAVE_SENHA_LEMBRADA = `erp-senha-caixa-${user?.id ?? ""}`;
  const [senhaAbertura, setSenhaAbertura] = useState("");
  const [lembrarSenha, setLembrarSenha] = useState(false);
  const [senhaLembrada, setSenhaLembrada] = useState(() => {
    try { return localStorage.getItem(`erp-senha-caixa-${useAuthStore.getState().user?.id ?? ""}`) === "1"; }
    catch { return false; }
  });
  // Vendedor da venda: é dele a comissão. Começa no funcionário ligado ao
  // usuário logado; o caixa pode trocar quando vende para outro vendedor.
  const [vendedorId, setVendedorId] = useState("");
  const { user: usuarioLogado } = useAuth();
  const { data: funcionarios = [] } = useVendedores();
  useEffect(() => {
    if (vendedorId || !usuarioLogado?.id) return;
    const meu = funcionarios.find((f: any) => f.usuario_id === usuarioLogado.id);
    if (meu) setVendedorId(meu.id);
  }, [funcionarios, usuarioLogado?.id, vendedorId]);
  const [desconto, setDesconto] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState(false);

  // Estados de pagamento
  const [forma, setForma] = useState<"dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "crediario" | "boleto">("dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [acrescimo, setAcrescimo] = useState("");

  // Estados de abertura de caixa
  const [saldoInicial, setSaldoInicial] = useState("");
  const [caixaSelecionado, setCaixaSelecionado] = useState<number | null>(null);

  // O troco do dia seguinte é o que sobrou na gaveta ontem. Sem isto o
  // operador digitava o valor de cabeça toda manhã — e errar aqui desencontra
  // o fechamento inteiro, porque a diferença é medida contra este número.
  const ultimoFechamento = useMemo(() => {
    if (!caixaSelecionado) return null;
    return (caixas as any[])
      .filter((c) => Number(c.numero_caixa) === Number(caixaSelecionado)
                  && c.status === "fechado" && c.data_fechamento)
      .sort((a, b) => String(b.data_fechamento).localeCompare(String(a.data_fechamento)))[0] ?? null;
  }, [caixas, caixaSelecionado]);

  // sugere, não impõe: só preenche o campo vazio, e o operador pode trocar
  const [saldoVeioDoFechamento, setSaldoVeioDoFechamento] = useState(false);
  useEffect(() => {
    if (!ultimoFechamento || saldoInicial !== "") return;
    const v = Number(ultimoFechamento.valor_final ?? 0);
    if (v > 0) { setSaldoInicial(String(v)); setSaldoVeioDoFechamento(true); }
  }, [ultimoFechamento, saldoInicial]);

  // Estados de modais
  const [modalAbertura, setModalAbertura] = useState(false);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalConfigCaixa, setModalConfigCaixa] = useState(false);
  const [modalCaixasAbertos, setModalCaixasAbertos] = useState(false);
  const [modalConfirmarVenda, setModalConfirmarVenda] = useState(false);
  // Formas com que esta venda está sendo paga. Vazio = uma forma só, pelo
  // seletor de sempre; com linhas, a venda é mista e vai detalhada ao banco.
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [emitirCupom, setEmitirCupom] = useState(false);
  // "É CPF na nota?" — consumidor identificado sem precisar de cadastro
  const [cpfNota, setCpfNota] = useState("");
  const [nomeNota, setNomeNota] = useState("");

  // Calculados
  const subtotal = cart.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  // O desconto por item sai do subtotal antes do desconto geral: são duas
  // coisas diferentes e o operador precisa ver as duas no cupom.
  const descontoItens = cart.reduce((s2, i) => s2 + (Number(i.desconto) || 0), 0);
  const desc = parseFloat(desconto) || 0;
  const acresc = parseFloat(acrescimo) || 0;
  const totalDesconto = (descontoPercentual ? subtotal * (desc / 100) : desc) + descontoItens;
  const total = Math.max(0, subtotal - totalDesconto + acresc);
  const valorRec = parseFloat(valorRecebido) || 0;
  // Troco só existe em pagamento em dinheiro
  const trocoSimples = forma === "dinheiro" ? Math.max(0, valorRec - total) : 0;
  const temPagamentosDetalhados = pagamentos.length > 0;
  const troco = temPagamentosDetalhados ? trocoDe(pagamentos) : trocoSimples;
  // Venda mista não fecha enquanto a soma não cobre o total: dinheiro que
  // falta aqui vira divergência de caixa no fim do dia, e aí ninguém lembra
  // de qual venda foi.
  const faltaReceber = temPagamentosDetalhados ? faltaPagar(total, pagamentos) : 0;

  // O que tem de estar na gaveta, calculado pelo banco (vw_caixa_resumo).
  //
  // Esta conta era refeita aqui somando TODAS as vendas: uma venda de R$ 189
  // no cartão entrava no esperado da gaveta, e o operador que contava certo
  // via o sistema acusar falta de 189. O banco agora separa por forma; o
  // fallback existe só para caixa recém-aberto, antes da view responder.
  const c = caixaAberto as any;
  const valorEsperadoCaixa =
    c?.valor_esperado_gaveta != null
      ? Number(c.valor_esperado_gaveta)
      : (c?.valor_inicial || 0);

  // Carregar config de caixas

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
        ...(p.ehKit ? { kit_id: p.id } : {}),
        nome: p.nome,
        sku: p.sku,
        preco_unitario: Number(p.preco_venda),
        preco_custo: Number(p.preco_custo),
        quantidade: 1,
        imagem_url: p.imagem_url,
      }];
    });
  }, []);

  const abrirEdicaoItem = (item: CartItem) => {
    setItemEditando(item);
    setEdQtd(String(item.quantidade));
    setEdPreco(String(item.preco_unitario));
    setEdDesconto(String(item.desconto ?? 0));
    setEdDescontoPct(false);
  };

  const aplicarEdicaoItem = () => {
    if (!itemEditando) return;
    const qtd = Math.max(1, parseFloat(edQtd) || 1);
    const preco = Math.max(0, parseFloat(edPreco) || 0);
    const bruto = qtd * preco;
    const informado = Math.max(0, parseFloat(edDesconto) || 0);
    const descontoReais = edDescontoPct ? (bruto * informado) / 100 : informado;
    if (descontoReais > bruto) {
      toast.error("O desconto não pode passar do valor do item.");
      return;
    }
    setCart((cur) => cur.map((i) => i.produto_id === itemEditando.produto_id
      ? { ...i, quantidade: qtd, preco_unitario: preco, desconto: Math.round(descontoReais * 100) / 100 }
      : i));
    setItemEditando(null);
  };

  /** Acha o produto por código de barras ou SKU, sem diferenciar maiúscula. */
  const acharPorCodigo = useCallback((c: string) => {
    const t = c.trim();
    if (!t) return null;
    return produtos.find((x: any) =>
      x.codigo_barras === t || (x.sku && String(x.sku).toUpperCase() === t.toUpperCase())) ?? null;
  }, [produtos]);

  /** Lança no cupom o que está na linha e devolve o foco ao código. */
  const lancarPorCodigo = useCallback(() => {
    const p = produtoNaLinha ?? acharPorCodigo(codigo);
    if (!p) {
      toast.error("Produto não encontrado ou não está no catálogo desta loja.");
      campoCodigo.current?.select();
      return;
    }
    const qtd = Math.max(1, parseFloat(qtdLinha) || 1);
    // uma chamada por unidade mantém a soma correta quando o item já está
    // no cupom (adicionar() incrementa de um em um)
    for (let i = 0; i < qtd; i++) adicionar(p);
    setCodigo(""); setQtdLinha("1"); setProdutoNaLinha(null);
    campoCodigo.current?.focus();
  }, [produtoNaLinha, codigo, qtdLinha, acharPorCodigo, adicionar]);

  // o código volta a ser o campo ativo sempre que a venda começa do zero
  useEffect(() => { if (cart.length === 0) campoCodigo.current?.focus(); }, [cart.length]);

  // Leitor por câmera: cada bipe adiciona o produto ao carrinho — o operador
  // passa os itens em sequência sem tocar na tela.
  const [leitorAberto, setLeitorAberto] = useState(false);
  const aoLerCodigo = useCallback((codigo: string) => {
    const c = codigo.trim();
    const p = produtos.find((x: any) =>
      x.codigo_barras === c || (x.sku && x.sku.toUpperCase() === c.toUpperCase()));
    if (!p) {
      toast.error(`Código ${c} não está no catálogo`);
      return;
    }
    adicionar(p);
    toast.success(`${p.nome} adicionado`, { duration: 1500 });
  }, [produtos, adicionar]);

  // Leitor USB (emulação de teclado): bipar em qualquer lugar da tela
  // adiciona o item — sem precisar clicar ou abrir a câmera.
  useLeitorUsb(aoLerCodigo);

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
    setCpfNota("");
    setNomeNota("");
    setDesconto("");
    setAcrescimo("");
    setValorRecebido("");
    setForma("dinheiro");
    setPagamentos([]);
  }, []);

  // Abrir caixa
  /**
   * Confere a senha de quem está assumindo o caixa.
   *
   * O relatório de fechamento mostra o nome do operador; sem confirmar,
   * bastaria uma sessão esquecida aberta para o turno sair no nome errado.
   * A checagem é o próprio login do Supabase — não guardamos senha.
   */
  const conferirSenha = async (): Promise<boolean> => {
    if (senhaLembrada) return true;
    if (!user?.email) return false;
    if (senhaAbertura.length < 4) { toast.error("Informe a senha para assumir o caixa."); return false; }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAbertura });
    if (error) { toast.error("Senha incorreta."); return false; }
    if (lembrarSenha) {
      try { localStorage.setItem(CHAVE_SENHA_LEMBRADA, "1"); setSenhaLembrada(true); } catch { /* aba anônima */ }
    }
    setSenhaAbertura("");
    return true;
  };

  const abrirCaixa = async () => {
    if (!user || !lojaId || !caixaSelecionado) return;
    if (!(await conferirSenha())) return;
    setModalAbertura(true);
  };

  const handleAbrirCaixa = async () => {
    if (!user || !lojaId || !caixaSelecionado) return;
    try {
    const novo = await createCaixa.mutateAsync({
      loja_id: lojaId,
      usuario_id: user.id,
      numero_caixa: caixaSelecionado,
      ponto_venda_id: pontoSelecionado,
      valor_inicial: parseFloat(saldoInicial) || 0,
      data_abertura: new Date().toISOString(),
      status: "aberto",
    });
    // Quem tem vários abertos já vinha com um escolhido: sem isto, abrir o
    // segundo deixaria a tela no primeiro e a venda cairia no caixa errado.
    if ((novo as any)?.id) setCaixaEscolhidoId((novo as any).id);
    setModalAbertura(false);
    setSaldoInicial("");
    setSaiuDaFrente(false);
    } catch (e: any) {
      // O gatilho do banco recusa caixa fora da lista da conta e caixa já
      // aberto por outra pessoa. Sem isto a mensagem se perdia e o operador
      // ficava clicando no botão sem resposta.
      toast.error(`Não foi possível abrir o caixa: ${e?.message ?? e}`);
    }
  };

  // Fechar caixa (valor final = valor contado em gaveta pelo operador)
  const [valorContado, setValorContado] = useState("");
  /** valor declarado pelo operador em cada forma, quando a conferência por forma está ligada */
  const [declarados, setDeclarados] = useState<Record<string, string>>({});

  // "Ocultar valores do fechamento, exceto para o Funcionário Master": o
  // operador conta a gaveta SEM ver o esperado. É controle de rotina contra o
  // ajuste do valor informado — quem vê que faltam R$ 50 tem a tentação de
  // declarar o número que fecha. Não é barreira de segurança: o esperado
  // continua legível na view para quem chamar a API direto.
  const podeVerEsperado = !ocultarEsperado || !!(user as any)?.admin_principal;

  const formasParaDeclarar = escolherFormas(c, podeVerEsperado);
  const faltaDeclarar = temFormaPendente(formasParaDeclarar, declarados, exigirValoresPorForma);

  const handleFecharCaixa = async () => {
    if (!caixaAberto) return;

    // Por forma: a gaveta é o que o operador declarou em dinheiro; as outras
    // formas vão para o fechamento para conferir maquininha e extrato.
    let porForma: Record<string, number> = {};
    if (exigirValoresPorForma) {
      const args = argumentosDeFechamento(formasParaDeclarar, declarados);
      if (!args) {
        toast.error("Informe o valor conferido em todas as formas de pagamento.");
        return;
      }
      porForma = args;
    }

    const contado = exigirValoresPorForma
      ? (porForma.valorDinheiro ?? 0)
      : parseFloat(valorContado);
    if (isNaN(contado) || contado < 0) {
      toast.error("Informe o valor contado em gaveta para fechar o caixa.");
      return;
    }
    try {
      await fecharCaixa.mutateAsync({
        caixaId: caixaAberto.id,
        valorFinal: contado,
        valorDinheiro: contado,
        ...porForma,
        observacoes: "",
        encerradoPor: user?.id,
      });
      // O comprovante sai AGORA — conferência que depende de alguém lembrar
      // de abrir um relatório depois não acontece no fim do expediente. Os
      // dados vêm do banco, no formato do comprovante que a loja já conhece.
      let saiu = false;
      try {
        const dados = await montarDadosFechamento(caixaAberto.id, {
          informado: contado,
          fechamentoEm: new Date().toISOString(),
          operadorFechamento: user?.nome,
        });
        saiu = imprimirComprovante(dados);
      } catch (e: any) {
        // o caixa JÁ fechou; falha no papel não desfaz isso
        toast.warning(`Caixa fechado, mas o comprovante falhou: ${e.message ?? e}. Reimprima em Caixa › histórico.`,
          { duration: 12000 });
      }

      setModalFechamento(false);
      setValorContado("");
      setDeclarados({});
      limparCarrinho();
      toast.success(
        saiu
          ? "Caixa fechado. O comprovante abriu para impressão."
          : "Caixa fechado. O comprovante não abriu — libere pop-ups deste site para imprimir.",
        { duration: saiu ? 4000 : 10000 },
      );
    } catch (err: any) {
      toast.error(`Erro ao fechar caixa: ${err?.message ?? "erro desconhecido"}`);
    }
  };

  // Finalizar venda
  const [finalizando, setFinalizando] = useState(false);
  const handleFinalizarVenda = async () => {
    if (!lojaId || !user || cart.length === 0 || finalizando) return;
    // CPF digitado mas inválido: recusa AGORA, com o cliente na frente —
    // deixar passar viraria rejeição da SEFAZ na hora do cupom.
    if (!clienteId && cpfNota.trim() && !documentoValido(cpfNota)) {
      toast.error("CPF/CNPJ da nota inválido — confira os dígitos ou apague o campo.");
      return;
    }
    setFinalizando(true);

    const custoTotal = cart.reduce((s, i) => s + i.preco_custo * i.quantidade, 0);

    try {
      // Venda, itens e baixa de estoque numa transação só. Antes eram duas
      // chamadas, e a rede caindo entre elas deixava venda sem baixa — o que
      // offline seria a regra, não a exceção.
      const envio = await registrarVenda({
        loja_id: lojaId,
        cliente_id: clienteId || null,
        vendedor_id: vendedorId || null,
        subtotal,
        desconto: totalDesconto,
        desconto_percentual: descontoPercentual ? desc : 0,
        acrescimo: acresc,
        troco,
        valor_recebido: valorRec,
        total,
        custo_total: custoTotal,
        lucro_total: total - custoTotal,
        forma_pagamento: temPagamentosDetalhados
          // a forma "principal" é a de maior valor; o banco reconfere
          ? [...pagamentos].sort((x, y) => y.valor - x.valor)[0].forma
          : forma,
        ...(temPagamentosDetalhados ? { pagamentos } : {}),
        // sem cliente cadastrado, vale o CPF digitado no balcão
        ...(!clienteId && cpfNota.trim()
          ? { consumidor_cpf: cpfNota, consumidor_nome: nomeNota.trim() || undefined }
          : {}),
        status: "finalizada",
        tipo_venda: "pdv",
        observacoes: "",
        itens: cart.map((i) => ({
          ...(i.kit_id ? { kit_id: i.kit_id } : { produto_id: i.produto_id }),
          nome: i.nome,
          preco_unitario: i.preco_unitario,
          preco_custo: i.preco_custo,
          quantidade: i.quantidade,
          desconto: Number(i.desconto) || 0,
          subtotal: i.preco_unitario * i.quantidade - (Number(i.desconto) || 0),
        })),
        caixa_id: caixaAberto?.id,
      });

      limparCarrinho();
      setModalConfirmarVenda(false);
      void fila.recarregar();

      if (!envio.enviada) {
        // Sem rede a venda está guardada localmente e sobe sozinha depois.
        // Dizer isso é diferente de dizer "deu certo": o operador precisa
        // saber que o cupom fiscal ainda não existe.
        toast.warning(
          "Venda registrada no caixa, mas sem internet: ela sobe sozinha quando a conexão voltar.",
          { duration: 8000 },
        );
        return;
      }

      toast.success("Venda finalizada com sucesso.");
      const vendaCriada = envio.resultado;

      // NFC-e é acessória à venda: se a SEFAZ recusar, a venda continua
      // registrada e o cupom pode ser reemitido em Notas Fiscais.
      if (emitirCupom && vendaCriada?.venda_id) {
        try {
          const nota = await emitirNFCe.mutateAsync({
            venda_id: vendaCriada.venda_id,
            loja_id: lojaId,
            tipo: "nfce",
          });
          toast.success(
            `NFC-e nº ${nota.numero} autorizada${nota.ambiente !== "producao" ? " (HOMOLOGAÇÃO — sem valor fiscal)" : ""}.`
          );
        } catch (errNota: any) {
          toast.error(
            `Venda registrada, mas a NFC-e falhou: ${errNota?.message ?? "erro desconhecido"}. Emita em Notas Fiscais.`,
            { duration: 12000 }
          );
        }
      }
    } catch (err: any) {
      console.error("Erro ao finalizar venda:", err);
      // Erro de regra (estoque, permissão) — a venda ficou na fila marcada
      // como bloqueada, então não some, mas também não sobe sozinha.
      toast.error(
        `Erro ao finalizar venda: ${err?.message ?? "erro desconhecido"}. Verifique antes de tentar novamente.`,
        { duration: 10000 }
      );
      void fila.recarregar();
    } finally {
      setFinalizando(false);
    }
  };

  // Sangria
  const [sangriaValor, setSangriaValor] = useState("");
  const [sangriaMotivo, setSangriaMotivo] = useState("");
  const [modalSangria, setModalSangria] = useState(false);
  // De onde saiu o dinheiro. Só "dinheiro" reduz o que se espera contar na
  // gaveta: pagar o motoboy por PIX é saída do caixa, mas a gaveta não muda.
  const [sangriaForma, setSangriaForma] = useState("dinheiro");

  const handleSangria = async () => {
    if (!caixaAberto || !user || !sangriaValor || !sangriaMotivo) return;
    await createSangria.mutateAsync({
      caixa_id: caixaAberto.id,
      usuario_id: user.id,
      valor: parseFloat(sangriaValor),
      motivo: sangriaMotivo,
      forma_pagamento: sangriaForma,
    });
    toast.success(
      sangriaForma === "dinheiro"
        ? `Sangria de ${brl(parseFloat(sangriaValor))} — sai da gaveta.`
        : `Saída de ${brl(parseFloat(sangriaValor))} via ${sangriaForma.replace("_", " ")} — a gaveta não muda.`,
    );
    setSangriaValor("");
    setSangriaMotivo("");
    setSangriaForma("dinheiro");
    setModalSangria(false);
  };

  // Entrada Extra
  const [entradaValor, setEntradaValor] = useState("");
  const [entradaMotivo, setEntradaMotivo] = useState("");
  const [modalEntrada, setModalEntrada] = useState(false);

  // ---------------------------------------------------------------
  // Aplicar entrada / adiantamento (Ctrl+A)
  //
  // Sinal de pedido: o cliente paga parte agora e leva depois. O dinheiro
  // entra na gaveta neste momento e o pedido passa a dever menos — as duas
  // coisas numa RPC só, porque metade disso deixa o caixa sem fechar.
  // ---------------------------------------------------------------
  const [modalEntradaPedido, setModalEntradaPedido] = useState(false);
  const [pedidoEntrada, setPedidoEntrada] = useState<string>("");
  const [entradaPedidoValor, setEntradaPedidoValor] = useState("");
  const [entradaPedidoForma, setEntradaPedidoForma] = useState("dinheiro");
  const { data: saldosPedidos = [] } = useSaldosPedidos(lojaId ?? undefined);
  // só entra na lista o pedido que ainda deve
  const pedidosComSaldo = saldosPedidos.filter((p: any) => Number(p.saldo) > 0);
  const aplicarEntrada = useAplicarEntradaPedido();
  const pedidoSelecionado = pedidosComSaldo.find((p: any) => p.pedido_id === pedidoEntrada);

  const handleEntradaPedido = async () => {
    if (!caixaAberto || !pedidoSelecionado) return;
    const valor = Number(String(entradaPedidoValor).replace(",", "."));
    if (!isFinite(valor) || valor <= 0) {
      toast.error("Informe o valor da entrada.");
      return;
    }
    // O banco recusa de novo; aqui é só para o operador não digitar duas vezes.
    if (valor > Number(pedidoSelecionado.saldo) + 0.005) {
      toast.error(`A entrada não pode passar do saldo do pedido (${brl(Number(pedidoSelecionado.saldo))}).`);
      return;
    }
    try {
      const r = await aplicarEntrada.mutateAsync({
        pedidoId: pedidoSelecionado.pedido_id,
        caixaId: caixaAberto.id,
        forma: entradaPedidoForma,
        valor,
      });
      setModalEntradaPedido(false);
      setEntradaPedidoValor("");
      setPedidoEntrada("");
      const saldo = Number(r?.saldo ?? 0);
      toast.success(saldo > 0
        ? `Entrada de ${brl(valor)} recebida. Falta ${brl(saldo)} neste pedido.`
        : `Entrada de ${brl(valor)} recebida. Pedido quitado.`);
    } catch (e: any) {
      toast.error(`Não foi possível receber a entrada: ${e.message ?? e}`);
    }
  };

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

  // ---- atalhos de teclado (mesmas teclas do sistema anterior da loja) ----
  const ATALHOS: Atalho[] = [
    { tecla: "F1", rotulo: "Vendedor", acao: () => document.querySelector<HTMLElement>("[data-campo='vendedor'] input, [data-campo='vendedor'] button")?.click() },
    { tecla: "F2", rotulo: "Cliente", acao: () => setModalCliente(true) },
    { tecla: "F4", rotulo: "Código", acao: () => { campoCodigo.current?.focus(); campoCodigo.current?.select(); } },
    { tecla: "F5", rotulo: "Localizar", acao: () => setModalLocalizar(true) },
    { tecla: "F6", rotulo: "Desconto no item", acao: () => {
        const item = cart.find((i) => i.produto_id === itemSelecionado);
        if (item) abrirEdicaoItem(item);
        else toast.info("Escolha o item no cupom antes.");
      }, ativo: cart.length > 0 },
    { tecla: "F7", rotulo: "Alterar item", acao: () => {
        const item = cart.find((i) => i.produto_id === itemSelecionado);
        if (item) abrirEdicaoItem(item);
        else toast.info("Escolha o item no cupom antes.");
      }, ativo: cart.length > 0 },
    { tecla: "F9", rotulo: "Consultar preço", acao: () => setModalPrecos(true) },
    { tecla: "F8", rotulo: "Cancelar item", acao: () => { if (itemSelecionado) { remover(itemSelecionado); setItemSelecionado(null); } else toast.info("Escolha o item no cupom antes."); }, ativo: cart.length > 0 },
    { tecla: "F10", rotulo: "Add Pagamento", acao: () => {
        if (!cart.length) return;
        setModalConfirmarVenda(true);
        // F10 é "adicionar pagamento": já abre o painel de formas
        if (!pagamentos.length) {
          setPagamentos([{ forma, valor: total,
            ...(forma === "dinheiro" && valorRec > total
                ? { valor_recebido: valorRec, troco: valorRec - total } : {}) }]);
        }
      }, ativo: cart.length > 0 },
    { tecla: "F11", rotulo: "Cancelar venda", acao: () => { if (cart.length && confirm("Cancelar a venda e limpar o cupom?")) limparCarrinho(); }, ativo: cart.length > 0 },
    { tecla: "Ctrl+S", rotulo: "Sangria", acao: () => setModalSangria(true), ativo: !!caixaAberto },
    { tecla: "Ctrl+E", rotulo: "Entrada de valores", acao: () => setModalEntrada(true), ativo: !!caixaAberto },
    { tecla: "Ctrl+A", rotulo: "Aplicar entrada em pedido", acao: () => setModalEntradaPedido(true), ativo: !!caixaAberto },
    { tecla: "Ctrl+X", rotulo: "Fechar caixa", acao: () => setModalFechamento(true), ativo: !!caixaAberto },
    // F12 no sistema anterior sai da frente de caixa (leva para a seleção de
    // caixa, sem fechar o turno). O navegador reserva F12 para as ferramentas
    // de desenvolvedor e não deixa interceptar, então Ctrl+F12 faz o mesmo.
    { tecla: "F12", rotulo: "Sair da frente de caixa", acao: () => setSaiuDaFrente(true) },
    { tecla: "Ctrl+F12", rotulo: "Sair da frente de caixa", acao: () => setSaiuDaFrente(true) },
    { tecla: "Ctrl+H", rotulo: "Ver todos os atalhos", acao: () => setModalAtalhos(true) },
  ];
  useAtalhosPdv(ATALHOS);
  // a barra de baixo mostra só o que o operador usa a todo momento
  const ATALHOS_VISIVEIS = ATALHOS.filter((a) =>
    ["F4", "F5", "F7", "F8", "F9", "F10", "F11", "Ctrl+S", "Ctrl+X", "F12", "Ctrl+H"].includes(a.tecla));

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="PDV / Frente de Caixa" />;

  // =================== RENDER ===================
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6" />
          {caixaAberto && caixasAbertosMeus.length > 1 ? (
            /* Mais de um caixa aberto no mesmo nome: o crachá vira seletor.
               Sem ele, o admin que abrisse o segundo caixa perderia o
               primeiro de vista e venderia no caixa errado sem perceber. */
            <select
              className="h-8 rounded-md border border-green-600 bg-green-50 px-2 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-200"
              value={caixaAberto.id}
              onChange={(e) => setCaixaEscolhidoId(e.target.value)}
              title="Alternar entre os caixas que você tem abertos"
            >
              {(caixasAbertosMeus as any[]).map((c) => (
                <option key={c.id} value={c.id}>
                  Caixa #{c.numero_caixa} — {lojas.find((l: any) => l.id === c.loja_id)?.apelido ?? "loja"}
                </option>
              ))}
            </select>
          ) : caixaAberto ? (
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
          {caixaAberto && variosCaixas && !saiuDaFrente && (
            /* Abrir um segundo caixa sem fechar o primeiro. Só para quem pode
               manter vários; o banco recusa dos outros. */
            <Button variant="outline" size="sm" onClick={() => setSaiuDaFrente(true)}
              title="Abrir outro caixa sem fechar este">
              <Plus className="mr-1 h-4 w-4" /> Abrir outro caixa
            </Button>
          )}
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
      {!caixaAberto || saiuDaFrente ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Saiu da frente com o turno em aberto: o caminho de volta tem de
                estar à vista, senão o operador abre um segundo caixa por engano */}
            {caixaAberto && saiuDaFrente && (
              <Card className="border-green-600 bg-green-50 dark:bg-green-950/20">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">
                      Caixa #{caixaAberto.numero_caixa} continua aberto no seu nome.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sair da frente de caixa não encerra o turno — o movimento segue registrado.
                    </p>
                  </div>
                  <Button onClick={() => setSaiuDaFrente(false)}>
                    Voltar para a venda
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Card 1: os caixas DESTA loja.

                Antes a lista vinha de uma configuração global ("2 caixas") e
                o mesmo número existia em toda loja — o Caixa 1 de Petrolina e
                o de Juazeiro eram indistinguíveis no relatório. Agora cada
                caixa é um cadastro com nome e dono. */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Selecione o caixa</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setModalNovoPonto(true)}
                  title="Cadastrar um caixa nesta loja">
                  <Plus className="mr-1 h-4 w-4" /> Adicionar caixa
                </Button>
              </CardHeader>
              <CardContent>
                {pontosLivres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {pontosVendaDaLoja.length === 0
                      ? <>Esta loja ainda não tem caixa cadastrado. Use <b>Adicionar caixa</b>.</>
                      : pontosVenda.length === 0
                        ? "Esta conta não tem permissão para abrir nenhum caixa desta loja."
                        : "Todos os caixas desta loja já estão abertos."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pontosLivres.map((pv: any) => (
                      <Button
                        key={pv.id}
                        variant={pontoSelecionado === pv.id ? "default" : "outline"}
                        onClick={() => { setPontoSelecionado(pv.id); setCaixaSelecionado(pv.numero); }}
                      >
                        {pv.nome}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tipo de frente: o delivery é o Ciclo de pedidos, tela própria */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tipo de frente de caixa</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button variant="default" disabled>Convencional</Button>
                <Button variant="outline" onClick={() => navigate("/pedidos-delivery")}>
                  <Bike className="mr-1 h-4 w-4" /> Delivery
                </Button>
                <span className="text-xs text-muted-foreground">
                  Delivery abre o Ciclo de pedidos, onde o pedido anda pela esteira até a entrega.
                </span>
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
                    {/* A senha confirma QUEM está assumindo o caixa: o
                        relatório de fechamento mostra esse nome, e sem
                        confirmação bastaria uma sessão esquecida aberta. */}
                    {!senhaLembrada && (
                      <div className="mt-2">
                        <Label className="text-xs">Senha do usuário</Label>
                        <Input type="password" className="mt-1" value={senhaAbertura}
                          onChange={(e) => setSenhaAbertura(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void abrirCaixa(); }}
                          placeholder="confirme para assumir o caixa" />
                        <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" className="h-3.5 w-3.5" checked={lembrarSenha}
                            onChange={(e) => setLembrarSenha(e.target.checked)} />
                          Lembrar neste computador
                        </label>
                      </div>
                    )}
                    {senhaLembrada && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Senha lembrada neste computador.{" "}
                        <button type="button" className="underline hover:no-underline"
                          onClick={() => { localStorage.removeItem(CHAVE_SENHA_LEMBRADA); setSenhaLembrada(false); }}>
                          esquecer
                        </button>
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Saldo Inicial (Troco)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={saldoInicial}
                      onChange={(e) => { setSaldoInicial(e.target.value); setSaldoVeioDoFechamento(false); }}
                    />
                    {ultimoFechamento && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {saldoVeioDoFechamento ? "Puxado do" : "No"} fechamento de{" "}
                        {new Date(ultimoFechamento.data_fechamento).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}{" "}
                        ficaram <b>{brl(Number(ultimoFechamento.valor_final ?? 0))}</b> na gaveta.
                        {!saldoVeioDoFechamento && (
                          <button type="button" className="ml-1 underline hover:no-underline"
                            onClick={() => { setSaldoInicial(String(Number(ultimoFechamento.valor_final ?? 0))); setSaldoVeioDoFechamento(true); }}>
                            usar este valor
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  className="mt-4"
                  disabled={!caixaSelecionado || !pontoSelecionado}
                  onClick={() => void abrirCaixa()}
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
          {/* Painel Esquerdo: entrada por código e cupom.

              Não há catálogo em grade: balcão não escolhe produto na tela,
              lê o código de barras ou digita. O catálogo continua acessível
              em Localizar (F5), para quando o código não se lê. */}
          <div className="flex flex-1 flex-col overflow-hidden border-r">
            {/* Estado da conexão e da fila. Fica no topo do painel de venda
                porque é a informação que muda o que o operador deve prometer
                ao cliente — sem internet ainda não existe cupom fiscal. */}
            {(!online || fila.pendentes > 0 || fila.bloqueadas > 0) && (
              <div
                className={`flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm ${
                  online ? "bg-blue-50 dark:bg-blue-950/20" : "bg-amber-50 dark:bg-amber-950/20"
                }`}
              >
                {online ? <Cloud className="h-4 w-4 text-blue-600" /> : <CloudOff className="h-4 w-4 text-amber-600" />}
                <span className="font-medium">
                  {online ? "Conectado" : "Sem internet — as vendas continuam"}
                </span>
                {fila.pendentes > 0 && (
                  <span className="text-muted-foreground">
                    {fila.pendentes} venda(s) aguardando envio
                  </span>
                )}
                {fila.bloqueadas > 0 && (
                  <span className="text-red-600">
                    {fila.bloqueadas} venda(s) recusada(s) pelo servidor — verifique em Vendas
                  </span>
                )}
                {catalogo.usandoEspelho && catalogo.copiadoEm && (
                  <span className="text-muted-foreground">
                    catálogo de {new Date(catalogo.copiadoEm).toLocaleString("pt-BR")}
                  </span>
                )}
                {online && fila.pendentes > 0 && (
                  <Button size="sm" variant="outline" onClick={() => void fila.drenar()} disabled={fila.drenando}>
                    {fila.drenando
                      ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                    Enviar agora
                  </Button>
                )}
              </div>
            )}

            {catalogo.semCatalogo && (
              <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/20">
                Sem internet e sem catálogo salvo neste computador. Abra o PDV uma vez com
                conexão para que os produtos fiquem disponíveis offline.
              </div>
            )}


            {/* Linha de entrada: código → TAB → quantidade */}
            <div className="border-b bg-muted/20 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[16rem] flex-1">
                  <Label className="text-xs">Código <span className="text-muted-foreground">(F4)</span></Label>
                  <Input
                    ref={campoCodigo}
                    className="mt-1 font-mono text-lg"
                    placeholder="Bipe ou digite o código e pressione TAB"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); lancarPorCodigo(); }
                      if (e.key === "Tab" && codigo.trim()) {
                        // TAB confere o código e passa para a quantidade,
                        // como no sistema antigo da loja
                        const p = acharPorCodigo(codigo);
                        if (p) { e.preventDefault(); setProdutoNaLinha(p); campoQtd.current?.focus(); }
                      }
                    }}
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    ref={campoQtd}
                    type="number" min="0" step="any"
                    className="mt-1 text-lg"
                    value={qtdLinha}
                    onChange={(e) => setQtdLinha(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lancarPorCodigo(); } }}
                  />
                </div>
                <Button onClick={lancarPorCodigo} disabled={!codigo.trim() && !produtoNaLinha}>
                  <Plus className="mr-1 h-4 w-4" /> Lançar
                </Button>
                <Button variant="outline" onClick={() => setModalLocalizar(true)} title="Localizar produto (F5)">
                  <Search className="mr-1 h-4 w-4" /> Localizar <span className="ml-1 text-xs opacity-60">F5</span>
                </Button>
                <Button variant="outline" size="icon" title="Ler pela câmera"
                  onClick={() => setLeitorAberto(true)}>
                  <Camera className="h-4 w-4" />
                </Button>
              </div>

              {/* O que o operador precisa ver antes de lançar */}
              {produtoNaLinha ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="font-medium">{produtoNaLinha.nome}</span>
                  <span className="text-muted-foreground">R$ Unitário: <b className="text-foreground">{brl(produtoNaLinha.preco_venda)}</b></span>
                  <span className="text-muted-foreground">R$ Total: <b className="text-foreground">{brl(Number(produtoNaLinha.preco_venda) * (parseFloat(qtdLinha) || 1))}</b></span>
                  <span className="text-muted-foreground">
                    Qtd. Estoque:{" "}
                    <b className={(saldoDe(produtoNaLinha) ?? 1) <= 0 ? "text-red-600" : "text-foreground"}>
                      {saldoDe(produtoNaLinha) ?? "—"}
                    </b>
                  </span>
                  {/* só avisa quando o saldo é CONHECIDO e não dá: produto sem
                      posição de estoque na loja não é produto zerado */}
                  {saldoDe(produtoNaLinha) !== null && saldoDe(produtoNaLinha)! <= 0 && (
                    <span className="text-xs font-medium text-red-600">
                      Produto está com o estoque zerado ou negativo
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pressione TAB para conferir o produto e avançar para a quantidade, ou Enter para lançar 1.
                </p>
              )}
            </div>

            {/* Cupom: os itens lançados */}
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">Cód</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-center">Un</th>
                    <th className="p-2 text-right">Qtde</th>
                    <th className="p-2 text-right">Vlr. unit.</th>
                    <th className="p-2 text-right">Desc.</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">
                      Nenhum item lançado. Bipe o código de barras para começar.
                    </td></tr>
                  ) : cart.map((item, i) => (
                    <tr key={item.produto_id}
                      onClick={() => setItemSelecionado(item.produto_id)}
                      onDoubleClick={() => abrirEdicaoItem(item)}
                      title="Clique para selecionar · duplo clique para alterar (F7)"
                      className={`cursor-pointer border-b last:border-0 ${
                        itemSelecionado === item.produto_id ? "bg-primary/10" : "hover:bg-accent"}`}>
                      <td className="p-2 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-mono text-xs">{item.sku}</td>
                      <td className="p-2">{item.nome}</td>
                      <td className="p-2 text-center text-xs text-muted-foreground">UN</td>
                      <td className="p-2 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="icon" className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); atualizarQuantidade(item.produto_id, item.quantidade - 1); }}>
                            <span className="text-xs">-</span>
                          </Button>
                          <span className="w-8 text-center">{item.quantidade}</span>
                          <Button variant="outline" size="icon" className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); atualizarQuantidade(item.produto_id, item.quantidade + 1); }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 text-right tabular-nums">{brl(item.preco_unitario)}</td>
                      <td className="p-2 text-right tabular-nums text-muted-foreground">
                        {item.desconto ? "-" + brl(item.desconto) : "—"}
                      </td>
                      <td className="p-2 text-right font-semibold tabular-nums">
                        {brl(item.preco_unitario * item.quantidade - (Number(item.desconto) || 0))}
                      </td>
                      <td className="p-2 text-right">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={(e) => { e.stopPropagation(); remover(item.produto_id); }} title="Cancelar item (F8)">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Barra de atalhos, como no sistema antigo: o operador enxerga a
                tecla sem decorar */}
            <div className="flex flex-wrap items-center gap-1 border-t bg-muted/30 px-2 py-1.5 text-xs">
              {ATALHOS_VISIVEIS.map((a) => (
                <button key={a.tecla} type="button" onClick={a.acao} disabled={a.ativo === false}
                  className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">
                  <span className="font-mono font-semibold">{a.tecla}</span>
                  <span className="ml-1 text-muted-foreground">{a.rotulo}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Painel Direito: quem vende, para quem, e o total */}
          <div className="flex w-[420px] flex-col overflow-hidden bg-muted/30">
            <div className="grid grid-cols-1 gap-2 border-b p-3">
              <div data-campo="vendedor">
                <Label className="text-xs">Vendedor <span className="text-muted-foreground">(F1)</span></Label>
                <ComboboxBusca
                  className="mt-1"
                  itens={funcionarios.map((f: any) => ({
                    id: f.id, rotulo: f.nome ?? f.cargo ?? "—", detalhe: f.cargo ?? undefined,
                  }))}
                  value={vendedorId}
                  onChange={setVendedorId}
                  vazio="Sem vendedor"
                />
              </div>
              <div>
                <Label className="text-xs">Cliente <span className="text-muted-foreground">(F2)</span></Label>
                <div className="mt-1 flex gap-1">
                  <ComboboxBusca
                    className="flex-1"
                    itens={clientes.map((c: any) => ({
                      id: c.id, rotulo: c.nome_razao,
                      detalhe: [c.cpf_cnpj, c.celular ?? c.telefone].filter(Boolean).join(" · "),
                    }))}
                    value={clienteId}
                    onChange={setClienteId}
                    vazio="Cliente balcão"
                  />
                  <Button variant="outline" size="sm" className="h-9 shrink-0 px-2"
                    onClick={() => setModalCliente(true)} title="Novo cliente pelo celular (busca no ERP e no CRM)">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                <ClienteRapidoPdvDialog
                  open={modalCliente} onOpenChange={setModalCliente} online={online}
                  onCliente={(id) => setClienteId(id)}
                />
              </div>
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

      {/* Alterar item (F7) — quantidade, preço e desconto da linha */}
      <Dialog open={!!itemEditando} onOpenChange={(o) => !o && setItemEditando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar item</DialogTitle>
            <DialogClose />
          </DialogHeader>
          {itemEditando && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 p-2 text-sm">
                <p className="font-medium">{itemEditando.nome}</p>
                <p className="text-xs text-muted-foreground">{itemEditando.sku}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" step="any" autoFocus className="mt-1"
                    value={edQtd} onChange={(e) => setEdQtd(e.target.value)} />
                </div>
                <div>
                  <Label>Valor unitário</Label>
                  <InputMoeda value={edPreco} onChange={(v) => setEdPreco(String(v))} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Desconto no item <span className="text-muted-foreground">(F6)</span></Label>
                  <div className="flex gap-1">
                    <Button size="sm" variant={!edDescontoPct ? "default" : "outline"}
                      className="h-6 px-2 text-xs" onClick={() => setEdDescontoPct(false)}>R$</Button>
                    <Button size="sm" variant={edDescontoPct ? "default" : "outline"}
                      className="h-6 px-2 text-xs" onClick={() => setEdDescontoPct(true)}>%</Button>
                  </div>
                </div>
                <Input type="number" min="0" step="any" className="mt-1"
                  value={edDesconto} onChange={(e) => setEdDesconto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") aplicarEdicaoItem(); }} />
              </div>
              <div className="flex justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">Total da linha</span>
                <span className="font-semibold tabular-nums">
                  {brl(Math.max(0,
                    (parseFloat(edQtd) || 0) * (parseFloat(edPreco) || 0)
                    - (edDescontoPct
                        ? ((parseFloat(edQtd) || 0) * (parseFloat(edPreco) || 0) * (parseFloat(edDesconto) || 0)) / 100
                        : (parseFloat(edDesconto) || 0))))}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemEditando(null)}>Cancelar</Button>
            <Button onClick={aplicarEdicaoItem}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultar preço (F9) — sem sair da venda, sem lançar nada */}
      <Dialog open={modalPrecos} onOpenChange={setModalPrecos}>
        <DialogContent className="max-w-2xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Consultar preço</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="min-h-0 min-w-0 space-y-2 overflow-y-auto">
            <Input autoFocus placeholder="Nome, SKU ou código de barras…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Código</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right">Estoque</th>
                  <th className="p-2 text-right">Preço</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 80).map((prod: any) => (
                  <tr key={prod.id} className="border-b last:border-0">
                    <td className="p-2 font-mono text-xs">{prod.sku}</td>
                    <td className="p-2">{prod.nome}</td>
                    <td className={`p-2 text-right tabular-nums ${(saldoDe(prod) ?? 1) <= 0 ? "text-red-600" : ""}`}>
                      {saldoDe(prod) ?? "—"}
                    </td>
                    <td className="p-2 text-right font-semibold tabular-nums">{brl(prod.preco_venda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPrecos(false)}>Fechar (ESC)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Localizar produto (F5) — o catálogo continua aqui, para quando o
          código de barras não se lê ou o operador não sabe o código */}
      <Dialog open={modalLocalizar} onOpenChange={setModalLocalizar}>
        <DialogContent className="max-w-3xl max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Localizar produto</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 min-w-0 space-y-2 overflow-y-auto">
            <Input autoFocus placeholder="Nome, SKU ou código de barras…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Código</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-right">Estoque</th>
                  <th className="p-2 text-right">Preço</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 60).map((prod: any) => (
                  <tr key={prod.id} className="border-b last:border-0 hover:bg-accent">
                    <td className="p-2 font-mono text-xs">{prod.sku}</td>
                    <td className="p-2">{prod.nome}</td>
                    <td className={`p-2 text-right tabular-nums ${(saldoDe(prod) ?? 1) <= 0 ? "text-red-600" : ""}`}>
                      {saldoDe(prod) ?? "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">{brl(prod.preco_venda)}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" onClick={() => {
                        setProdutoNaLinha(prod); setCodigo(prod.sku ?? ""); setModalLocalizar(false);
                        setTimeout(() => campoQtd.current?.focus(), 50);
                      }}>Escolher</Button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLocalizar(false)}>Fechar (ESC)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar caixa a esta loja */}
      <Dialog open={modalNovoPonto} onOpenChange={setModalNovoPonto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              O caixa pertence a esta loja e recebe o próximo número livre — é esse número
              que sai no cupom e separa os turnos no relatório.
            </p>
            <div>
              <Label>Nome do caixa</Label>
              <Input autoFocus value={nomeNovoPonto} onChange={(e) => setNomeNovoPonto(e.target.value)}
                placeholder="Ex.: Caixa do balcão, Caixa 2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovoPonto(false)}>Cancelar</Button>
            <Button disabled={criarPonto.isPending || !lojaId}
              onClick={async () => {
                if (!lojaId) return;
                try {
                  const novo = await criarPonto.mutateAsync({ lojaId, nome: nomeNovoPonto });
                  setPontoSelecionado(novo.id); setCaixaSelecionado(novo.numero);
                  setNomeNovoPonto(""); setModalNovoPonto(false);
                  toast.success(`${novo.nome} criado.`);
                } catch (e: any) {
                  toast.error(`Não foi possível criar: ${e.message ?? e}`);
                }
              }}>
              {criarPonto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Criar caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Atalhos (F12) */}
      <Dialog open={modalAtalhos} onOpenChange={setModalAtalhos}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Keyboard className="h-5 w-5" /> Atalhos do teclado</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {ATALHOS.map((a) => (
              <div key={a.tecla} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent">
                <span>{a.rotulo}</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">{a.tecla}</kbd>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAtalhos(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <LeitorCodigoBarras
        aberto={leitorAberto}
        aoFechar={() => setLeitorAberto(false)}
        aoLer={aoLerCodigo}
        titulo="Bipar produtos"
      />

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
            {/* Pagamentos (F10): uma ou várias formas. Enquanto não houver
                linha lançada, vale o seletor simples da tela de venda. */}
            <div className="mt-2 rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">
                  Pagamento <span className="font-normal text-muted-foreground">(F10)</span>
                </p>
                {!temPagamentosDetalhados && (
                  <Button variant="outline" size="sm"
                    onClick={() => setPagamentos([{ forma, valor: total,
                      ...(forma === "dinheiro" && valorRec > total
                          ? { valor_recebido: valorRec, troco: valorRec - total } : {}) }])}>
                    Dividir em mais de uma forma
                  </Button>
                )}
              </div>

              {temPagamentosDetalhados ? (
                <PagamentosVenda total={total} pagamentos={pagamentos} aoMudar={setPagamentos} />
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Forma:</span>
                    <span className="capitalize">{String(forma).replace("_", " ")}</span>
                  </div>
                  {forma === "dinheiro" && (
                    <>
                      <div className="flex justify-between">
                        <span>Recebido:</span>
                        <span>{brl(valorRec)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-orange-600">
                        <span>Troco:</span>
                        <span>{brl(troco)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {!clienteId && (
              <div className="mt-2 space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">CPF na nota? <span className="font-normal text-muted-foreground">(opcional)</span></p>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpfNota}
                  onChange={(e) => setCpfNota(mascaraDocumento(e.target.value))}
                  className={cpfNota.trim() && !documentoValido(cpfNota) ? "border-red-500" : ""}
                />
                {cpfNota.trim() && !documentoValido(cpfNota) && (
                  <p className="text-xs text-red-600">CPF/CNPJ inválido — confira os dígitos.</p>
                )}
                {cpfNota.trim() && documentoValido(cpfNota) && (
                  <Input
                    placeholder="Nome do cliente (opcional)"
                    value={nomeNota}
                    onChange={(e) => setNomeNota(e.target.value)}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  O cupom sai no CPF informado, sem precisar cadastrar o cliente.
                </p>
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={emitirCupom}
                onChange={(e) => setEmitirCupom(e.target.checked)}
              />
              <span>
                <span className="font-medium">Emitir NFC-e (cupom fiscal)</span>
                <span className="block text-xs text-muted-foreground">
                  Transmite o cupom à SEFAZ logo após a venda. Exige CSC cadastrado em
                  Configurações SEFAZ; se falhar, a venda continua registrada e o cupom pode ser
                  emitido depois em Notas Fiscais.
                </span>
              </span>
            </label>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Forma:</span>
              <span className="capitalize">{forma.replace("_", " ")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfirmarVenda(false)}>
              Voltar
            </Button>
            <Button onClick={handleFinalizarVenda}
              disabled={finalizando || faltaReceber > 0}
              title={faltaReceber > 0 ? `Ainda falta receber ${brl(faltaReceber)}` : undefined}
              className="bg-green-600 hover:bg-green-700">
              {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {faltaReceber > 0 ? `Falta ${brl(faltaReceber)}` : "Confirmar Venda"}
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
            {/* Só o que é dinheiro vivo entra na conta da gaveta. O resto
                aparece embaixo, para conferir maquininha e extrato do PIX.

                Com "ocultar valores" ligado, todo este bloco some para quem
                não é master: mostrar vendas em dinheiro e sangrias entregaria
                o esperado somado de cabeça. */}
            {podeVerEsperado && (
              <>
                <div className="flex justify-between font-semibold">
                  <span>Vendas em dinheiro:</span>
                  <span className="text-green-600">+{brl(Number(c?.vendas_dinheiro || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sangrias em dinheiro:</span>
                  <span className="text-red-600">-{brl(Number(c?.sangrias_dinheiro || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entradas em dinheiro:</span>
                  <span className="text-green-600">+{brl(Number(c?.entradas_dinheiro || 0))}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Valor Esperado em Gaveta:</span>
                  <span className="text-primary">{brl(valorEsperadoCaixa)}</span>
                </div>
              </>
            )}

            {!podeVerEsperado && (
              <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                Conferência às cegas: conte a gaveta e informe o valor encontrado.
                O comprovante com a diferença sai na impressora ao fechar.
              </p>
            )}

            {exigirValoresPorForma ? (
              <div className="border-t pt-3 space-y-2">
                <Label>Valores conferidos por forma de pagamento</Label>
                {formasParaDeclarar.map((f) => (
                  <div key={f.chave} className="grid grid-cols-2 items-center gap-2">
                    <span className="text-sm">{f.rotulo}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="R$ 0,00"
                      value={declarados[f.chave] ?? ""}
                      onChange={(e) => setDeclarados((d) => ({ ...d, [f.chave]: e.target.value }))}
                    />
                    {podeVerEsperado && (
                      <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                        Sistema registrou {brl(Number((c as any)?.[f.campo] || 0))}
                      </p>
                    )}
                  </div>
                ))}
                {podeVerEsperado && declarados.dinheiro != null && declarados.dinheiro !== ""
                  && !isNaN(parseFloat(declarados.dinheiro)) && (
                  <p className={`text-xs ${parseFloat(declarados.dinheiro) - valorEsperadoCaixa === 0 ? "text-green-600" : "text-orange-600"}`}>
                    Diferença na gaveta: {brl(parseFloat(declarados.dinheiro) - valorEsperadoCaixa)}
                  </p>
                )}
              </div>
            ) : (
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
                {podeVerEsperado && valorContado !== "" && !isNaN(parseFloat(valorContado)) && (
                  <p className={`text-xs mt-1 ${parseFloat(valorContado) - valorEsperadoCaixa === 0 ? "text-green-600" : "text-orange-600"}`}>
                    Diferença: {brl(parseFloat(valorContado) - valorEsperadoCaixa)}
                  </p>
                )}
              </div>
            )}

            {/* Não passou pela gaveta: confira contra a maquininha e o extrato */}
            {podeVerEsperado && !exigirValoresPorForma
              && (Number(c?.vendas_pix || 0) + Number(c?.vendas_cartao_credito || 0)
              + Number(c?.vendas_cartao_debito || 0) + Number(c?.vendas_outras || 0)) > 0 && (
              <div className="rounded-md border p-2 text-xs">
                <p className="mb-1 font-medium">Fora da gaveta — conferir no extrato</p>
                {[
                  ["PIX", Number(c?.vendas_pix || 0)],
                  ["Cartão crédito", Number(c?.vendas_cartao_credito || 0)],
                  ["Cartão débito", Number(c?.vendas_cartao_debito || 0)],
                  ["Outras formas", Number(c?.vendas_outras || 0)],
                ].filter(([, v]) => Number(v) > 0).map(([rotulo, v]) => (
                  <div key={String(rotulo)} className="flex justify-between text-muted-foreground">
                    <span>{rotulo}</span><span className="tabular-nums">{brl(Number(v))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalFechamento(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleFecharCaixa}
              disabled={fecharCaixa.isPending
                || (exigirValoresPorForma ? faltaDeclarar : valorContado === "")}
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
            <DialogTitle>Registrar saída de caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor</Label>
                <InputMoeda value={sangriaValor} onChange={(v) => setSangriaValor(String(v))} />
              </div>
              <div>
                <Label>Saiu de</Label>
                <Select value={sangriaForma} onValueChange={setSangriaForma}>
                  <SelectTrigger className="mt-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro da gaveta</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={sangriaMotivo} onChange={(e) => setSangriaMotivo(e.target.value)}
                placeholder="Ex.: pagamento do motoboy, repasse ao gerente" />
            </div>
            <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              {sangriaForma === "dinheiro"
                ? "Sai da gaveta: o fechamento vai esperar este valor a menos em dinheiro."
                : "Não sai da gaveta: fica registrado como saída do caixa, mas o dinheiro contado no fechamento não muda."}
            </p>
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
              <InputMoeda value={entradaValor} onChange={(v) => setEntradaValor(String(v))} />
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

      {/* Modal: Aplicar entrada / adiantamento em pedido (Ctrl+A) */}
      <Dialog open={modalEntradaPedido} onOpenChange={setModalEntradaPedido}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar entrada em pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pedidosComSaldo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido em aberto com saldo a receber nesta loja.
              </p>
            ) : (
              <>
                <div>
                  <Label>Pedido</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={pedidoEntrada}
                    onChange={(e) => setPedidoEntrada(e.target.value)}
                  >
                    <option value="">Selecione o pedido...</option>
                    {pedidosComSaldo.map((p: any) => (
                      <option key={p.pedido_id} value={p.pedido_id}>
                        #{String(p.pedido_id).replace(/-/g, "").slice(0, 8)} — saldo {brl(Number(p.saldo))}
                      </option>
                    ))}
                  </select>
                </div>

                {pedidoSelecionado && (
                  <div className="rounded-md border p-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total do pedido</span>
                      <span className="tabular-nums">{brl(Number(pedidoSelecionado.total_pedido))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Já recebido</span>
                      <span className="tabular-nums">{brl(Number(pedidoSelecionado.total_pago))}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Saldo</span>
                      <span className="tabular-nums">{brl(Number(pedidoSelecionado.saldo))}</span>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Valor da entrada</Label>
                  <InputMoeda
                    value={entradaPedidoValor}
                    onChange={(v) => setEntradaPedidoValor(String(v))}
                  />
                  {pedidoSelecionado && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => setEntradaPedidoValor(String(Number(pedidoSelecionado.saldo)))}
                    >
                      Receber o saldo todo ({brl(Number(pedidoSelecionado.saldo))})
                    </Button>
                  )}
                </div>

                <div>
                  <Label>Como o cliente está pagando</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={entradaPedidoForma}
                    onChange={(e) => setEntradaPedidoForma(e.target.value)}
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão Crédito</option>
                    <option value="cartao_debito">Cartão Débito</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Só o dinheiro entra na conta da gaveta. Na venda final, lance o que
                    já foi pago como "Entrada/adiantamento já pago" para o faturamento
                    sair pelo valor cheio.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEntradaPedido(false)}>Cancelar</Button>
            <Button
              onClick={handleEntradaPedido}
              disabled={!pedidoSelecionado || !entradaPedidoValor || aplicarEntrada.isPending}
            >
              {aplicarEntrada.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Receber entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Caixas desta loja.

          Era "Quantidade de Caixas": um número global que criava os mesmos
          caixas em toda loja. Com o cadastro por loja (erp_pontos_venda) o
          número perdeu sentido — aqui se vê e se cria o que existe. */}
      <Dialog open={modalConfigCaixa} onOpenChange={setModalConfigCaixa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Caixas desta loja</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {pontosVenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum caixa cadastrado nesta loja.</p>
            ) : pontosVenda.map((pv: any) => (
              <div key={pv.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{pv.nome}</span>
                <span className="text-xs text-muted-foreground">nº {pv.numero}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              O número acompanha o cupom e separa os turnos no relatório de fechamento.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfigCaixa(false)}>Fechar</Button>
            <Button onClick={() => { setModalConfigCaixa(false); setModalNovoPonto(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar caixa
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
