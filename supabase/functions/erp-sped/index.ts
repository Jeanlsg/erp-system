// ============================================================================
// Edge Function: erp-sped
// Gera a escrituração fiscal a partir do que o ERP registrou de verdade.
//
// Body: { loja_id, competencia: "AAAA-MM", tipo?: 'efd'|'sintegra', finalidade?: '0'|'1' }
//
// Duas coisas que este gerador NÃO faz, e é importante que fiquem ditas:
//
//   1. Não valida o arquivo. Quem valida é o PVA (Programa Validador e
//      Assinador) da Receita, e não há como rodá-lo daqui. Arquivo gerado
//      sem passar pelo PVA é rascunho, não entrega.
//
//   2. Não decide enquadramento. Perfil, regime e versão do leiaute vêm da
//      configuração porque dependem do que o Fisco estadual determinou para
//      esta empresa — deduzir isso sozinho produziria um arquivo plausível
//      e errado, que é o pior resultado possível.
//
// O gerador acumula AVISOS em vez de falhar no meio: um arquivo incompleto
// com a lista do que falta é mais útil que uma exceção na primeira lacuna.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------- formatação
const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const txt = (v: unknown, max?: number) => {
  // O pipe é o separador do arquivo: deixar um passar corrompe o registro
  // inteiro e o PVA acusa erro num campo que parece correto.
  let s = String(v ?? "").replace(/[|\r\n]/g, " ").trim();
  if (max) s = s.slice(0, max);
  return s;
};
/** EFD usa vírgula decimal e não usa separador de milhar. */
const dec = (v: unknown, casas = 2) => {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(casas).replace(".", ",");
};
/** DDMMAAAA — o formato de data da EFD. */
const dtEfd = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
};
/** AAAAMMDD — o formato do SINTEGRA. */
const dtSint = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
};
const esq = (v: unknown, n: number) => txt(v).toUpperCase().padEnd(n, " ").slice(0, n);
const dir = (v: unknown, n: number) => so(v).padStart(n, "0").slice(-n);
/** Valor em centavos sem separador — o SINTEGRA é posicional, não delimitado. */
const val = (v: unknown, n: number, casas = 2) => {
  const n2 = Math.round(Math.abs(Number(v) || 0) * 10 ** casas);
  return String(n2).padStart(n, "0").slice(-n);
};

const UF_IBGE: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53", ES: "32",
  GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15", PB: "25", PR: "41",
  PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43", RO: "11", RR: "14", SC: "42",
  SP: "35", SE: "28", TO: "17",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "método não suportado" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { db: { schema: "erp" } });
  const adminPublic = createClient(url, serviceKey);

  try {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json(401, { erro: "não autenticado" });

    let erpUserId: string | null = null;
    if (jwt !== serviceKey) {
      const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
      if (userErr || !userData?.user) return json(401, { erro: "não autenticado" });
      const { data: u } = await admin
        .from("erp_usuarios").select("id, role, ativo").eq("id", userData.user.id).maybeSingle();
      if (!u?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
      if (!["admin", "gerente"].includes(u.role)) {
        return json(403, { erro: "sem permissão para gerar escrituração (requer admin/gerente)" });
      }
      erpUserId = u.id;
    }

    const body = await req.json();
    const loja_id = String(body?.loja_id ?? "");
    const competencia = String(body?.competencia ?? "");
    const tipo = body?.tipo === "sintegra" ? "sintegra" : "efd";
    const finalidade = body?.finalidade === "1" ? "1" : "0";

    if (!loja_id) return json(422, { erro: "loja_id é obrigatório" });
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return json(422, { erro: "competencia deve estar no formato AAAA-MM" });
    }

    const [ano, mes] = competencia.split("-").map(Number);
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: dados, error: errDados } = await admin.rpc("dados_escrituracao", {
      p_loja_id: loja_id,
      p_inicio: iso(inicio),
      p_fim: iso(fim),
    });
    if (errDados) return json(500, { erro: `falha ao coletar os dados: ${errDados.message}` });

    const avisos: string[] = [];
    const d: any = dados;
    const loja = d.loja ?? {};
    const cfg = d.config ?? {};
    const saidas: any[] = d.saidas ?? [];
    const entradas: any[] = d.entradas ?? [];
    const produtos: any[] = d.produtos ?? [];
    const unidades: string[] = d.unidades ?? ["UN"];
    const participantes: any[] = d.participantes ?? [];
    const inventario = d.inventario && d.inventario !== null ? d.inventario : null;

    // ---------------- Conferências que valem mais que o arquivo ----------------
    if (saidas.length === 0) {
      avisos.push(
        "Nenhuma nota fiscal de saída no período. A EFD escritura DOCUMENTOS FISCAIS, " +
        "não vendas: enquanto a loja não emitir NFC-e, o bloco C sai vazio por mais " +
        "vendas que existam no PDV.",
      );
    }
    if (entradas.filter((e) => e.resumo).length > 0) {
      avisos.push(
        `${entradas.filter((e) => e.resumo).length} nota(s) de entrada só com resumo — sem os ` +
        "itens, elas entram no bloco C sem C170. Manifestar a ciência libera o XML completo.",
      );
    }
    // O CEP carrega a UF na primeira faixa. Divergência aqui não é detalhe de
    // cadastro: este MESMO endereço é o do emitente na NF-e e na NFC-e, então
    // um CEP de outro estado sai impresso no cupom do cliente.
    const FAIXA_CEP_UF: Record<string, [number, number][]> = {
      SP: [[1000000, 19999999]], RJ: [[20000000, 28999999]], ES: [[29000000, 29999999]],
      MG: [[30000000, 39999999]], BA: [[40000000, 48999999]], SE: [[49000000, 49999999]],
      PE: [[50000000, 56999999]], AL: [[57000000, 57999999]], PB: [[58000000, 58999999]],
      RN: [[59000000, 59999999]], CE: [[60000000, 63999999]], PI: [[64000000, 64999999]],
      MA: [[65000000, 65999999]], PA: [[66000000, 68899999]], AP: [[68900000, 68999999]],
      AM: [[69000000, 69299999]], RR: [[69300000, 69389999]], AC: [[69900000, 69999999]],
      DF: [[70000000, 73699999]], GO: [[72800000, 76799999]], TO: [[77000000, 77999999]],
      MT: [[78000000, 78899999]], RO: [[76800000, 76999999]], MS: [[79000000, 79999999]],
      PR: [[80000000, 87999999]], SC: [[88000000, 89999999]], RS: [[90000000, 99999999]],
    };
    const cepNum = Number(so(loja.cep));
    const faixas = FAIXA_CEP_UF[String(loja.uf ?? "").toUpperCase()];
    if (cepNum && faixas && !faixas.some(([a, b]) => cepNum >= a && cepNum <= b)) {
      avisos.push(
        `CEP ${loja.cep} não pertence a ${loja.uf}. Este é o endereço do EMITENTE: ` +
        "ele vai no registro 0005 da EFD e também no XML de toda NF-e e NFC-e da loja.",
      );
    }
    if (/mercadinho\.com\.br/i.test(String(loja.email ?? ""))) {
      avisos.push(`E-mail da loja (${loja.email}) parece dado de exemplo, não o real.`);
    }
    if (!loja.inscricao_estadual) avisos.push("Loja sem Inscrição Estadual cadastrada (registro 0000).");
    if (!loja.codigo_municipio_ibge) avisos.push("Loja sem código IBGE do município (registro 0000).");
    if (!cfg.sped_contador_nome) {
      avisos.push("Contabilista não cadastrado — o registro 0100 é obrigatório e sairá vazio.");
    }
    const semIE = participantes.filter((p) => p.tipo === "juridica" && !p.ie);
    if (semIE.length > 0) {
      avisos.push(`${semIE.length} participante(s) pessoa jurídica sem Inscrição Estadual (registro 0150).`);
    }
    const semNcm = produtos.filter((p) => !p.ncm);
    if (semNcm.length > 0) avisos.push(`${semNcm.length} produto(s) sem NCM (registro 0200).`);

    const perfil = String(cfg.sped_perfil ?? "B").toUpperCase();
    const regime = String(cfg.regime_tributario ?? "1");
    const simples = regime === "1" || regime === "2";
    const cfopInterna = String(cfg.cfop_venda_filial_mesma_uf ?? "5102");
    const cfopExterna = String(cfg.cfop_venda_filial_outra_uf ?? "6102");

    // Simples Nacional usa CSOSN no lugar do CST. Trocar um pelo outro é o
    // erro clássico da primeira EFD, e o PVA acusa item a item.
    const cstDoItem = (it: any) =>
      simples
        ? dir(it.csosn ?? "400", 3)
        : `${so(it.origem ?? "0").slice(0, 1) || "0"}${dir(it.cst ?? "41", 2)}`;

    const codigoProduto = (id: string) => {
      const p = produtos.find((x) => x.id === id);
      return p ? String(p.codigo) : String(id ?? "").slice(0, 8);
    };
    const codigoParticipante = (id: string | null) =>
      id ? String(id).slice(0, 8) : "";

    // ================================================================
    // EFD ICMS/IPI
    // ================================================================
    function gerarEfd(): string {
      const linhas: string[] = [];
      const conta: Record<string, number> = {};
      const add = (campos: (string | number)[]) => {
        const reg = String(campos[0]);
        conta[reg] = (conta[reg] ?? 0) + 1;
        linhas.push(`|${campos.join("|")}|`);
      };

      const uf = String(loja.uf ?? "").toUpperCase();
      const codVer = String(cfg.sped_cod_ver ?? "019");

      // ---- Bloco 0 ----
      add(["0000", codVer, finalidade, dtEfd(inicio), dtEfd(fim),
        txt(loja.nome, 100), so(loja.cnpj), "", uf, so(loja.inscricao_estadual),
        so(loja.codigo_municipio_ibge), "", "",
        perfil, String(cfg.sped_ind_ativ ?? "1")]);
      add(["0001", "0"]);
      add(["0005", txt(loja.apelido ?? loja.nome, 60), so(loja.cep), txt(loja.logradouro, 60),
        txt(loja.numero, 10), txt(loja.complemento, 60), txt(loja.bairro, 60),
        so(loja.telefone), "", txt(loja.email, 60)]);
      add(["0100", txt(cfg.sped_contador_nome, 100), so(cfg.sped_contador_cpf),
        txt(cfg.sped_contador_crc, 15), so(cfg.sped_contador_cnpj), "", "", "", "", "",
        so(cfg.sped_contador_fone), "", txt(cfg.sped_contador_email, 60),
        so(loja.codigo_municipio_ibge)]);

      for (const p of participantes) {
        const cnpjCpf = so(p.cpf_cnpj);
        const ehPJ = cnpjCpf.length === 14;
        const end = p.endereco ?? {};
        add(["0150", codigoParticipante(p.id), txt(p.nome, 100), "1058",
          ehPJ ? cnpjCpf : "", ehPJ ? "" : cnpjCpf,
          so(p.ie), so(p.codigo_municipio), "",
          txt(end.logradouro ?? end.endereco, 60), txt(end.numero, 10),
          txt(end.complemento, 60), txt(end.bairro, 60)]);
      }

      for (const u of unidades) add(["0190", txt(u, 6), txt(u, 60)]);

      for (const p of produtos) {
        add(["0200", txt(p.codigo, 60), txt(p.nome, 100), txt(p.codigo_barras, 14), "",
          txt(p.unidade, 6), String(p.tipo_item ?? "00"), so(p.ncm), "", "", "",
          dec(p.aliquota_icms ?? 0), so(p.cest)]);
      }
      add(["0990", 0]); // reservado; ajustado no fechamento

      // ---- Bloco C ----
      const temDocs = saidas.length + entradas.length > 0;
      add(["C001", temDocs ? "0" : "1"]);

      /** C190 consolida por CST + CFOP + alíquota. É obrigatório mesmo quando o C170 é dispensado. */
      function analitico(itens: any[], cfopDe: (it: any) => string) {
        const mapa = new Map<string, any>();
        for (const it of itens) {
          const cst = cstDoItem(it);
          const cfop = cfopDe(it);
          const aliq = Number(it.aliquota_icms ?? 0);
          const chave = `${cst}|${cfop}|${aliq}`;
          const acc = mapa.get(chave) ?? {
            cst, cfop, aliq, vlOpr: 0, vlBc: 0, vlIcms: 0,
          };
          acc.vlOpr += Number(it.valor_total ?? 0);
          // Simples Nacional não destaca ICMS no documento próprio: base e
          // valor zerados é o correto, não uma lacuna.
          if (!simples) {
            acc.vlBc += Number(it.valor_total ?? 0);
            acc.vlIcms += Number(it.valor_icms ?? (Number(it.valor_total ?? 0) * aliq) / 100);
          }
          mapa.set(chave, acc);
        }
        return [...mapa.values()];
      }

      // Saídas (documento próprio)
      for (const n of saidas) {
        const cancelada = n.status === "cancelada";
        const codSit = cancelada ? "02" : "00";
        const partId = n.destinatario_id ? codigoParticipante(n.destinatario_id) : "";
        add(["C100", "1", "0", partId, dir(n.modelo, 2), codSit, dir(n.serie, 3),
          so(n.numero), so(n.chave), dtEfd(n.data_emissao), dtEfd(n.data_emissao),
          dec(n.valor_total), "0", dec(n.valor_desconto), "0",
          dec(Number(n.valor_total) - Number(n.valor_frete ?? 0)),
          "9", dec(n.valor_frete), "0", "0",
          "0", "0", "0", "0", "0", "0", "0", "0", "0"]);

        // Nota cancelada não leva itens: o documento existe para fechar a
        // numeração, mas a operação não aconteceu.
        if (cancelada) continue;

        const cfopDe = () => (String(n.modelo) === "65" ? cfopInterna : cfopInterna);

        // Perfil B dispensa o C170 nas saídas próprias. Emitir mesmo assim não
        // é erro, mas infla o arquivo sem acrescentar informação ao Fisco.
        if (perfil === "A") {
          n.itens.forEach((it: any, i: number) => {
            add(["C170", i + 1, txt(codigoProduto(it.produto_id), 60), txt(it.nome, 255),
              dec(it.quantidade, 3), txt(it.unidade ?? "UN", 6), dec(it.valor_total),
              dec(it.desconto), "0", cstDoItem(it), cfopDe(), "",
              simples ? "0" : dec(it.valor_total), dec(it.aliquota_icms ?? 0, 2),
              simples ? "0" : dec((Number(it.valor_total) * Number(it.aliquota_icms ?? 0)) / 100),
              "0", "0", "0", "0",
              "", "", "0", "0", "0",
              "49", "0", "0", "", "", "0",
              "49", "0", "0", "", "", "0", "", "0"]);
          });
        }

        for (const a of analitico(n.itens, cfopDe)) {
          add(["C190", a.cst, a.cfop, dec(a.aliq), dec(a.vlOpr), dec(a.vlBc),
            dec(a.vlIcms), "0", "0", "0", "0", ""]);
        }
      }

      // Entradas (documento de terceiro)
      for (const e of entradas) {
        const partId = e.fornecedor_id ? codigoParticipante(e.fornecedor_id) : "";
        if (!partId) {
          avisos.push(`Nota de entrada ${e.numero} sem fornecedor vinculado — registro 0150 ausente para ela.`);
        }
        add(["C100", "0", "1", partId, dir(e.modelo, 2), "00", dir(e.serie, 3),
          so(e.numero), so(e.chave), dtEfd(e.data_emissao), dtEfd(e.data_entrada ?? e.data_emissao),
          dec(e.valor_total), "0", dec(e.valor_desconto), "0", dec(e.valor_produtos),
          "9", dec(e.valor_frete), "0", "0",
          "0", dec(e.valor_icms), "0", "0", "0", "0", "0", "0", "0"]);

        (e.itens ?? []).forEach((it: any, i: number) => {
          add(["C170", i + 1, txt(codigoProduto(it.produto_id), 60), txt(it.nome, 255),
            dec(it.quantidade, 3), txt(it.unidade ?? "UN", 6), dec(it.valor_total),
            dec(it.desconto), "0", cstDoItem(it), so(it.cfop) || "1102", "",
            dec(it.valor_total), dec(it.aliquota_icms ?? 0), dec(it.valor_icms ?? 0),
            "0", "0", "0", "0",
            "", "", "0", "0", "0",
            "49", "0", "0", "", "", "0",
            "49", "0", "0", "", "", "0", "", "0"]);
        });

        for (const a of analitico(e.itens ?? [], (it: any) => so(it.cfop) || "1102")) {
          add(["C190", a.cst, a.cfop, dec(a.aliq), dec(a.vlOpr), dec(a.vlBc),
            dec(a.vlIcms), "0", "0", "0", "0", ""]);
        }
      }
      add(["C990", 0]);

      // ---- Blocos sem movimento, obrigatórios mesmo vazios ----
      for (const b of ["D", "G", "K"]) {
        add([`${b}001`, "1"]);
        add([`${b}990`, 0]);
      }

      // ---- Bloco E: apuração ----
      // Simples Nacional apura pelo PGDAS-D, não aqui. Zerar a apuração é o
      // correto — preencher débito de ICMS seria declarar imposto que a
      // empresa não deve por este regime.
      add(["E001", "0"]);
      add(["E100", dtEfd(inicio), dtEfd(fim)]);
      add(["E110", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]);
      add(["E990", 0]);
      if (simples) {
        avisos.push(
          "Regime Simples Nacional: o bloco E sai zerado de propósito — a apuração do " +
          "ICMS é feita no PGDAS-D, e declarar débito aqui seria informar imposto indevido.",
        );
      }

      // ---- Bloco H: inventário ----
      if (inventario) {
        const itens: any[] = inventario.itens ?? [];
        const total = itens.reduce((s, i) => s + Number(i.valor ?? 0), 0);
        add(["H001", "0"]);
        add(["H005", dtEfd(inventario.data), dec(total), "01"]);
        for (const it of itens) {
          const p = produtos.find((x) => x.id === it.produto_id);
          add(["H010", txt(it.codigo, 60), txt(p?.unidade ?? "UN", 6),
            dec(it.quantidade, 3), dec(it.custo_medio, 6), dec(it.valor),
            "0", "", "", "", "0"]);
        }
        add(["H990", 0]);
      } else {
        add(["H001", "1"]);
        add(["H990", 0]);
      }

      add(["1001", "1"]);
      add(["1990", 0]);

      // ---- Bloco 9: totalização ----
      // Os totalizadores contam o arquivo inteiro, inclusive a si mesmos —
      // por isso o cálculo vem depois de tudo montado e os placeholders são
      // reescritos no lugar.

      const fecharBloco = (reg: string, prefixos: string[]) => {
        const qtd = prefixos.reduce((s, p) => s + (conta[p] ?? 0), 0) + 1;
        const i = linhas.findIndex((l) => l.startsWith(`|${reg}|`));
        if (i >= 0) linhas[i] = `|${reg}|${qtd}|`;
        conta[reg] = 1;
        return qtd;
      };

      fecharBloco("0990", Object.keys(conta).filter((r) => /^0/.test(r) && r !== "0990"));
      fecharBloco("C990", Object.keys(conta).filter((r) => /^C/.test(r) && r !== "C990"));
      fecharBloco("D990", ["D001"]);
      fecharBloco("E990", Object.keys(conta).filter((r) => /^E/.test(r) && r !== "E990"));
      fecharBloco("G990", ["G001"]);
      fecharBloco("H990", Object.keys(conta).filter((r) => /^H/.test(r) && r !== "H990"));
      fecharBloco("K990", ["K001"]);
      fecharBloco("1990", ["1001"]);

      // O 9900 tem que existir para TODO tipo de registro do arquivo — os do
      // próprio bloco 9 inclusive. Como o bloco 9 se conta, o número de
      // linhas 9900 é (tipos dos blocos anteriores) + 4: 9001, 9900, 9990 e
      // 9999. Errar isso é o motivo mais comum de o PVA recusar de imediato.
      const tipos = Object.keys(conta).sort();
      const qtd9900 = tipos.length + 4;
      const linhasBloco9 = 1 + qtd9900 + 1 + 1;
      const totalLinhas = linhas.length + linhasBloco9;

      linhas.push("|9001|0|");
      for (const reg of tipos) linhas.push(`|9900|${reg}|${conta[reg]}|`);
      linhas.push(`|9900|9001|1|`);
      linhas.push(`|9900|9900|${qtd9900}|`);
      linhas.push(`|9900|9990|1|`);
      linhas.push(`|9900|9999|1|`);
      linhas.push(`|9990|${linhasBloco9}|`);
      linhas.push(`|9999|${totalLinhas}|`);

      return linhas.join("\r\n") + "\r\n";
    }

    // ================================================================
    // SINTEGRA (Convênio ICMS 57/95) — posicional, não delimitado
    // ================================================================
    function gerarSintegra(): string {
      const linhas: string[] = [];
      const conta: Record<string, number> = {};
      const add = (reg: string, linha: string) => {
        conta[reg] = (conta[reg] ?? 0) + 1;
        linhas.push(linha);
      };

      const uf = String(loja.uf ?? "").toUpperCase();
      // `contato` é jsonb no cadastro: concatenar direto imprimiria [object Object]
      // no meio de um arquivo posicional, e o erro só apareceria na entrega.
      const c = loja.contato;
      const nomeContato = typeof c === "string" ? c
        : (c && typeof c === "object" ? (c.nome ?? c.responsavel ?? loja.nome) : loja.nome);

      // Registro 10 — identificação do estabelecimento
      add("10",
        "10" + dir(loja.cnpj, 14) + esq(loja.inscricao_estadual, 14) +
        esq(loja.nome, 35) + esq(loja.cidade, 30) + esq(uf, 2) +
        dir(loja.telefone, 10) + dtSint(inicio) + dtSint(fim) + "331");

      // Registro 11 — endereço
      add("11",
        "11" + esq(loja.logradouro, 34) + dir(loja.numero, 5) + esq(loja.complemento, 22) +
        esq(loja.bairro, 15) + dir(loja.cep, 8) + esq(nomeContato, 28) +
        dir(loja.telefone, 12));

      // Registro 50 — totais por documento
      const doc50 = (n: any, entrada: boolean) => {
        const cnpj = entrada ? so(n.emitente_cnpj) : so(n.consumidor_cpf_cnpj);
        const ie = entrada ? so(n.emitente_ie) : "";
        const cancelada = n.status === "cancelada";
        add("50",
          "50" + dir(cnpj, 14) + esq(ie || "ISENTO", 14) + dtSint(n.data_emissao) +
          esq(uf, 2) + dir(n.modelo, 2) + dir(n.serie, 3) + dir(n.numero, 6) +
          esq(entrada ? "1102" : "5102", 4) + esq(entrada ? "T" : "P", 1) +
          val(n.valor_total, 13) + val(cancelada ? 0 : n.valor_total, 13) +
          val(0, 13) + val(0, 13) + val(0, 13) + val(0, 4) +
          (cancelada ? "S" : "N"));
      };
      for (const n of saidas) doc50(n, false);
      for (const e of entradas) doc50(e, true);

      // Registro 54 — item por documento
      const doc54 = (n: any, entrada: boolean) => {
        if (n.status === "cancelada") return;
        const cnpj = entrada ? so(n.emitente_cnpj) : so(n.consumidor_cpf_cnpj);
        (n.itens ?? []).forEach((it: any, i: number) => {
          add("54",
            "54" + dir(cnpj, 14) + dir(n.modelo, 2) + dir(n.serie, 3) + dir(n.numero, 6) +
            esq(entrada ? (so(it.cfop) || "1102") : "5102", 4) +
            esq(simples ? "090" : "000", 3) + dir(i + 1, 3) +
            esq(codigoProduto(it.produto_id), 14) +
            val(it.quantidade, 11, 3) + val(it.valor_total, 12) + val(it.desconto, 12) +
            val(0, 12) + val(0, 12) + val(0, 12) + val(it.aliquota_icms ?? 0, 4, 2));
        });
      };
      for (const n of saidas) doc54(n, false);
      for (const e of entradas) doc54(e, true);

      // Registro 74 — inventário
      if (inventario) {
        for (const it of (inventario.itens ?? [])) {
          add("74",
            "74" + dtSint(inventario.data) + esq(it.codigo, 14) +
            val(it.quantidade, 13, 3) + val(it.valor, 13) + "1" +
            "".padEnd(14, "0") + "".padEnd(14, " ") + "".padEnd(47, " "));
        }
      }

      // Registro 75 — cadastro dos produtos citados
      for (const p of produtos) {
        add("75",
          "75" + dtSint(inicio) + dtSint(fim) + esq(p.codigo, 14) +
          dir(p.ncm, 8) + esq(p.nome, 53) + esq(p.unidade, 6) +
          val(0, 5, 2) + val(p.aliquota_icms ?? 0, 4, 2) +
          val(0, 5, 2) + val(0, 13, 2));
      }

      // Registro 90 — totalização. Vai por último e conta o próprio registro.
      // O 90 fecha o arquivo: pares tipo+quantidade, o par 99 com o total, e
      // na ÚLTIMA posição o número de registros 90 — que só se sabe depois de
      // montar os pares, porque cabem 8 pares por linha.
      const regs = Object.keys(conta).sort();
      const pares = regs.map((r) => r + dir(conta[r], 8));
      const totalRegs = regs.reduce((acc, r) => acc + conta[r], 0);
      const cabecalho90 = "90" + dir(loja.cnpj, 14) + esq(loja.inscricao_estadual, 14);
      const grupos: string[][] = [];
      for (let i = 0; i < pares.length; i += 8) grupos.push(pares.slice(i, i + 8));
      const ultimo = grupos[grupos.length - 1] ?? [];
      if (ultimo.length >= 8) grupos.push([]);
      grupos[grupos.length - 1].push("99" + dir(totalRegs + grupos.length, 8));
      const qtd90 = grupos.length;
      for (const g of grupos) {
        const corpo = g.join("").padEnd(95, " ").slice(0, 95);
        linhas.push(cabecalho90 + corpo + String(qtd90).slice(-1));
      }
      conta["90"] = qtd90;

      // Todo registro do SINTEGRA tem exatamente 126 posições. Um campo com
      // largura errada desloca silenciosamente tudo que vem depois, e o
      // arquivo só é recusado na entrega — vale falhar aqui.
      const fora = linhas
        .map((l, i) => ({ n: i + 1, reg: l.slice(0, 2), len: l.length }))
        .filter((x) => x.len !== 126);
      if (fora.length > 0) {
        const amostra = fora.slice(0, 5).map((x) => `linha ${x.n} (reg ${x.reg}): ${x.len}`);
        throw new Error(
          `SINTEGRA com registros fora das 126 posições: ${amostra.join("; ")}` +
          (fora.length > 5 ? ` e mais ${fora.length - 5}` : ""),
        );
      }

      return linhas.join("\r\n") + "\r\n";
    }

    const conteudo = tipo === "sintegra" ? gerarSintegra() : gerarEfd();

    if (tipo === "sintegra") {
      avisos.push(
        "SINTEGRA foi dispensado na maioria dos estados para quem entrega a EFD. " +
        "Confirme com o contador se BA/PE ainda exigem antes de transmitir.",
      );
    }
    avisos.push(
      "Arquivo NÃO validado. Passe pelo PVA da Receita antes de transmitir — é ele " +
      "que verifica leiaute, códigos e consistência entre registros.",
    );

    const { data: gravado, error: errGrav } = await admin
      .from("erp_sped_arquivos")
      .insert({
        loja_id, tipo: tipo === "sintegra" ? "sintegra" : "efd_icms_ipi",
        competencia: `${competencia}-01`,
        data_inicial: iso(inicio), data_final: iso(fim),
        finalidade, perfil: tipo === "sintegra" ? null : perfil,
        conteudo,
        linhas: conteudo.split("\r\n").filter(Boolean).length,
        bytes: new TextEncoder().encode(conteudo).length,
        avisos, usuario_id: erpUserId,
      })
      .select("id, linhas, bytes")
      .single();
    if (errGrav) return json(500, { erro: `falha ao gravar o arquivo: ${errGrav.message}` });

    return json(200, {
      ok: true,
      arquivo_id: gravado.id,
      tipo,
      competencia,
      linhas: gravado.linhas,
      bytes: gravado.bytes,
      documentos: { saidas: saidas.length, entradas: entradas.length },
      produtos: produtos.length,
      participantes: participantes.length,
      inventario: !!inventario,
      avisos,
      conteudo,
    });
  } catch (err) {
    console.error("erp-sped:", err);
    return json(500, { erro: err instanceof Error ? err.message : "erro interno" });
  }
});
