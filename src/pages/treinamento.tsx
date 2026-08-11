import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Monitor, Package, Wallet, FileText, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const TRILHAS = [
  {
    titulo: "Operação de Caixa e PDV",
    icon: Monitor,
    minutos: 15,
    passos: [
      { texto: "Abrir o caixa com o troco inicial", to: "/caixa" },
      { texto: "Registrar uma venda no PDV (busca, código de barras, kits)", to: "/pdv" },
      { texto: "Formas de pagamento: dinheiro, PIX, cartão, crediário", to: "/pdv" },
      { texto: "Sangria e entrada extra de caixa", to: "/caixa" },
      { texto: "Fechamento de caixa e conferência", to: "/caixa" },
    ],
  },
  {
    titulo: "Estoque, Produtos e Lotes",
    icon: Package,
    minutos: 20,
    passos: [
      { texto: "Cadastrar produto com SKU e código de barras", to: "/produtos-estoque-lotes" },
      { texto: "Controle de lotes e datas de validade", to: "/produtos-estoque-lotes" },
      { texto: "Montar kits e combos promocionais", to: "/kits" },
      { texto: "Registrar compra manual ou importar NFe do fornecedor", to: "/compras" },
      { texto: "Remessas de estoque entre filiais", to: "/remessas" },
    ],
  },
  {
    titulo: "Financeiro e Cobrança",
    icon: Wallet,
    minutos: 20,
    passos: [
      { texto: "Lançar contas a pagar e a receber", to: "/financeiro?aba=apagar" },
      { texto: "Ler o fluxo de caixa e os relatórios por período", to: "/financeiro" },
      { texto: "Emitir boleto, carnê de crediário e promissória", to: "/gerador-boletos" },
      { texto: "Negativação, parcelamento e protesto de devedores", to: "/gestao/negativar-devedores" },
      { texto: "Controle de cheques recebidos", to: "/gestao/consulta-cheque" },
    ],
  },
  {
    titulo: "Fiscal",
    icon: FileText,
    minutos: 10,
    passos: [
      { texto: "Instalar o certificado digital A1", to: "/gestao/nfe-certificado" },
      { texto: "Configurar SEFAZ (UF, série, ambiente)", to: "/gestao/configuracoes-sefaz" },
      { texto: "Notas fiscais e faturamento", to: "/notas-fiscais" },
      { texto: "Painel do contador e demonstrativos", to: "/gestao/painel-contador" },
    ],
  },
  {
    titulo: "Administração do Sistema",
    icon: Users,
    minutos: 10,
    passos: [
      { texto: "Criar usuários e definir papéis/permissões", to: "/gestao/usuarios" },
      { texto: "Cadastrar lojas e filiais", to: "/lojas" },
      { texto: "Dados empresariais e chaves PIX", to: "/gestao/dados-empresariais" },
      { texto: "Ligar/desligar módulos (feature flags)", to: "/config/sistema" },
    ],
  },
];

export function TreinamentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6" /> Treinamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trilhas de aprendizado do sistema — siga os passos de cada trilha na ordem
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {TRILHAS.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.titulo}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" /> {t.titulo}
                  </CardTitle>
                  <Badge variant="outline">{t.minutos} min</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {t.passos.map((p, i) => (
                    <li key={i}>
                      <Link to={p.to} className="flex items-center gap-2 text-sm hover:text-primary group">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                        {p.texto}
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
