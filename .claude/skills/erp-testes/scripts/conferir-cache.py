#!/usr/bin/env python3
"""
Acha gravações que deixam telas com dado velho (SÓ LEITURA).

Para cada ponto de escrita do front (hook de mutação ou arquivo com escrita
direta), calcula as tabelas afetadas — incluindo as que os TRIGGERS e as RPCs
gravam em cascata — e lista as leituras (queryKey) que dependem delas, direto
ou por uma VIEW, e que esse ponto não invalida. Foi assim que se achou o
fechamento de caixa mostrando só o saldo inicial: a venda não relia o resumo.

Entende invalidateQueries literal, invalidarDominios(...) (src/lib/dominios-cache.ts)
e invalidarProdutos(...). Dependências do banco vêm da VPS (.env).

Uso: python3 .claude/skills/erp-testes/scripts/conferir-cache.py [--tudo]
     sem --tudo mostra só o que é estado operacional (caixa, estoque, contas…)
"""
import collections, os, pathlib, re, subprocess, sys

raiz = pathlib.Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
os.chdir(raiz)
env = {}
for l in open(".env", encoding="utf-8"):
    m = re.match(r"^(ERP_[A-Z_]+)=([^#\s]*)", l)
    if m: env[m.group(1)] = m.group(2)

SQL = r"""
SELECT 'V', view_name, table_name FROM information_schema.view_table_usage WHERE view_schema='erp' AND table_schema='erp';
SELECT 'R', p.proname, t.tbl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
  LATERAL (SELECT DISTINCT (regexp_matches(pg_get_functiondef(p.oid), '(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:erp\.)?(erp_[a-z_0-9]+)', 'gi'))[1] AS tbl) t
 WHERE n.nspname='erp' AND p.prokind='f';
SELECT 'G', c.relname, (regexp_matches(pg_get_functiondef(t.tgfoid), '(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:erp\.)?(erp_[a-z_0-9]+)', 'gi'))[1]
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='erp' AND NOT t.tgisinternal;
"""
out = subprocess.run(["ssh", "-o", "ConnectTimeout=15", env["ERP_SSH_HOST"],
                      f"docker exec -i {env['ERP_DB_CONTAINER']} psql -U supabase_admin -d postgres -At -F '|'"],
                     input=SQL, capture_output=True, text=True, check=True).stdout
view_tabs, rpc_w, trg = (collections.defaultdict(set) for _ in range(3))
for l in out.splitlines():
    p = l.split("|")
    if len(p) != 3: continue
    {"V": view_tabs, "R": rpc_w, "G": trg}[p[0]][p[1]].add(p[2])

def cascata(tabs):
    vistas, fila = set(tabs), list(tabs)
    while fila:
        for x in trg.get(fila.pop(), ()):
            if x not in vistas: vistas.add(x); fila.append(x)
    return vistas

# domínios declarados em dominios-cache.ts
dc = pathlib.Path("src/lib/dominios-cache.ts").read_text()
dominios = {m.group(1): re.findall(r'"([a-zA-Z_0-9-]+)"', m.group(2))
            for m in re.finditer(r"\n  (\w+): \[(.*?)\],", dc, re.S)}
venda = re.search(r"DOMINIOS_DA_VENDA: Dominio\[\] = \[(.*?)\]", dc, re.S)
dom_venda = re.findall(r'"(\w+)"', venda.group(1)) if venda else []

def invalidadas(corpo):
    ks = set(re.findall(r"invalidateQueries\(\{\s*queryKey:\s*\[\s*['\"]([a-zA-Z_0-9-]+)['\"]", corpo))
    for m in re.finditer(r"invalidarDominios\(\s*qc\s*,([^)]*)\)", corpo):
        args = m.group(1)
        nomes = re.findall(r'"(\w+)"', args) + (dom_venda if "DOMINIOS_DA_VENDA" in args else [])
        for n in nomes: ks |= set(dominios.get(n, []))
    if "invalidarProdutos(" in corpo: ks |= set(dominios.get("estoque", []))
    for m in re.finditer(r"for \(const (\w+) of \[([^\]]*)\]\)[^\n]*\n?[^\n]*invalidateQueries\(\{\s*queryKey:\s*\[\1\]", corpo):
        ks |= set(re.findall(r"['\"]([a-zA-Z_0-9-]+)['\"]", m.group(2)))
    return ks

FROM = r"\.from\(\s*['\"]([a-z_0-9]+)['\"]\)"
WRITE = r"\.from\(\s*['\"]([a-z_0-9]+)['\"]\)\s*\.\s*(insert|update|upsert|delete)\b"
RPC = r"\.rpc\(\s*['\"]([a-z_0-9]+)['\"]"
src = {p: p.read_text() for p in pathlib.Path("src").rglob("*.ts*") if ".test." not in p.name}

leituras = collections.defaultdict(set)
for p, s in src.items():
    for m in re.finditer(r"useQuery(?:<[^>]*>)?\(\{", s):
        b = s[m.start(): m.start() + 2500]
        k = re.search(r"queryKey:\s*\[\s*['\"]([a-zA-Z_0-9-]+)['\"]", b)
        if not k: continue
        c = re.search(r"\n\s*\}\);\n", b); b = b[: c.end()] if c else b
        for t in re.findall(FROM, b): leituras[k.group(1)] |= view_tabs.get(t, {t}) | {t}

q = pathlib.Path("src/lib/supabase-queries.ts").read_text()
hooks, sitios = {}, {}
for m in re.finditer(r"export function (use[A-Za-z0-9]+)\(", q):
    ini = m.start(); fim = q.find("\nexport function ", ini + 10); corpo = q[ini: fim if fim > 0 else len(q)]
    if "useMutation" not in corpo: continue
    esc = {t for t, _ in re.findall(WRITE, corpo)}
    for r in re.findall(RPC, corpo): esc |= rpc_w.get(r, set())
    hooks[m.group(1)] = (esc, invalidadas(corpo))
    sitios[f"hook {m.group(1)}"] = hooks[m.group(1)]
for p, s in src.items():
    if p.name == "supabase-queries.ts": continue
    esc = {t for t, _ in re.findall(WRITE, s)}
    for r in re.findall(RPC, s): esc |= rpc_w.get(r, set())
    if not esc: continue
    inv = invalidadas(s)
    for h in re.findall(r"\b(use[A-Z][A-Za-z0-9]+)\(", s):
        if h in hooks: inv |= hooks[h][1]
    sitios[f"arquivo {p}"] = (esc, inv)

OPER = re.compile(r"caixa|estoque|contas|produto|lote|venda|pedido|saldo|fechamento|crediario|fidelidade|comiss|cliente|fornecedor|dashboard|kpi")
RUIDO = re.compile(r"auditoria|periodo|rel_|top-|parado|metas|taxas|formas-receb|vendas-por|curva")
tudo = "--tudo" in sys.argv
achados = 0
for nome, (esc, inv) in sorted(sitios.items()):
    af = cascata(esc)
    falt = sorted(k for k, t in leituras.items() if t & af and not any(k == i or k.startswith(i) for i in inv))
    if not tudo: falt = [k for k in falt if OPER.search(k) and not RUIDO.search(k)]
    if falt:
        achados += 1
        print(f"{nome}\n   não relê: {', '.join(falt)}")
print(f"\n{achados} ponto(s) de escrita com leitura dependente não relida"
      f"{'' if tudo else ' (só estado operacional; --tudo para todas)'}.")
