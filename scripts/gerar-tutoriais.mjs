#!/usr/bin/env node
// ============================================================
// Gera as imagens e o conteúdo dos tutoriais a partir do sistema RODANDO.
//
// O conteúdo de src/content/tutoriais.json NÃO é escrito à mão: sai daqui.
// Editar o json na unha é perder o trabalho na próxima geração.
//
// USO:
//   1. sistema limpo + scripts/dados-demonstracao.sql aplicado
//   2. ERP_URL=... ERP_EMAIL=... ERP_SENHA=... node scripts/gerar-tutoriais.mjs [rota ...]
//      · sem argumentos, regenera TODAS as rotas do json
//      · com rotas, regenera só elas e PRESERVA as demais
//
// O que faz em cada rota: abre a tela, fotografa como ela abre, clica em cada
// botão que abre modal e fotografa o modal, e lê da própria tela os campos e
// os controles. Nenhuma ação destrutiva é executada — botões cujo texto casa
// com PERIGOSO são descritos, nunca clicados.
//
// Uma versão anterior deste gerador viveu só no diretório temporário de uma
// sessão e se perdeu. Por isso ele mora no repositório agora.
// ============================================================

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const URL = process.env.ERP_URL ?? "https://erp.lojaxlife.com.br";
const EMAIL = process.env.ERP_EMAIL;
const SENHA = process.env.ERP_SENHA;
const RAIZ = path.resolve(import.meta.dirname, "..");
const JSON_PATH = path.join(RAIZ, "src/content/tutoriais.json");
const IMG_DIR = path.join(RAIZ, "public/tutorial");

if (!EMAIL || !SENHA) {
  console.error("Faltam ERP_EMAIL e ERP_SENHA no ambiente.");
  process.exit(1);
}

/** Botões que NÃO devem ser clicados: emitem, apagam, transmitem, cobram. */
const PERIGOSO =
  /excluir|apagar|remover|cancelar nota|inutiliz|emitir|transmit|enviar|finalizar|confirmar|salvar|baixa|fechar caixa|abrir caixa|atender|recusar|importar|gerar|sincroniz|buscar novas|receber|pagar|deletar|desativar|inativar|reset/i;

/** Rótulos que abrem modal e são seguros de fotografar. */
const ABRE_MODAL = /^(novo|nova|cadastrar|adicionar|incluir|criar|editar|ver|detalhes|configurações|validade|lotes|kit|classificação|movimentação|relatórios|catálogo|etiquetas|inventário|caixas em aberto|sangria|entrada extra|ler código)/i;

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
   .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * Descrições curadas de src/lib/ajuda-paginas.ts — é o mesmo texto do botão
 * "?" no cabeçalho. Lido do fonte por regex: são pares literais no arquivo,
 * e importar TypeScript aqui exigiria um passo de build só para isto.
 */
async function descricoesCuradas() {
  const src = await fs.readFile(path.join(RAIZ, "src/lib/ajuda-paginas.ts"), "utf8");
  const mapa = new Map();
  const re = /"([\w/.-]*)":\s*\{\s*titulo:\s*"([^"]+)",\s*descricao:\s*"([^"]+)"/g;
  for (const m of src.matchAll(re)) {
    mapa.set("/" + m[1], { titulo: m[2], descricao: m[3] });
  }
  return mapa;
}

async function main() {
  const tutoriais = JSON.parse(await fs.readFile(JSON_PATH, "utf8"));
  const curadas = await descricoesCuradas();
  console.log(`${curadas.size} descrições curadas lidas de ajuda-paginas.ts`);
  const alvos = process.argv.slice(2);
  const paraGerar = alvos.length
    ? tutoriais.filter((t) => alvos.includes(t.url))
    : tutoriais;

  const faltando = alvos.filter((a) => !tutoriais.some((t) => t.url === a));
  if (faltando.length) {
    console.log(`aviso: rotas sem tutorial existente, serão criadas: ${faltando.join(", ")}`);
    for (const url of faltando) paraGerar.push({ url, titulo: url, novo: true });
  }

  console.log(`gerando ${paraGerar.length} de ${tutoriais.length} tutoriais\n`);

  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(`${URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#senha", SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  console.log("autenticado\n");

  const novos = [];
  for (const t of paraGerar) {
    console.log(`▸ ${t.url}`);
    try {
      novos.push(await gerarUm(page, t, curadas));
    } catch (e) {
      console.log(`  ! falhou: ${e.message.split("\n")[0]} — mantendo o tutorial anterior`);
      if (!t.novo) novos.push(t);
    }
  }

  await nav.close();

  // mescla: o que foi gerado substitui, o resto fica como estava
  const porUrl = new Map(tutoriais.map((t) => [t.url, t]));
  for (const n of novos) porUrl.set(n.url, n);
  const final = [...porUrl.values()].sort((a, b) => a.url.localeCompare(b.url));

  await fs.writeFile(JSON_PATH, JSON.stringify(final, null, 1) + "\n");
  console.log(`\n${JSON_PATH} atualizado — ${final.length} tutoriais`);
}

async function gerarUm(page, t, curadas) {
  const base = slug(t.url === "/" ? "inicio" : t.url);
  await page.goto(`${URL}${t.url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3200);

  // Só o conteúdo da página: sem isto, os grupos do menu lateral
  // ("Vendas e Pedidos10", "Gestão27") entravam como controles da tela.
  const conteudo = page.locator("main");

  const imagens = [];
  const arqInicial = `${base}-inicial.jpeg`;
  await page.screenshot({ path: path.join(IMG_DIR, arqInicial), type: "jpeg", quality: 82 });
  imagens.push({ arquivo: arqInicial, legenda: "A tela como ela abre" });
  console.log(`  ✓ ${arqInicial}`);

  const tituloTela = (await page.locator("h1").first().textContent().catch(() => null))?.trim();
  const subtitulo =
    (await page.locator("h1").first().locator("xpath=following::p[1]").textContent().catch(() => null))?.trim() || "";

  // O objetivo é a descrição curada (a mesma do botão "?"), não o subtítulo da
  // tela — que muitas vezes é só um contador ("3 cliente(s) cadastrado(s)") e
  // envelheceria a cada geração.
  const curada = curadas.get(t.url);
  const titulo = curada?.titulo || tituloTela || t.titulo;
  const objetivo = curada?.descricao || t.objetivo || subtitulo;

  // campos visíveis
  const campos = [...new Set(
    (await conteudo.locator("label").allTextContents())
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s && s.length < 48),
  )].slice(0, 24);

  // Controles: botões com texto E os que só têm ícone, cujo rótulo vive no
  // title/aria-label. Sem o segundo caso, ações de linha como Editar e
  // Inativar sumiam do tutorial — justamente as que o usuário mais erra.
  const rotulos = [...new Set(
    (await conteudo.getByRole("button").evaluateAll((els) =>
      els.map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()
        || e.getAttribute("title") || e.getAttribute("aria-label") || ""),
    )).filter(Boolean),
  )];

  const controles = [];
  for (const nome of rotulos.slice(0, 28)) {
    const perigoso = PERIGOSO.test(nome);
    let faz = perigoso
      ? "Ação com efeito real — o sistema pede confirmação antes"
      : "Abre a tela ou a seção correspondente";

    if (!perigoso && ABRE_MODAL.test(nome)) {
      const r = await fotografarModal(page, conteudo, nome, base, imagens);
      if (r) faz = r;
      await page.goto(`${URL}${t.url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1600);
    }
    controles.push({ nome, tipo: "botão", faz, cuidado: perigoso });
  }

  return {
    url: t.url,
    titulo,
    sessao: t.sessao ?? "",
    grupo: t.grupo ?? "",
    objetivo,
    apoio: subtitulo || t.apoio || "",
    perfis: t.perfis ?? ["admin"],
    campos,
    controles,
    imagens,
  };
}

/** Clica no botão, fotografa o modal e descreve o que ele pede. */
async function fotografarModal(page, conteudo, nome, base, imagens) {
  try {
    await conteudo.getByRole("button", { name: nome, exact: true }).first().click({ timeout: 4000 });
    await page.waitForTimeout(1500);
    const modal = page.locator('[role="dialog"]');
    if (!(await modal.count())) return null;

    const arq = `${base}-modal-${slug(nome)}.jpeg`;
    await page.screenshot({ path: path.join(IMG_DIR, arq), type: "jpeg", quality: 82 });
    imagens.push({ arquivo: arq, legenda: `O que aparece ao clicar em "${nome}"` });
    console.log(`  ✓ ${arq}`);

    const tituloModal = (await modal.locator("h2, h3").first().textContent().catch(() => null))?.trim();
    const pedidos = [...new Set(
      (await modal.locator("label").allTextContents())
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s && s.length < 44),
    )].slice(0, 8);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    return pedidos.length
      ? `Abre ${tituloModal || nome}, pedindo: ${pedidos.join(", ")}`
      : `Abre ${tituloModal || nome}`;
  } catch {
    return null;
  }
}

await main();
