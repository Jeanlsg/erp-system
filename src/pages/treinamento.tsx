// ============================================================
// Página: Treinamento
//
// O guia de operação vive DENTRO do sistema, com capturas reais de cada
// tela — o que a pessoa vê no guia é o que encontra ao clicar. Organizado
// por papel, abrindo já no papel do usuário logado; cada tarefa tem o
// passo a passo e o link direto para a tela onde ela acontece.
//
// As imagens são estáticos em /treinamento/*.jpeg (public/), capturadas do
// sistema em produção. Ao mudar uma tela de forma relevante, recapturar.
// ============================================================

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, Monitor, Package, Wallet, Shield, Users, ArrowRight, AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store/auth-store";

interface Tarefa {
  titulo: string;
  imagem: string;          // arquivo em /treinamento/
  rota?: string;           // link "abrir a tela"
  passos: string[];        // aceita <b> simples via renderização manual
  nota?: string;
}

interface Papel {
  id: string;
  nome: string;
  sub: string;
  Icone: typeof Monitor;
  tarefas: Tarefa[];
}

// Negrito controlado: só <b> vindo DESTE arquivo — nada de usuário.
function Passo({ texto }: { texto: string }) {
  const partes = texto.split(/<b>|<\/b>/);
  return (
    <>{partes.map((p, i) => (i % 2 === 1 ? <b key={i} className="text-foreground">{p}</b> : p))}</>
  );
}

const PAPEIS: Papel[] = [
  {
    id: "caixa", nome: "Caixa", Icone: Monitor,
    sub: "Quem opera a frente de loja: vender, receber e fechar o dia.",
    tarefas: [
      {
        titulo: "Abrir o caixa e vender", imagem: "pdv-carrinho.jpeg", rota: "/pdv",
        passos: [
          "Entre em <b>PDV</b>. Se o caixa estiver fechado, escolha o número, informe o troco inicial e clique em <b>Abrir Caixa</b>.",
          "Busque o produto por nome, SKU ou código de barras — ou clique no cartão. Ele entra no <b>Carrinho</b> à direita.",
          "Kits aparecem junto dos produtos (SKU “KIT”): vender um kit baixa automaticamente cada componente do estoque.",
          "Ajuste quantidade com − / +, aplique desconto em R$ ou %, escolha a <b>forma de pagamento</b> e informe o valor recebido — o troco sai sozinho.",
          "Toque em <b>Finalizar</b>. Com “emitir cupom” marcado, a NFC-e sai junto e vai ao e-mail do cliente automaticamente.",
        ],
        nota: "A venda grava estoque, kardex e conta a receber de uma vez — não existe passo manual depois do Finalizar.",
      },
      {
        titulo: "Bipar com a câmera", imagem: "pdv.jpeg", rota: "/pdv",
        passos: [
          "Clique no botão de <b>câmera</b> ao lado da busca.",
          "Aponte para o código de barras: cada bipe adiciona o produto ao carrinho, em sequência.",
          "Funciona no Chrome/Edge (inclusive celular e tablet). O leitor USB continua funcionando direto no campo de busca.",
        ],
      },
      {
        titulo: "Vender sem internet", imagem: "pdv.jpeg", rota: "/pdv",
        passos: [
          "Se a internet cair, aparece o aviso amarelo <b>“Sem internet — as vendas continuam”</b>. Continue vendendo normalmente.",
          "Cada venda fica guardada no computador (criptografada) e o contador mostra quantas aguardam envio.",
          "Quando a conexão voltar, tudo sobe sozinho, sem duplicar. Só então o cupom fiscal é emitido.",
          "Pode até recarregar a página sem internet — o aplicativo abre do mesmo jeito.",
        ],
        nota: "Abrir caixa, sangria e fechamento ainda precisam de internet — só a venda funciona offline.",
      },
      {
        titulo: "Sangria, entrada extra e fechamento", imagem: "pdv.jpeg", rota: "/pdv",
        passos: [
          "Use os botões do topo: <b>Sangria</b> retira dinheiro da gaveta (com motivo), <b>Entrada Extra</b> adiciona.",
          "No fim do dia, <b>Fechar Caixa</b>: conte a gaveta e informe o valor contado — o sistema compara com o esperado e registra a diferença.",
        ],
      },
      {
        titulo: "Pedidos de entrega (quadro)", imagem: "pedidos-kanban.jpeg", rota: "/pedidos-delivery",
        passos: [
          "Cada coluna é uma etapa: Pagamento → Separação → Despacho → Entregue.",
          "Arraste o cartão para a próxima coluna — ou use o botão do próprio cartão.",
          "Cartão com o tempo em <b>vermelho</b> está parado além do normal: é o pedido que precisa de atenção agora.",
          "O ícone de telefone abre o WhatsApp do cliente; o X cancela o pedido.",
        ],
      },
    ],
  },
  {
    id: "estoquista", nome: "Estoquista", Icone: Package,
    sub: "Quem cuida de produto, entrada de mercadoria e contagem.",
    tarefas: [
      {
        titulo: "Cadastrar e manter produtos", imagem: "produtos.jpeg", rota: "/produtos-estoque-lotes",
        passos: [
          "Em <b>Cadastro e Estoque</b>, o botão <b>Cadastrar Produto</b> abre o formulário completo: preço, NCM, código de barras, estoque mínimo e a <b>duração típica</b> (quantos dias o produto dura — alimenta o aviso de recompra do CRM).",
          "As ações rápidas do topo: <b>Reajuste de Preços</b> aplica um percentual em massa no filtro atual; <b>Gerar Etiquetas</b> imprime etiquetas com código de barras; <b>Produtos Excluídos</b> lista os desativados para reativar.",
        ],
        nota: "Produto desativado some de todas as telas e do PDV — a lista de excluídos é a única porta de volta.",
      },
      {
        titulo: "Entrada por XML do fornecedor", imagem: "importar-nfe.jpeg", rota: "/compras/importar-nfe",
        passos: [
          "Em <b>Importar NF-e</b>, arraste o arquivo XML da nota.",
          "O sistema casa cada item com o cadastro por código de barras/SKU e sugere margem — revise item a item.",
          "Confirmar cria a compra, atualiza estoque e custo médio, e gera as contas a pagar com os vencimentos reais das duplicatas.",
        ],
      },
      {
        titulo: "Notas direto da SEFAZ", imagem: "notas-recebidas.jpeg", rota: "/fiscal/notas-recebidas",
        passos: [
          "<b>Buscar novas notas</b> traz toda NF-e emitida contra o CNPJ da loja — sem esperar o fornecedor mandar arquivo.",
          "Nota “só resumo” ainda não tem os itens: clique em <b>Dar ciência</b> para a SEFAZ liberar o XML completo.",
          "Com o XML completo, <b>Conferir</b> abre o mesmo importador da entrada por arquivo.",
          "A SEFAZ limita a 1 consulta por hora sem novidade — o sistema avisa e respeita a espera sozinho.",
        ],
        nota: "Este canal só funciona com a loja em ambiente de produção.",
      },
      {
        titulo: "Inventário (contagem)", imagem: "inventario.jpeg", rota: "/estoque/inventario",
        passos: [
          "<b>Abrir inventário</b> fotografa o saldo atual de todos os produtos da loja.",
          "Conte a prateleira e digite a quantidade — ou use <b>Contar pela câmera</b>: cada bipe soma +1 no produto.",
          "<b>Aplicar ajustes</b> gera um movimento rastreável no kardex para cada divergência — nada é sobrescrito em silêncio.",
          "Saldos negativos (deixados por vendas offline) aparecem no aviso do topo: são exatamente o que precisa de contagem.",
        ],
      },
      {
        titulo: "Kardex: auditar um saldo", imagem: "kardex.jpeg", rota: "/estoque/movimentacoes",
        passos: [
          "Todo movimento aparece com saldo anterior → posterior e o custo do momento.",
          "Se um saldo parece errado, filtre pelo produto: a resposta está na sequência de movimentos, incluindo de qual lote saiu cada venda (FEFO).",
        ],
      },
    ],
  },
  {
    id: "gerente", nome: "Gerente", Icone: Wallet,
    sub: "Quem acompanha venda, financeiro, fiscal e resultado.",
    tarefas: [
      {
        titulo: "Vendas e devoluções", imagem: "vendas.jpeg", rota: "/vendas",
        passos: [
          "Filtre por loja, período e forma de pagamento.",
          "Cancelar uma venda estorna o estoque e ajusta o financeiro; com nota emitida, a devolução gera a NF-e de devolução referenciando a original.",
        ],
      },
      {
        titulo: "Financeiro que se lança sozinho", imagem: "financeiro.jpeg", rota: "/financeiro",
        passos: [
          "Toda venda finalizada gera a conta a receber (à vista já nasce paga); toda compra gera as contas a pagar pelas duplicatas.",
          "Baixar uma conta registra data, valor e forma. Todo dia às 5h o vencido é marcado automaticamente.",
        ],
      },
      {
        titulo: "Crediário próprio", imagem: "crediario.jpeg", rota: "/crediario-proprio",
        passos: [
          "<b>Novo contrato</b>: escolha a venda, parcelas e juros (Price ou simples) — a prévia mostra a parcela e o custo do crédito antes de confirmar.",
          "O limite de crédito do cliente é conferido na hora; cliente estourado é recusado com o número exato.",
          "Cada parcela é também uma conta a receber: <b>baixar aqui baixa no financeiro junto</b>.",
          "A aba Clientes mostra quem deve, quanto está em atraso e o limite disponível.",
        ],
      },
      {
        titulo: "Cartão fidelidade", imagem: "fidelidade.jpeg", rota: "/cartao-fidelidade",
        passos: [
          "<b>Emitir cartão</b> uma vez por cliente. Daí em diante os pontos entram sozinhos a cada venda — não há passo manual.",
          "<b>Resgatar</b> converte pontos em desconto; o extrato registra cada movimento.",
          "O nível (bronze/prata/ouro) sai do acumulado histórico: resgatar não rebaixa o cliente.",
        ],
      },
      {
        titulo: "Notas fiscais", imagem: "notas-fiscais.jpeg", rota: "/notas-fiscais",
        passos: [
          "Emita NFC-e (cupom) direto do PDV ou por aqui; NF-e modelo 55 pelo Faturamento para cliente com CPF/CNPJ e endereço.",
          "Cada linha tem: detalhes, baixar XML, ver DANFE (gera na hora se a nota não tiver o PDF) e <b>enviar por e-mail</b> ao cliente com XML + DANFE anexos.",
          "Nos detalhes: cancelamento (justificativa de 15+ caracteres), carta de correção e devolução. Inutilização de numeração fica no botão do topo.",
        ],
        nota: "Em homologação, toda nota sai marcada SEM VALOR FISCAL — inclusive no e-mail.",
      },
      {
        titulo: "Análise gerencial", imagem: "analise.jpeg", rota: "/relatorios/analise",
        passos: [
          "<b>Curva ABC</b>: quais produtos sustentam a receita — classe A concentra ~80%.",
          "<b>Sugestão de compra</b>: o que repor antes de faltar, pelo giro real e prazo do fornecedor.",
          "<b>Estoque parado</b>: capital imobilizado sem venda há 90 dias.",
          "<b>DRE</b>: receita e despesa por competência, sobre o plano de contas.",
        ],
        nota: "Tudo aqui sai de venda realizada e custo médio real — não de preço de tabela.",
      },
    ],
  },
  {
    id: "admin", nome: "Administrador", Icone: Shield,
    sub: "Quem configura o sistema, os acessos e o fiscal.",
    tarefas: [
      {
        titulo: "Usuários e permissões", imagem: "usuarios.jpeg", rota: "/gestao/usuarios",
        passos: [
          "<b>Novo usuário</b>: e-mail, nome e papel (admin, gerente, caixa, estoquista). Sem senha, o convite chega por e-mail com link para o próprio usuário definir a dele.",
          "As permissões finas por módulo controlam o que aparece no menu de cada um.",
          "Bloquear um usuário corta o acesso na hora, sem apagar o histórico.",
        ],
      },
      {
        titulo: "Lojas e o cadastro da SEFAZ", imagem: "lojas.jpeg", rota: "/lojas",
        passos: [
          "O botão de <b>conferir na SEFAZ</b> (ícone de selo) valida IE e endereço da loja contra o cadastro oficial e mostra as divergências antes de aplicar.",
          "Este endereço é o do EMITENTE: sai impresso em toda nota fiscal — mantê-lo igual ao da SEFAZ evita rejeição.",
        ],
      },
      {
        titulo: "Configurações SEFAZ", imagem: "config-sefaz.jpeg", rota: "/gestao/configuracoes-sefaz",
        passos: [
          "Por loja: ambiente (homologação/produção), séries e numeração de NF-e/NFC-e.",
          "O <b>CSC</b> (código do portal da SEFAZ) entra aqui — obrigatório para NFC-e em produção; homologação já emite sem.",
        ],
        nota: "Homologação é para testar: as notas não têm valor fiscal. Só mude para produção com o ciclo testado.",
      },
      {
        titulo: "Certificado digital", imagem: "certificado.jpeg", rota: "/gestao/nfe-certificado",
        passos: [
          "Envie o arquivo A1 (.pfx) com a senha — o sistema <b>testa na SEFAZ antes de gravar</b>: certificado errado não entra.",
          "Acompanhe a validade por aqui: certificado vencido para a emissão inteira.",
        ],
      },
      {
        titulo: "Escrituração (SPED)", imagem: "escrituracao.jpeg", rota: "/fiscal/escrituracao",
        passos: [
          "Escolha loja e competência e clique <b>Gerar</b>: sai a EFD ICMS/IPI (ou o SINTEGRA) montada das notas, do kardex e do inventário.",
          "Leia os <b>avisos</b> — eles listam o que faltou preencher com dado real (contabilista, NCM, regime…).",
          "Baixe o arquivo e valide no <b>PVA da Receita</b> antes de transmitir. O arquivo daqui é rascunho até passar por lá.",
        ],
      },
    ],
  },
  {
    id: "geral", nome: "Para todos", Icone: Users,
    sub: "Vale para qualquer papel.",
    tarefas: [
      {
        titulo: "O botão “?” explica cada tela", imagem: "ajuda.jpeg",
        passos: [
          "Em qualquer página, o <b>?</b> no topo diz o que a tela faz, de onde vêm os números e o que depende de configuração externa.",
          "É a primeira parada quando bater dúvida — antes de perguntar, clique no interrogação.",
        ],
      },
      {
        titulo: "O painel do dia", imagem: "dashboard.jpeg", rota: "/",
        passos: [
          "O Dashboard resume vendas, caixa e alertas da loja selecionada no topo.",
          "Trocar a loja no seletor do topo troca os dados de todas as telas.",
        ],
      },
    ],
  },
];

export function TreinamentoPage() {
  const { user } = useAuth();
  // Abre já no papel de quem está logado — o caixa não precisa procurar a aba dele.
  const papelInicial = PAPEIS.some((p) => p.id === user?.role) ? (user!.role as string) : "caixa";
  const [ativo, setAtivo] = useState(papelInicial);
  const papel = PAPEIS.find((p) => p.id === ativo) ?? PAPEIS[0];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="h-6 w-6" /> Treinamento
        </h1>
        <p className="text-muted-foreground">
          Como operar cada parte do sistema, por papel. Toda imagem é uma captura real —
          o que você vê aqui é o que encontra na tela.
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur">
        {PAPEIS.map((p) => (
          <Button key={p.id} size="sm" variant={ativo === p.id ? "default" : "outline"}
            onClick={() => setAtivo(p.id)}>
            <p.Icone className="mr-1.5 h-4 w-4" /> {p.nome}
          </Button>
        ))}
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">{papel.sub}</p>

      <div className="space-y-10">
        {papel.tarefas.map((t) => (
          <section key={t.titulo} className="border-t pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t.titulo}</h2>
              {t.rota && (
                <Button asChild size="sm" variant="outline">
                  <Link to={t.rota}>Abrir a tela <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </div>
            <ol className="mt-3 max-w-3xl list-decimal space-y-1.5 pl-6 text-sm text-muted-foreground marker:font-semibold marker:text-primary">
              {t.passos.map((p, i) => <li key={i}><Passo texto={p} /></li>)}
            </ol>
            {t.nota && (
              <p className="mt-3 flex max-w-3xl items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{t.nota}</span>
              </p>
            )}
            <img
              src={`/treinamento/${t.imagem}`}
              alt={`Tela: ${t.titulo}`}
              loading="lazy"
              className="mt-4 w-full max-w-4xl rounded-md border shadow-sm"
            />
          </section>
        ))}
      </div>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Ambiente atual em homologação: notas emitidas em treino não têm valor fiscal.
        Dúvida em qualquer tela? Clique no “?” do topo.
      </p>
    </div>
  );
}
