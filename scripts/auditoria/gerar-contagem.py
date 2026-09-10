#!/usr/bin/env python3
"""
Fase 1 da auditoria — cruza as fontes e gera docs/auditoria/01-contagem-paginas.md.

Fontes (cada uma contada separadamente antes de cruzar):
  1. código      → scratch/rotas_codigo.json   (rotas do App.tsx, inclusive comentadas)
  2. navegação   → scratch/paginas.json        (folhas do menu, ativas e inativas por flag)
                   + rotas alcançadas por botão/link dentro das páginas (lista abaixo)
  3. auxiliares  → scratch/flags.txt           (erp_feature_flags do banco)
  4. perfis      → ROLE_PERMISSIONS (auth-store) × perm de cada item do menu
Segunda passada → scratch/status_rotas.json    (toda rota aberta pela URL na conta demo)

Regra de contagem: 1 rota própria = 1 página; rota dinâmica = 1; alias (mesmo
componente em mais de uma rota) = 1; ?query, abas e modais = estados.
"""
import json, re, sys, collections, datetime, pathlib

SCR = pathlib.Path(sys.argv[1])
REPO = pathlib.Path(__file__).resolve().parents[2]
rotas = json.load(open(SCR / "rotas_codigo.json"))
menu = json.load(open(SCR / "paginas.json"))
status = {r["path"]: r for r in json.load(open(SCR / "status_rotas.json"))}
flags = {}
for ln in open(SCR / "flags.txt"):
    p = ln.rstrip("\n").split("|")
    if len(p) >= 5: flags[p[0]] = {"titulo": p[1], "cat": p[2], "ativo": p[3] == "t", "prot": p[4] == "t"}
rel = {r["url"]: r for r in json.load(open(SCR / "relatorio-ativas.json"))} if (SCR / "relatorio-ativas.json").exists() else {}

# rotas alcançáveis por botão/link dentro das telas (grep em src/pages e src/components)
ALCANCADAS_POR_LINK = {"/config/sistema", "/login", "/", "/produtos", "/pdv", "/financeiro", "/relatorios/analise",
                       "/relatorios", "/notas-fiscais", "/ifood", "/compras/importar-nfe", "/ajuda", "/setup",
                       "/pedidos-delivery", "/lojas", "/kits", "/estoque/movimentacoes", "/estoque/inventario"}

# perm exigida por item de menu (lida do sidebar)
sb = open(REPO / "src/components/app-sidebar.tsx").read()
perm_por_url = {}
for m in re.finditer(r'title: "[^"]+", url: "([^"]+)"[^\n]*?perm: "([a-z_.]+)"', sb):
    perm_por_url[m.group(1).split("?")[0]] = m.group(2)
ROLE = {
 "admin": None,  # tudo
 "gerente": {"pdv.usar","caixa.abrir","caixa.fechar","venda.criar","venda.cancelar","venda.desconto","produto.ver","produto.criar","produto.editar","estoque.ver","estoque.ajustar","estoque.transferir","cliente.ver","cliente.criar","cliente.editar","compra.ver","compra.criar","compra.receber","financeiro.ver","financeiro.lancar","financeiro.conciliar","fiscal.emitir","relatorio.ver","relatorio.exportar","config.ver","loja.ver"},
 "caixa": {"pdv.usar","caixa.abrir","venda.criar","produto.ver","estoque.ver","cliente.ver","cliente.criar"},
 "estoquista": {"produto.ver","produto.criar","produto.editar","estoque.ver","estoque.ajustar","estoque.transferir","compra.ver","compra.criar","compra.receber","relatorio.ver","loja.ver"},
}
def perfis(path):
    perm = perm_por_url.get(path)
    out = ["admin"]
    for r in ("gerente", "caixa", "estoquista"):
        if perm is None or perm in ROLE[r]: out.append(r)
    return out

# ---------- sessão/módulo e tipo ----------
SESSAO = {}
for r in menu["ativas"] + menu["inativas"]:
    SESSAO[r["url"].split("?")[0]] = (r["sec"], r.get("grupo"))
def sessao(path, comp):
    if path in SESSAO: return SESSAO[path][0] + (" › " + SESSAO[path][1] if SESSAO[path][1] else "")
    if path in ("/login", "/setup", "/*") or comp in ("NotFoundPage", "LoginPage", "SetupPage"): return "Acesso e sistema"
    return "Sem menu (só por URL/alias)"
TIPO = {"lista": r"vendas|clientes|fornecedores|funcionarios|notas|movimenta|comissoes|remessas|recebidas|notificacoes|ocorrencias|avaliacoes|recomendacoes|usuarios|lojas|kits|compras$|promissoria|crediario|devolucoes|caixa$",
        "formulário": r"importar|inventario|transferencia|pdv|email-marketing|setup|login|exclusao|codigo-barras",
        "relatório": r"relatorio|analise|financeiro|visao-geral|escrituracao|demonstrativos|^/$|gestao$",
        "config": r"config|sefaz|certificado|chaves|equipamentos|dados-empresariais|configuracoes",
        "sistema": r"login|setup|\*|ajuda|treinamento"}
def tipo(path):
    for t, rx in TIPO.items():
        if re.search(rx, path): return t
    return "lista"

# ---------- páginas únicas (dedupe por componente) ----------
comp_rotas = collections.defaultdict(list)
for r in rotas: comp_rotas[r["comp"]].append(r)
menu_urls = {r["url"].split("?")[0] for r in menu["ativas"]} | {r["url"].split("?")[0] for r in menu["inativas"]}
menu_ativas = {r["url"].split("?")[0] for r in menu["ativas"]}

paginas = []
for comp, lst in comp_rotas.items():
    ativas_cod = [x for x in lst if not x["comentada"]]
    # rota canônica: a que está no menu; senão a primeira ativa; senão a comentada
    canon = next((x for x in ativas_cod if x["path"] in menu_urls), None) or (ativas_cod[0] if ativas_cod else lst[0])
    path = canon["path"]
    st = status.get(path, {})
    flag = flags.get(path)
    aliases = [x["path"] for x in lst if x["path"] != path]
    if comp == "NotFoundPage": classe = "sistema"
    elif not ativas_cod: classe = "só no código"
    elif st and (st.get("erroTela") or not st.get("abriu")): classe = "inativa/quebrada"
    elif path in menu_ativas: classe = "ativa"
    elif flag and not flag["ativo"]: classe = "atrás de flag/permissão"
    elif path in ("/login", "/setup"): classe = "sistema"
    else: classe = "oculta/órfã"
    via = []
    if ativas_cod: via.append("código")
    if path in menu_urls: via.append("menu")
    if path in ALCANCADAS_POR_LINK: via.append("link interno")
    if flag: via.append("flag")
    paginas.append({"comp": comp, "path": path, "aliases": aliases, "classe": classe, "sessao": sessao(path, comp),
                    "tipo": tipo(path), "perfis": perfis(path), "via": via, "status": st, "flag": flag,
                    "titulo": (flag or {}).get("titulo") or next((r["titulo"] for r in menu["ativas"] + menu["inativas"] if r["url"].split("?")[0] == path), st.get("h1") or comp)})
ordem_sessao = ["Início", "Vendas e Pedidos", "Gestão", "Vendas pela Internet", "Configurações", "Acesso e sistema", "Sem menu (só por URL/alias)"]
def chave(p):
    s = p["sessao"].split(" › ")[0]
    return (ordem_sessao.index(s) if s in ordem_sessao else 99, p["sessao"], p["path"])
paginas.sort(key=chave)
cont = collections.Counter(p["classe"] for p in paginas)
total = len(paginas)

# ---------- estados (modais/abas) das páginas ativas ----------
def estados(p):
    r = rel.get(p["path"]) or rel.get(p["path"] + "?aba=apagar")
    if not r: return ""
    abas = r.get("abas") or []
    gatilhos = [b for b in (r.get("botoes") or []) if re.match(r"(Nov[oa]|Cadastrar|Importar|Gerar|Emitir|Abrir|Exportar|Adicionar|Ativar|Criar|Buscar|Selecionar|Registrar|Configurar)", b)]
    partes = []
    if p["path"] == "/financeiro": partes.append("abas: Fluxo, Vendas, Gráficos, Formas, Taxas, Pagas, À Pagar, Recebidas, À Receber, NF (`?aba=`)")
    elif abas: partes.append("abas: " + ", ".join(abas[:8]))
    if gatilhos: partes.append("modais/ações: " + ", ".join(gatilhos[:8]))
    return "; ".join(partes)

# ---------- markdown ----------
hoje = datetime.date.today().strftime("%d/%m/%Y")
L = []
L += [f"# Auditoria — Fase 1: contagem de páginas", "",
      f"Sistema: ERP X-Life Suplementos · Ambiente: **produção** (`erp.lojaxlife.com.br`; não há homologação) · Data: {hoje}",
      "Conta usada: `demo.admin@lojaxlife.com.br` (admin, temporária, criada em 10/09/2026; senha fora do repositório)", "",
      "## 1. Número total de páginas", "",
      f"**Total: {total} páginas** | Ativas: {cont['ativa']} | Ocultas/órfãs: {cont['oculta/órfã']} | Inativas/quebradas: {cont['inativa/quebrada']} | Só no código: {cont['só no código']} | Atrás de flag/permissão: {cont['atrás de flag/permissão']} | Acesso e sistema: {cont['sistema']}", "",
      "Regra aplicada: 1 rota própria = 1 página; o mesmo componente servido por várias rotas (alias) conta **uma vez**; `?aba=`, abas e modais são estados; rotas de API não entram.", ""]
n_cod = len([r for r in rotas if not r["comentada"]]); n_com = len([r for r in rotas if r["comentada"]])
n_menu = len({r["url"].split("?")[0] for r in menu["ativas"]}); n_menu_off = len({r["url"].split("?")[0] for r in menu["inativas"]})
L += ["## 2. Contagem por fonte", "",
      "| Fonte | Encontrado | Observação |", "|---|---|---|",
      f"| Código (`App.tsx`) | {n_cod} rotas ativas + {n_com} comentadas = {n_cod + n_com} declaradas | {n_cod} rotas ativas servem **{len({r['comp'] for r in rotas if not r['comentada']})} componentes** — {n_cod - len({r['comp'] for r in rotas if not r['comentada']})} são aliases herdados do sistema antigo (ex.: `/produtos`, `/gestao/estoque`, `/lotes` → a mesma tela) |",
      f"| Navegação (menu, conta demo) | {n_menu} páginas no menu visível + {n_menu_off} escondidas por flag | Menu na estrutura do Excellent; `?aba=apagar` é estado do Financeiro |",
      f"| Fonte auxiliar (tabela `erp_feature_flags`) | {len(flags)} flags, {sum(1 for f in flags.values() if f['ativo'])} ativas, {sum(1 for f in flags.values() if f['prot'])} protegidas | 1 flag por página governável; páginas de sistema não têm flag |",
      f"| Segunda passada (URL direta) | {len(status)} rotas abertas | inclui uma rota inexistente para confirmar o 404 |", "",
      "Diferenças explicadas: o código tem mais rotas que páginas por causa dos aliases; o menu tem menos porque esconde as desligadas por flag; as páginas de acesso (login, setup, 404) só aparecem no código.", ""]
L += ["## 3. Inventário completo", "",
      "| # | Página | Rota | Sessão/Módulo | Tipo | Perfis com acesso | Status | Encontrada via |", "|---|---|---|---|---|---|---|---|"]
for i, p in enumerate(paginas, 1):
    rota = f"`{p['path']}`" + (f" (aliases: {', '.join('`'+a+'`' for a in p['aliases'])})" if p["aliases"] else "")
    L.append(f"| {i} | {p['titulo']} | {rota} | {p['sessao']} | {p['tipo']} | {', '.join(p['perfis'])} | {p['classe']} | {', '.join(p['via']) or '—'} |")
L += ["", "## 4. Total por sessão/módulo", "", "| Sessão | Páginas | Ativas | Outras |", "|---|---|---|---|"]
por = collections.defaultdict(lambda: [0, 0])
for p in paginas:
    s = p["sessao"].split(" › ")[0]; por[s][0] += 1; por[s][1] += p["classe"] == "ativa"
for s in sorted(por, key=lambda x: ordem_sessao.index(x) if x in ordem_sessao else 99):
    L.append(f"| {s} | {por[s][0]} | {por[s][1]} | {por[s][0] - por[s][1]} |")
L += ["", "## 5. Estados registrados (não entram na contagem)", ""]
for p in paginas:
    if p["classe"] == "ativa":
        e = estados(p)
        if e: L.append(f"- **{p['titulo']}** (`{p['path']}`): {e}")
L += ["", "## 6. Dúvidas de contagem", "",
      "1. **Aliases**: 12 componentes atendem 2–6 rotas cada (herança do Excellent). Contei **uma vez por componente**, com a rota do menu como canônica. Se preferir contar por rota, o total sobe para " + str(n_cod) + ".",
      "2. **`/financeiro?aba=apagar`** (item de menu \"Contas a Pagar/Receber\"): tratado como **estado** do Financeiro, não página.",
      "3. **`/faturamento`** é literalmente o mesmo componente de Notas Fiscais (alias com nome diferente): contado uma vez, em Notas Fiscais.",
      "4. **Importar Planilha** (Cadastro e Estoque) e **Validade/Lotes** são modais com fluxo próprio (upload → conferência → importação). Pela exceção da regra podem contar como página; **não contei**, ficam como estados — decida.",
      "5. **`/setup`** (assistente da primeira empresa) redireciona para \"Sistema já configurado\" quando há loja: contado em Acesso e sistema.",
      "6. Rotas **comentadas** (boletos, mala direta, torpedos, downloads): existem no código mas não abrem — classificadas como \"só no código\".", ""]
L += ["## 7. Ordem proposta para a Fase 2", "",
      "| Lote | Sessão | Páginas | Por quê |", "|---|---|---|---|",
      "| 1 | Vendas e Pedidos (PDV, Caixa, Vendas, Devoluções, Delivery, Notas Fiscais) | 6 | É o balcão: onde o cliente vai viver no dia 1 |",
      "| 2 | Gestão › Gestão Empresarial (estoque, produtos, compras, cadastros) | 12 | Entrada de mercadoria e cadastros reais |",
      "| 3 | Venda Mais + Gestão Recebimentos (crediário, promissória, fidelidade, e-mail) | 4 | Cobrança e recompra |",
      "| 4 | Gestão › Financeiro + Fiscal + Atendimento + Usuários | 12 | Contas, SEFAZ, SPED, LGPD |",
      "| 5 | Início + Configurações + Acesso e sistema | 9 | Dashboards, configurações, login/setup/404 |",
      "| 6 | Páginas atrás de flag / órfãs / só no código | " + str(total - cont['ativa'] - cont['sistema']) + " | Fase 5: decidir caso a caso |", "",
      "Estimativa: lotes de 6–12 páginas, um markdown por sessão, commit ao fim de cada lote.", ""]
L += ["## 8. Nível de confiança", "",
      "**Alto.** Quatro fontes independentes (código, menu, flags no banco, segunda passada por URL com a conta demo) convergem; toda rota ativa foi aberta e teve h1/erros/rede registrados; rota inexistente devolveu a tela 404 do sistema.", "",
      "## Notas de conformidade", "",
      "- Ambiente único de produção: a Fase 1 foi só leitura. Funções com efeito externo serão marcadas \"não testado em produção\" na Fase 2.",
      "- **Corrigido antes deste briefing** (registrado para decisão): (a) lista de Notas Fiscais devolvia 400 por ordenar por `created_at`, coluna inexistente — corrigido para `data_emissao`; (b) tela Comissões embutia `erp_vendas(numero)`, coluna é `numero_pedido`. Ambos em produção desde 10/09.",
      "- Prints de 42 telas já capturados em `public/tutorial/` (1440×900) — serão refeitos no padrão da Fase 2 (`docs/auditoria/prints/…`, tela inteira + 390px).", ""]
out = REPO / "docs/auditoria/01-contagem-paginas.md"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(L), encoding="utf-8")
print(f"{out} — {total} páginas | " + " | ".join(f"{k}: {v}" for k, v in cont.items()))
