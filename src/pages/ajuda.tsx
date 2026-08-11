import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HelpCircle, Search, ChevronDown, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const FAQ: { categoria: string; perguntas: { p: string; r: string; link?: { to: string; label: string } }[] }[] = [
  {
    categoria: "Vendas e PDV",
    perguntas: [
      { p: "Como registrar uma venda?", r: "Abra o PDV, bipe ou busque os produtos, escolha a forma de pagamento e finalize. A venda baixa o estoque automaticamente.", link: { to: "/pdv", label: "Abrir PDV" } },
      { p: "Como abrir e fechar o caixa?", r: "Em Caixa, clique em Abrir Caixa informando o valor de troco inicial. Ao final do turno, use Fechar Caixa — o sistema calcula o fechamento com sangrias e entradas.", link: { to: "/caixa", label: "Ir para Caixa" } },
      { p: "Como registrar uma devolução?", r: "Em Devoluções, clique em Registrar Devolução, selecione a venda finalizada e confirme. Você pode estornar os itens ao estoque na mesma tela.", link: { to: "/devolucoes", label: "Devoluções" } },
      { p: "Como fazer uma pré-venda ou orçamento?", r: "Use o menu Controle Comercial: a Pré-venda registra o interesse do cliente e o Orçamento gera propostas com validade e itens.", link: { to: "/controle-comercial/orcamento", label: "Orçamentos" } },
    ],
  },
  {
    categoria: "Estoque e Produtos",
    perguntas: [
      { p: "Como cadastrar um produto?", r: "Em Cadastro e Estoque, clique em Novo Produto. Informe nome, SKU, código de barras, preços e estoque mínimo.", link: { to: "/produtos-estoque-lotes", label: "Cadastro e Estoque" } },
      { p: "Como controlar lotes e validade?", r: "Na mesma tela de Cadastro e Estoque há a aba de Lotes: cadastre lote, fabricação e validade. O sistema alerta sobre lotes vencendo.", link: { to: "/produtos-estoque-lotes", label: "Lotes" } },
      { p: "Como transferir estoque entre lojas?", r: "Use Remessas entre Filiais: crie a remessa na loja de origem e confirme o recebimento na loja de destino.", link: { to: "/remessas", label: "Remessas" } },
      { p: "Como montar kits de produtos?", r: "Em Kits & Combos, crie o kit escolhendo os produtos, as quantidades e o preço promocional do conjunto.", link: { to: "/kits", label: "Kits" } },
    ],
  },
  {
    categoria: "Financeiro e Cobrança",
    perguntas: [
      { p: "Como lançar contas a pagar/receber?", r: "Em Relatórios Financeiros, use o botão Incluir Contas P/R, ou navegue nas abas À Pagar / À Receber.", link: { to: "/financeiro?aba=apagar", label: "Contas" } },
      { p: "Como gerar boleto, carnê ou promissória?", r: "No menu Financeiro estão Boletos, Crediário Próprio e Promissórias — cada tela emite o documento vinculado à venda ou conta.", link: { to: "/gerador-boletos", label: "Boletos" } },
      { p: "Como negativar ou protestar um devedor?", r: "No menu Cobrança: Negativar Devedores registra a negativação; Encaminhar Protesto gera o título para cartório.", link: { to: "/gestao/negativar-devedores", label: "Cobrança" } },
    ],
  },
  {
    categoria: "Fiscal",
    perguntas: [
      { p: "Como configurar o certificado digital?", r: "Em Fiscal → Certificado Digital, envie o arquivo A1 (.pfx) e a senha. O certificado fica criptografado no banco.", link: { to: "/gestao/nfe-certificado", label: "Certificado" } },
      { p: "Como configurar a SEFAZ?", r: "Em Configurações SEFAZ, defina UF, regime tributário, série e ambiente (homologação/produção).", link: { to: "/gestao/configuracoes-sefaz", label: "SEFAZ" } },
      { p: "Como importar uma NFe de compra?", r: "Em Catálogo → Importar NFe, envie o XML da nota. O sistema cria a compra, os produtos novos e atualiza custos.", link: { to: "/compras/importar-nfe", label: "Importar NFe" } },
    ],
  },
  {
    categoria: "Administração",
    perguntas: [
      { p: "Como criar usuários e definir permissões?", r: "Em Administração → Usuários e Permissões, crie o usuário com email/senha e defina o papel (admin, gerente, caixa, estoquista).", link: { to: "/gestao/usuarios", label: "Usuários" } },
      { p: "Como cadastrar uma nova loja/filial?", r: "Em Cadastros → Lojas, clique em Nova Loja. Toda operação (estoque, caixa, vendas) é separada por loja.", link: { to: "/lojas", label: "Lojas" } },
      { p: "Como ativar/desativar módulos do sistema?", r: "Em Configurações Sistema, a área de Feature Flags permite ligar e desligar módulos por loja.", link: { to: "/config/sistema", label: "Configurações" } },
    ],
  },
];

export function AjudaPage() {
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const filtrado = FAQ.map((cat) => ({
    ...cat,
    perguntas: cat.perguntas.filter((q) => {
      if (!busca) return true;
      const s = busca.toLowerCase();
      return q.p.toLowerCase().includes(s) || q.r.toLowerCase().includes(s);
    }),
  })).filter((cat) => cat.perguntas.length > 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <HelpCircle className="h-6 w-6" /> Central de Ajuda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Dúvidas frequentes por módulo do sistema</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar dúvida..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {filtrado.length === 0 && (
        <p className="text-center text-muted-foreground p-8">Nenhum resultado para "{busca}"</p>
      )}

      {filtrado.map((cat) => (
        <Card key={cat.categoria}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{cat.categoria}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {cat.perguntas.map((q) => {
              const chave = `${cat.categoria}:${q.p}`;
              const estaAberta = aberta === chave || !!busca;
              return (
                <div key={q.p} className="border rounded-md">
                  <button
                    className="w-full flex items-center justify-between p-3 text-left text-sm font-medium hover:bg-accent rounded-md"
                    onClick={() => setAberta(estaAberta && !busca ? null : chave)}
                  >
                    {q.p}
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${estaAberta ? "rotate-180" : ""}`} />
                  </button>
                  {estaAberta && (
                    <div className="px-3 pb-3 text-sm text-muted-foreground">
                      {q.r}
                      {q.link && (
                        <Link to={q.link.to} className="block mt-1 text-primary hover:underline">→ {q.link.label}</Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          Não encontrou o que precisava? Escreva para <a className="text-primary hover:underline" href="mailto:ferramentas@overflowmkt.com">ferramentas@overflowmkt.com</a>
        </CardContent>
      </Card>
    </div>
  );
}
