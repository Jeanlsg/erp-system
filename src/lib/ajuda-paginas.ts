// ============================================================
// O que cada página faz — texto do botão "?" no header.
//
// A chave é o pathname sem a barra inicial; rotas-apelido (o mesmo
// componente atende /financeiro e /gestao/relatorios-financeiros, por
// exemplo) apontam para a mesma descrição via ALIASES. A resolução tenta
// o caminho exato e depois recua segmento a segmento, então uma rota nova
// herda a descrição da seção até ganhar a sua.
// ============================================================

export interface AjudaPagina {
  titulo: string;
  descricao: string;
}

const A: Record<string, AjudaPagina> = {
  "": {
    titulo: "Dashboard",
    descricao: "Resumo do dia: vendas, caixa e alertas das lojas. É o ponto de partida — os números daqui vêm das mesmas tabelas das telas detalhadas.",
  },
  "visao-geral": {
    titulo: "Visão Geral",
    descricao: "Indicadores consolidados das lojas: faturamento, ticket médio e comparativos por período.",
  },
  pdv: {
    titulo: "PDV — Ponto de Venda",
    descricao: "Frente de caixa: busca produto, monta o carrinho, recebe e finaliza. Funciona sem internet — a venda fica guardada neste computador e sobe sozinha quando a conexão volta. O cupom fiscal (NFC-e) é emitido junto quando configurado.",
  },
  caixa: {
    titulo: "Caixa",
    descricao: "Abertura, sangria, reforço e fechamento de caixa, com o valor esperado em gaveta calculado a partir das vendas registradas.",
  },
  vendas: {
    titulo: "Vendas",
    descricao: "Histórico de vendas com filtros por loja, período e forma de pagamento. Cancelamento de venda passa por aqui.",
  },
  "pedidos-delivery": {
    titulo: "Ciclo de Pedidos",
    descricao: "Kanban de logística: Pagamento → Separação → Despacho → Entregue. Arraste o pedido (ou use o botão do cartão); pedido parado além do normal fica marcado em vermelho. Taxas e regiões vêm de Regiões de Entrega.",
  },
  ifood: { titulo: "Pedidos iFood", descricao: "Integração de pedidos vindos do iFood." },
  "exapp-pedidos": { titulo: "ExApp Pedidos", descricao: "Pedidos recebidos pelo aplicativo próprio da loja." },
  devolucoes: {
    titulo: "Devoluções",
    descricao: "Devolução de venda: o estoque volta, a NF-e de devolução (entrada, finalidade 4) referencia a nota original e o financeiro é ajustado.",
  },
  estoque: {
    titulo: "Estoque",
    descricao: "Posição de estoque por loja e produto.",
  },
  "produtos-estoque-lotes": {
    titulo: "Cadastro e Estoque",
    descricao: "Cadastro de produtos, categorias, lotes e posição de estoque numa tela só. As ações rápidas incluem reajuste de preços em massa (sobre o filtro atual), etiquetas com código de barras e a lista de produtos desativados para reativação.",
  },
  "estoque/movimentacoes": {
    titulo: "Movimentações (Kardex)",
    descricao: "Toda entrada e saída de estoque com saldo anterior, posterior e custo médio no momento do movimento. É o livro-razão do estoque: se um saldo parece errado, a resposta está aqui.",
  },
  "estoque/inventario": {
    titulo: "Inventário / Balanço",
    descricao: "Contagem física contra o saldo do sistema. Abrir o inventário fotografa o saldo atual; aplicar gera um movimento de ajuste rastreável para cada divergência — nada é sobrescrito em silêncio. Saldos negativos deixados por vendas offline aparecem aqui para reconciliar.",
  },
  "estoque.transferencia": {
    titulo: "Transferências",
    descricao: "Transferência de estoque entre lojas, com baixa na origem e entrada no destino.",
  },
  compras: {
    titulo: "Compras",
    descricao: "Pedidos de compra a fornecedores. A entrada da mercadoria atualiza estoque e custo médio, e as duplicatas da nota geram as contas a pagar.",
  },
  "compras/importar-nfe": {
    titulo: "Importar NF-e",
    descricao: "Lê o XML da nota do fornecedor (upload ou vindo direto da SEFAZ), casa os itens com o cadastro por EAN/SKU e cria a compra com estoque e contas a pagar. A margem sugerida é editável item a item antes de confirmar.",
  },
  kits: { titulo: "Kits & Combos", descricao: "Produtos compostos: um kit agrupa itens do cadastro e baixa o estoque dos componentes ao vender." },
  fornecedores: { titulo: "Fornecedores", descricao: "Cadastro de fornecedores usado em compras, contas a pagar e na entrada de NF-e." },
  funcionarios: { titulo: "Funcionários", descricao: "Cadastro de funcionários; vendedores daqui podem ser vinculados às vendas para comissão." },
  lojas: {
    titulo: "Lojas",
    descricao: "Cadastro das lojas (matriz e filiais). O botão de conferência valida IE e endereço contra o cadastro da SEFAZ — este endereço é o do emitente em toda nota fiscal.",
  },
  financeiro: {
    titulo: "Financeiro",
    descricao: "Contas a pagar e a receber, fluxo de caixa e baixas. Vendas e compras lançam aqui automaticamente; baixar uma conta registra data, valor e forma de pagamento.",
  },
  "gerador-boletos": { titulo: "Boletos", descricao: "Geração de boletos de cobrança." },
  promissoria: { titulo: "Promissórias", descricao: "Emissão de notas promissórias para venda a prazo." },
  "crediario-proprio": {
    titulo: "Crediário Próprio",
    descricao: "Parcelamento da loja com juros próprios (Price ou simples), limite de crédito por cliente e contrato. Cada parcela é também uma conta a receber: baixar aqui baixa no financeiro.",
  },
  "cartao-fidelidade": {
    titulo: "Cartão Fidelidade",
    descricao: "Pontos por real gasto, creditados automaticamente na venda finalizada. Resgate vira desconto; o nível (bronze/prata/ouro) sai do acumulado, então resgatar não rebaixa o cliente.",
  },
  "mala-direta": { titulo: "Mala Direta", descricao: "Campanhas impressas ou por e-mail para a base de clientes." },
  "email-marketing": { titulo: "E-mail Marketing", descricao: "Campanhas de e-mail. Depende de provedor de envio contratado." },
  torpedos: { titulo: "Torpedos SMS", descricao: "Envio de SMS para clientes. Depende de provedor contratado." },
  "notas-fiscais": {
    titulo: "Notas Fiscais",
    descricao: "NF-e e NFC-e emitidas: consulta, XML, DANFE (gerado na hora se a nota não o tiver arquivado), cancelamento, carta de correção e inutilização de numeração.",
  },
  faturamento: { titulo: "Faturamento", descricao: "Emissão de NF-e de venda (modelo 55) para pedidos e clientes com cadastro completo." },
  remessas: {
    titulo: "Remessas entre Filiais",
    descricao: "Transferência com NF-e de remessa (CFOP 5152/6152): emite a nota, movimenta o estoque e acompanha o trânsito até o recebimento na filial.",
  },
  fiscal: { titulo: "Fiscal", descricao: "Central fiscal da loja." },
  "fiscal/notas-recebidas": {
    titulo: "Notas Recebidas (SEFAZ)",
    descricao: "Toda NF-e emitida contra o CNPJ da loja, buscada direto na SEFAZ — sem depender de o fornecedor mandar o XML. Dar ciência libera o XML completo com os itens; a conferência envia a nota ao importador de compras. A SEFAZ limita a 1 consulta/hora sem novidade.",
  },
  "fiscal/escrituracao": {
    titulo: "Escrituração (SPED)",
    descricao: "Gera a EFD ICMS/IPI e o SINTEGRA da competência a partir das notas, do kardex e do inventário. Os avisos listam o que faltou preencher com dado real. O arquivo é rascunho até passar pelo PVA da Receita — a transmissão continua sendo por lá.",
  },
  relatorios: { titulo: "Relatórios", descricao: "Relatórios operacionais de vendas, estoque e financeiro." },
  "relatorios/analise": {
    titulo: "Análise Gerencial",
    descricao: "Curva ABC (quais produtos sustentam a receita), ponto de pedido (o que repor antes de faltar), estoque parado (capital imobilizado) e DRE consolidado. Tudo sobre venda realizada e custo médio real — não sobre preço de tabela.",
  },
  configuracoes: { titulo: "Configurações", descricao: "Central de configurações do sistema." },
  "config/sistema": {
    titulo: "Configurações do Sistema",
    descricao: "Parâmetros por chave: prazos, juros do crediário, pontos do fidelidade, dados do contabilista para o SPED, coleta automática de DF-e. Cada chave tem descrição do efeito.",
  },
  "config/empresarial": { titulo: "Configurações Empresariais", descricao: "Dados empresariais usados em documentos e relatórios." },
  "config/minhas-chaves": { titulo: "Chaves PIX", descricao: "Chaves PIX da loja para recebimento e exibição no PDV." },
  "config/downloads": { titulo: "Downloads", descricao: "Arquivos e utilitários para download." },
  "controle-comercial/pedido": { titulo: "Pedido / Pré-venda", descricao: "Pedido registrado antes do faturamento; vira venda ao confirmar." },
  "controle-comercial/orcamento": {
    titulo: "Orçamento",
    descricao: "Proposta com validade. Converter em venda baixa o estoque e gera a conta a receber; orçamento vencido ou já convertido não converte de novo.",
  },
  "controle-comercial/os": { titulo: "Ordem de Serviço", descricao: "Serviços com itens, mão de obra e status de execução." },
  "controle-comercial/consignacao": { titulo: "Venda Consignada", descricao: "Mercadoria deixada com o cliente: acerto posterior entre vendido e devolvido." },
  "controle-comercial/locacao": { titulo: "Locação", descricao: "Aluguel de itens com período e devolução." },
  "tef-sitef": { titulo: "TEF / SITEF", descricao: "Integração com maquininha via TEF." },
  "marketplace-ifood": { titulo: "iFood Marketplace", descricao: "Catálogo e preços publicados no iFood." },
  ajuda: { titulo: "Ajuda", descricao: "Documentação e canais de suporte." },
  "treinamento/tutoriais": { titulo: "Treinamento", descricao: "Tutoriais de uso do sistema." },
  gestao: {
    titulo: "Gestão Empresarial",
    descricao: "Hub dos módulos de gestão: cadastros, financeiro, cobrança, fiscal e configurações.",
  },
  "gestao/clientes": { titulo: "Clientes", descricao: "Cadastro de clientes com limite de crédito, bloqueio e vínculo com tabela de preços." },
  "gestao/consulta-pessoa-fisica": { titulo: "Consulta Pessoa Física", descricao: "Consulta de dados cadastrais de pessoa física. Consulta a bureau de crédito exige contrato (Serasa/SPC)." },
  "gestao/consulta-pessoa-juridica": { titulo: "Consulta Pessoa Jurídica", descricao: "Consulta de dados cadastrais de pessoa jurídica. Consulta a bureau de crédito exige contrato." },
  "gestao/agenda-compromissos": { titulo: "Agenda", descricao: "Compromissos e lembretes da equipe." },
  "gestao/agenda-telefonica": { titulo: "Agenda Telefônica", descricao: "Contatos telefônicos de clientes, fornecedores e parceiros." },
  "gestao/documentos": { titulo: "Documentos", descricao: "Arquivos e documentos da empresa organizados por pastas." },
  "gestao/servicos": { titulo: "Serviços", descricao: "Catálogo de serviços prestados, usado em OS e vendas." },
  "gestao/regioes-entrega": { titulo: "Regiões de Entrega", descricao: "Bairros e regiões atendidos, com taxa de entrega por região." },
  "gestao/localizar-pessoas": { titulo: "Localizar Pessoas", descricao: "Busca unificada em clientes, fornecedores e funcionários." },
  "gestao/consulta-cheque": { titulo: "Cheques", descricao: "Controle de cheques recebidos." },
  "gestao/recebimento-cheque": { titulo: "Recebimento de Cheque", descricao: "Registro de recebimento e compensação de cheques." },
  "gestao/cartao-credito": { titulo: "Cartão de Crédito", descricao: "Conferência de recebíveis de cartão de crédito." },
  "gestao/cartao-debito": { titulo: "Cartão de Débito", descricao: "Conferência de recebíveis de cartão de débito." },
  "gestao/dinheiro": { titulo: "Dinheiro", descricao: "Movimentações em espécie." },
  "gestao/gerar-crediario": { titulo: "Crediário (com juros)", descricao: "Simulação e geração de crediário com juros." },
  "gestao/negativar-devedores": { titulo: "Negativar Devedores", descricao: "Encaminhamento de inadimplentes para negativação. Exige contrato com bureau (Serasa/SPC/Boa Vista) — sem contrato, a tela não tem efeito externo." },
  "gestao/parcelar-debitos": { titulo: "Parcelar Débitos", descricao: "Renegociação de dívidas em novas parcelas." },
  "gestao/encaminhar-protesto": { titulo: "Encaminhar Protesto", descricao: "Encaminhamento de títulos a cartório de protesto. Depende de convênio com o cartório." },
  "gestao/solicitacao-parceria": { titulo: "Solicitação de Parceria", descricao: "Pedidos de parceria comercial recebidos." },
  "gestao/email-inteligente": { titulo: "Email Inteligente", descricao: "Caixa de e-mail integrada ao cadastro de clientes." },
  "gestao/nfe-certificado": {
    titulo: "Certificado Digital",
    descricao: "Upload do certificado A1 (.pfx) que assina as notas fiscais. O teste na SEFAZ valida arquivo e senha antes de gravar; o vencimento é acompanhado aqui.",
  },
  "gestao/configuracoes-sefaz": {
    titulo: "Configurações SEFAZ",
    descricao: "Ambiente (homologação/produção), séries, numeração e o CSC da NFC-e por loja. Sem CSC cadastrado, a NFC-e é recusada antes de transmitir.",
  },
  "gestao/painel-contador": { titulo: "Painel do Contador", descricao: "Visão para o contador: documentos fiscais e arquivos do período. A escrituração (SPED) é gerada em Fiscal → Escrituração." },
  "gestao/documentos-demonstrativos": { titulo: "Documentos Demonstrativos", descricao: "DRE simplificado e demonstrativos. A versão completa está em Análise Gerencial." },
  "gestao/avaliacoes": { titulo: "Avaliações", descricao: "Avaliações de clientes sobre a loja." },
  "gestao/recomendacoes": { titulo: "Recomendações", descricao: "Indicações registradas por clientes." },
  "gestao/notificacoes": { titulo: "Notificações", descricao: "Avisos do sistema: estoque baixo, contas vencendo, lotes a vencer." },
  "gestao/ocorrencias": { titulo: "Ocorrências", descricao: "Registro de ocorrências e pendências internas." },
  "gestao/exclusao-informacoes": { titulo: "Exclusão LGPD", descricao: "Atendimento a pedidos de exclusão de dados pessoais (LGPD)." },
  "gestao/usuarios": {
    titulo: "Usuários e Permissões",
    descricao: "Contas de acesso ao ERP com papel (admin, gerente, caixa, estoquista) e permissões finas. O convite chega por e-mail com link para definir a senha.",
  },
  "gestao/dados-empresariais": { titulo: "Dados Empresariais", descricao: "Razão social, CNPJ e dados cadastrais da empresa." },
  "gestao/configuracoes-gerais": { titulo: "Configurações Gerais", descricao: "Preferências gerais de funcionamento." },
  "gestao/codigo-barras": { titulo: "Gerar Código de Barras", descricao: "Geração de códigos de barras para produtos sem EAN." },
  "gestao/cadastro-produtos": { titulo: "Cadastro de Produtos", descricao: "Atalho para o cadastro completo de produtos, estoque e lotes." },
  "gestao/empresarial": { titulo: "Gestão Empresarial", descricao: "Hub dos módulos de gestão." },
  "gestao/arquivos-pastas": { titulo: "Arquivos e Pastas", descricao: "Documentos da empresa organizados por pastas." },
};

// Rotas-apelido: caminhos diferentes, mesma tela.
const ALIASES: Record<string, string> = {
  "financeiro/relatorios": "financeiro",
  "gestao/relatorios-financeiros": "financeiro",
  "gestao/compras/importar-nfe": "compras/importar-nfe",
  "gestao/estoque": "produtos-estoque-lotes",
  "gestao/lotes": "produtos-estoque-lotes",
  "gestao/transferencia-estoque": "estoque.transferencia",
  "gestao/fornecedores": "fornecedores",
  "gestao/funcionarios": "funcionarios",
  "gestao/transportadoras": "fornecedores",
  "gestao/faturamento": "faturamento",
  "gestao/remessas": "remessas",
  "gestao/gerar-boleto": "gerador-boletos",
  "gestao/gerar-promissoria": "promissoria",
  "gestao/gerar-crediario-proprio": "crediario-proprio",
  "gestao/minhas-chaves": "config/minhas-chaves",
  "gestao/downloads": "config/downloads",
  "gestao/pasta-principal": "gestao/arquivos-pastas",
  "gestao/administrar-usuarios": "gestao/usuarios",
  "gestao/usuario-permissoes": "gestao/usuarios",
  produtos: "produtos-estoque-lotes",
  lotes: "produtos-estoque-lotes",
  pedidos: "controle-comercial/pedido",
};

/** Resolve a ajuda do pathname atual; recua por segmentos se não houver exata. */
export function ajudaDaRota(pathname: string): AjudaPagina | null {
  let p = pathname.replace(/^\/+|\/+$/g, "");
  p = ALIASES[p] ?? p;
  while (true) {
    if (p in A) return A[p];
    const corte = p.lastIndexOf("/");
    if (corte < 0) return null;
    p = p.slice(0, corte);
    p = ALIASES[p] ?? p;
  }
}
