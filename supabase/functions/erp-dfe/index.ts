// ============================================================================
// Edge Function: erp-dfe
// Distribuição DF-e: coleta as NF-e que a SEFAZ emitiu CONTRA o nosso CNPJ,
// sem depender de o fornecedor mandar o XML.
//
// Ações:
//   sincronizar  { loja_id, origem? }        varre o canal a partir do último NSU
//   manifestar   { nfe_entrada_id, tipo, justificativa? }
//   baixar_chave { loja_id, chave }          puxa uma nota específica
//
// Duas regras da SEFAZ moldam o fluxo:
//   - o canal é sequencial por NSU e o controle é NOSSO (erp_dfe_nsu);
//   - sem novidade, 1 consulta/hora. cStat 656 é "consumo indevido" e
//     bloqueia o CNPJ por uma hora — por isso a espera é respeitada aqui,
//     não deixada para o operador lembrar.
//
// Sem manifestação a SEFAZ entrega só o RESUMO (cabeçalho e valor). Os itens
// — que é o que dá custo real ao produto — só vêm depois da ciência.
//
// Credenciais do serviço fiscal: public.integrations (provider='nfe_service').
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

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

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Sem isto, chave de acesso e CNPJ viram número e perdem zeros à esquerda.
  parseTagValue: false,
  parseAttributeValue: false,
});

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v).trim());

/** A chave de acesso carrega modelo, série e número — o resumo não os traz soltos. */
function daChave(chave: string) {
  const c = chave.replace(/\D/g, "");
  if (c.length !== 44) return { modelo: "", serie: 0, numero: 0 };
  return {
    modelo: c.slice(20, 22),
    serie: Number(c.slice(22, 25)),
    numero: Number(c.slice(25, 34)),
  };
}

const MODELO_TIPO: Record<string, string> = { "55": "nfe", "65": "nfce", "57": "cte", "58": "mdf" };

interface DocDFe {
  nsu: string;
  schema: string;
  tipo: "nfe" | "resumo" | "evento" | "outro";
  chave?: string;
  numero?: number;
  serie?: number;
  modelo_tipo?: string;
  data_emissao?: string;
  valor_total?: number;
  valor_produtos?: number;
  valor_frete?: number;
  emitente_cnpj?: string;
  emitente_nome?: string;
  emitente_ie?: string;
  xml?: string;
  evento_tipo?: string;
  evento_descricao?: string;
}

/** Traduz um docZip da distribuição no formato que a RPC grava. */
function interpretar(nsu: string, schema: string, xml: string): DocDFe {
  const base = { nsu, schema, xml };
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    return { ...base, tipo: "outro" };
  }

  // ---- NF-e completa (procNFe): tem os itens, é o que interessa de fato ----
  const infNFe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe;
  if (infNFe) {
    const ide = infNFe.ide ?? {};
    const emit = infNFe.emit ?? {};
    const tot = infNFe.total?.ICMSTot ?? {};
    const chave = str(infNFe["@_Id"]).replace(/\D/g, "");
    const modelo = str(ide.mod) || daChave(chave).modelo;
    return {
      ...base,
      tipo: "nfe",
      chave,
      numero: num(ide.nNF) || daChave(chave).numero,
      serie: num(ide.serie),
      modelo_tipo: MODELO_TIPO[modelo] ?? "nfe",
      data_emissao: str(ide.dhEmi) || str(ide.dEmi),
      valor_total: num(tot.vNF),
      valor_produtos: num(tot.vProd),
      valor_frete: num(tot.vFrete),
      emitente_cnpj: str(emit.CNPJ),
      emitente_nome: str(emit.xNome),
      emitente_ie: str(emit.IE),
    };
  }

  // ---- Resumo (resNFe): cabeçalho e valor, sem itens ----
  const res = doc?.resNFe;
  if (res) {
    const chave = str(res.chNFe).replace(/\D/g, "");
    const d = daChave(chave);
    return {
      ...base,
      tipo: "resumo",
      chave,
      numero: d.numero,
      serie: d.serie,
      modelo_tipo: MODELO_TIPO[d.modelo] ?? "nfe",
      data_emissao: str(res.dhEmi),
      valor_total: num(res.vNF),
      emitente_cnpj: str(res.CNPJ),
      emitente_nome: str(res.xNome),
      emitente_ie: str(res.IE),
    };
  }

  // ---- Eventos: cancelamento do fornecedor é o que muda nossa vida ----
  const resEv = doc?.resEvento;
  const infEv = doc?.procEventoNFe?.evento?.infEvento;
  if (resEv || infEv) {
    const tp = str(resEv?.tpEvento ?? infEv?.tpEvento);
    const desc = str(resEv?.xEvento ?? infEv?.detEvento?.descEvento);
    return {
      ...base,
      tipo: "evento",
      chave: str(resEv?.chNFe ?? infEv?.chNFe).replace(/\D/g, ""),
      evento_tipo: tp === "110111" ? "cancelamento" : tp === "110110" ? "carta_correcao" : tp,
      evento_descricao: desc,
    };
  }

  return { ...base, tipo: "outro" };
}

/** Quanto esperar antes da próxima consulta, pelo que a SEFAZ respondeu. */
function proximaConsulta(cstat: string, temNovidade: boolean): Date {
  const agora = Date.now();
  // 138 com documentos: pode continuar drenando o backlog sem penalidade.
  if (cstat === "138" && temNovidade) return new Date(agora + 60_000);
  // 137 (nada novo) e 656 (consumo indevido) custam uma hora cheia.
  if (cstat === "137" || cstat === "656") return new Date(agora + 3_600_000);
  return new Date(agora + 900_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "método não suportado" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { db: { schema: "erp" } });
  const adminPublic = createClient(url, serviceKey);

  try {
    // ---------------- Autenticação ----------------
    // Dois chamadores: a tela (JWT de usuário do ERP) e o cron (service_role).
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json(401, { erro: "não autenticado" });

    const viaCron = jwt === serviceKey;
    let erpUser: { id: string; role: string } | null = null;

    if (!viaCron) {
      const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
      if (userErr || !userData?.user) return json(401, { erro: "não autenticado" });
      const { data: u } = await admin
        .from("erp_usuarios").select("id, role, ativo").eq("id", userData.user.id).maybeSingle();
      if (!u?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
      if (!["admin", "gerente"].includes(u.role)) {
        return json(403, { erro: "sem permissão para distribuição DF-e (requer admin/gerente)" });
      }
      erpUser = { id: u.id, role: u.role };
    }

    const body = await req.json();
    const acao = String(body?.acao ?? "");
    if (!["sincronizar", "manifestar", "baixar_chave"].includes(acao)) {
      return json(422, { erro: "acao deve ser 'sincronizar', 'manifestar' ou 'baixar_chave'" });
    }

    // ---------------- Loja, certificado e serviço fiscal ----------------
    let loja_id: string = str(body?.loja_id);
    let entrada: any = null;

    if (acao === "manifestar") {
      if (!body?.nfe_entrada_id) return json(422, { erro: "nfe_entrada_id é obrigatório" });
      const { data: e } = await admin
        .from("erp_nfe_entrada").select("*").eq("id", body.nfe_entrada_id).maybeSingle();
      if (!e) return json(422, { erro: "nota de entrada não encontrada" });
      entrada = e;
      loja_id = e.loja_id;
    }
    if (!loja_id) return json(422, { erro: "loja_id é obrigatório" });

    const { data: loja } = await admin.from("erp_lojas").select("*").eq("id", loja_id).maybeSingle();
    if (!loja) return json(422, { erro: "loja não encontrada" });

    const { data: sefaz } = await admin
      .from("erp_configuracoes_sefaz").select("*").eq("loja_id", loja_id).maybeSingle();
    if (!sefaz) return json(422, { erro: "configuração SEFAZ da loja ausente" });

    const { data: cert } = await admin
      .from("erp_certificados_digitais").select("*")
      .eq("loja_id", loja_id).eq("ativo", true)
      .order("data_validade", { ascending: false }).limit(1).maybeSingle();
    if (!cert) return json(422, { erro: "certificado digital A1 ativo não encontrado" });
    if (new Date(cert.data_validade) < new Date()) {
      return json(422, { erro: `certificado vencido em ${cert.data_validade}` });
    }

    const { data: pfxFile, error: pfxErr } = await adminPublic.storage
      .from("certificados").download(cert.arquivo_path);
    if (pfxErr || !pfxFile) return json(422, { erro: `falha ao baixar certificado: ${pfxErr?.message}` });
    const bytes = new Uint8Array(await pfxFile.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const pfxB64 = btoa(bin);

    let senha = cert.senha_armazenada ?? "";
    if (cert.senha_armazenada_cripto) {
      const { data: senhaDec, error: decErr } = await admin
        .rpc("descriptografar_senha_cert", { crypto_data: cert.senha_armazenada_cripto });
      if (decErr) return json(422, { erro: `falha ao decriptar senha do certificado: ${decErr.message}` });
      senha = senhaDec;
    }
    if (!senha) return json(422, { erro: "certificado sem senha armazenada" });

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { erro: "integração nfe_service não configurada (public.integrations)" });
    }

    const base = {
      ambiente: sefaz.ambiente === "producao" ? 1 : 2,
      certificado: { pfx_base64: pfxB64, senha },
      emitente: {
        cnpj: loja.cnpj, razao: loja.nome, ie: loja.inscricao_estadual, uf: loja.uf,
        endereco: { codigo_municipio: loja.codigo_municipio_ibge },
      },
    };

    async function chamar(rota: string, payload: unknown) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), (sefaz.timeout_segundos ?? 45) * 1000);
      try {
        const resp = await fetch(`${integ!.config.url}${rota}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${integ!.config.token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return { ok: resp.ok, data: await resp.json().catch(() => ({})) };
      } catch (e) {
        return { ok: false, data: { erro: e instanceof Error ? e.message : "falha de rede" } };
      } finally {
        clearTimeout(timeout);
      }
    }

    /** Decodifica os docZip da resposta e grava o lote. */
    async function gravarLote(
      data: any,
      opts: { origem: string; nsuInicial: number | null; proxima: Date | null },
    ) {
      const documentos: DocDFe[] = (data?.documentos ?? []).map((d: any) => {
        let xml = "";
        try {
          xml = new TextDecoder().decode(
            Uint8Array.from(atob(String(d.xml_base64 ?? "")), (c) => c.charCodeAt(0)),
          );
        } catch { /* documento ilegível: entra como 'outro' e não trava o lote */ }
        return interpretar(str(d.nsu), str(d.schema), xml);
      });

      const { data: res, error } = await admin.rpc("registrar_dfe_lote", {
        p_loja_id: loja_id,
        p_documentos: documentos,
        p_ult_nsu: num(data?.ult_nsu),
        p_max_nsu: num(data?.max_nsu),
        p_cstat: str(data?.cstat) || null,
        p_motivo: str(data?.motivo) || null,
        p_proxima_em: opts.proxima ? opts.proxima.toISOString() : null,
        p_origem: opts.origem,
        p_nsu_inicial: opts.nsuInicial,
      });
      if (error) throw new Error(`falha ao gravar o lote: ${error.message}`);
      return { ...(res as any), documentos: documentos.length };
    }

    // ================= SINCRONIZAR =================
    if (acao === "sincronizar") {
      // Homologação não é um ambiente de teste da distribuição: o Ambiente
      // Nacional só tem documentos reais. Avisar é melhor que devolver zero
      // e deixar o operador achar que o canal está vazio.
      if (sefaz.ambiente !== "producao") {
        return json(422, {
          erro: "distribuição DF-e só funciona em produção — o Ambiente Nacional não devolve documentos de homologação",
          ambiente: sefaz.ambiente,
        });
      }

      const { data: ctrl } = await admin
        .from("erp_dfe_nsu").select("*").eq("loja_id", loja_id).maybeSingle();

      const bloqueadoAte = ctrl?.proxima_consulta_em ? new Date(ctrl.proxima_consulta_em) : null;
      if (bloqueadoAte && bloqueadoAte > new Date() && body?.forcar !== true) {
        const faltam = Math.ceil((bloqueadoAte.getTime() - Date.now()) / 60000);
        return json(429, {
          erro: `a SEFAZ limita este canal — próxima consulta liberada em ${faltam} min`,
          proxima_consulta_em: ctrl!.proxima_consulta_em,
          ultimo_cstat: ctrl!.ultimo_cstat,
          ultimo_motivo: ctrl!.ultimo_motivo,
        });
      }

      const origem = body?.origem === "agendada" ? "agendada" : "manual";
      const nsuInicial = Number(ctrl?.ult_nsu ?? 0);
      let ultNSU = nsuInicial;
      const rodadas: any[] = [];
      let novos = 0, documentos = 0;

      // Enquanto houver backlog (138 com documentos) a SEFAZ aceita consultas
      // seguidas. O teto de 5 existe pelo tempo da edge function, não pela SEFAZ:
      // o resto vem na próxima varredura, porque o NSU ficou gravado.
      for (let i = 0; i < 5; i++) {
        const { ok, data } = await chamar("/v1/dfe/distribuicao", { ...base, ult_nsu: ultNSU });
        if (!ok || data?.ok === false) {
          const proxima = proximaConsulta(str(data?.cstat), false);
          await gravarLote(
            { ...data, ult_nsu: ultNSU, max_nsu: ctrl?.max_nsu ?? 0, documentos: [] },
            { origem, nsuInicial, proxima },
          );
          return json(200, {
            ok: false,
            erro: str(data?.motivo) || str(data?.erro) || "a SEFAZ recusou a consulta",
            cstat: str(data?.cstat),
            detalhe: data?.detalhe ?? null,
            proxima_consulta_em: proxima.toISOString(),
            rodadas,
          });
        }

        const cstat = str(data?.cstat);
        const qtd = Number(data?.total ?? 0);
        const maxNSU = num(data?.max_nsu);
        const novoUlt = num(data?.ult_nsu);
        const temMais = cstat === "138" && qtd > 0 && novoUlt < maxNSU;

        const r = await gravarLote(data, {
          origem,
          nsuInicial: i === 0 ? nsuInicial : null,
          // Só a última rodada define a espera: as intermediárias são backlog.
          proxima: temMais && i < 4 ? new Date(Date.now() + 5_000) : proximaConsulta(cstat, qtd > 0),
        });

        documentos += r.documentos;
        novos += Number(r.novos ?? 0);
        rodadas.push({ cstat, motivo: str(data?.motivo), documentos: qtd, novos: r.novos, ult_nsu: novoUlt, max_nsu: maxNSU });

        // ultNSU precisa avançar sempre; senão o loop relê o mesmo trecho.
        if (novoUlt <= ultNSU) break;
        ultNSU = novoUlt;
        if (!temMais) break;
      }

      const { data: ctrlFinal } = await admin
        .from("erp_dfe_nsu").select("*").eq("loja_id", loja_id).maybeSingle();

      // Quantos ficaram só no resumo: é o trabalho que a manifestação destrava.
      const { count: pendentes } = await admin
        .from("erp_nfe_entrada")
        .select("id", { count: "exact", head: true })
        .eq("loja_id", loja_id).eq("origem", "dfe").eq("resumo", true).is("compra_id", null);

      return json(200, {
        ok: true,
        documentos,
        novos,
        rodadas,
        aguardando_manifestacao: pendentes ?? 0,
        ult_nsu: ctrlFinal?.ult_nsu ?? ultNSU,
        max_nsu: ctrlFinal?.max_nsu ?? 0,
        proxima_consulta_em: ctrlFinal?.proxima_consulta_em ?? null,
      });
    }

    // ================= BAIXAR POR CHAVE =================
    // Nota específica, tipicamente com o DANFE em mãos. Não mexe no NSU:
    // consulta por chave é um canal à parte da varredura sequencial.
    if (acao === "baixar_chave") {
      const chave = str(body?.chave).replace(/\D/g, "");
      if (chave.length !== 44) return json(422, { erro: "chave deve ter 44 dígitos" });

      const { ok, data } = await chamar("/v1/dfe/distribuicao", { ...base, chave });
      if (!ok || data?.ok === false) {
        return json(200, {
          ok: false,
          erro: str(data?.motivo) || str(data?.erro) || "a SEFAZ não devolveu a nota",
          cstat: str(data?.cstat),
          // 137 aqui costuma significar que falta manifestar antes.
          dica: str(data?.cstat) === "137"
            ? "sem documento para esta chave — normalmente falta manifestar a ciência da operação"
            : null,
        });
      }

      const ctrlAtual = await admin.from("erp_dfe_nsu").select("ult_nsu,max_nsu").eq("loja_id", loja_id).maybeSingle();
      const r = await gravarLote(
        { ...data, ult_nsu: ctrlAtual.data?.ult_nsu ?? 0, max_nsu: ctrlAtual.data?.max_nsu ?? 0 },
        { origem: "chave", nsuInicial: null, proxima: null },
      );
      return json(200, { ok: true, chave, ...r });
    }

    // ================= MANIFESTAR =================
    // Confirmação, desconhecimento e "não realizada" são declarações
    // definitivas sobre a operação — ficam com o admin. Ciência é o passo
    // operacional que só destrava o XML, então gerente também pode.
    const TIPOS = ["ciencia", "confirmacao", "desconhecimento", "nao_realizada"];
    const tipo = str(body?.tipo) || "ciencia";
    if (!TIPOS.includes(tipo)) {
      return json(422, { erro: `tipo deve ser: ${TIPOS.join(", ")}` });
    }
    if (tipo !== "ciencia" && !viaCron && erpUser?.role !== "admin") {
      return json(403, { erro: `"${tipo}" é uma declaração definitiva à SEFAZ — requer admin` });
    }
    if (!entrada.chave_acesso) return json(422, { erro: "nota sem chave de acesso" });
    if (entrada.tipo_manifestacao === tipo) {
      return json(409, { erro: `esta nota já foi manifestada como "${tipo}"` });
    }

    const justificativa = str(body?.justificativa);
    if (tipo === "nao_realizada" && justificativa.length < 15) {
      return json(422, { erro: "justificativa de no mínimo 15 caracteres para 'operação não realizada'" });
    }

    const { ok, data } = await chamar("/v1/dfe/manifestar", {
      ...base,
      chave: entrada.chave_acesso,
      tipo,
      justificativa,
    });

    const aceito = ok && (data?.registrada === true || data?.ja_existia === true);
    if (!aceito) {
      return json(422, {
        erro: "a SEFAZ não registrou a manifestação",
        cstat: str(data?.cstat),
        motivo: str(data?.motivo) || str(data?.erro),
        detalhe: data?.detalhe ?? null,
      });
    }

    await admin.from("erp_nfe_entrada").update({
      tipo_manifestacao: tipo,
      data_manifestacao: new Date().toISOString(),
      justificativa_manifestacao: justificativa || null,
      status: "manifestada",
      usuario_id: erpUser?.id ?? entrada.usuario_id,
    }).eq("id", entrada.id);

    // O ponto da manifestação é liberar o XML completo. Buscar na hora poupa
    // uma varredura e é o que o operador espera ver na tela.
    let xmlCompleto = false;
    let avisoXml: string | null = null;
    if (entrada.resumo && ["ciencia", "confirmacao"].includes(tipo)) {
      const r = await chamar("/v1/dfe/distribuicao", { ...base, chave: entrada.chave_acesso });
      if (r.ok && r.data?.ok !== false && Number(r.data?.total ?? 0) > 0) {
        const ctrlAtual = await admin.from("erp_dfe_nsu").select("ult_nsu,max_nsu").eq("loja_id", loja_id).maybeSingle();
        await gravarLote(
          { ...r.data, ult_nsu: ctrlAtual.data?.ult_nsu ?? 0, max_nsu: ctrlAtual.data?.max_nsu ?? 0 },
          { origem: "chave", nsuInicial: null, proxima: null },
        );
        const { data: dep } = await admin
          .from("erp_nfe_entrada").select("resumo").eq("id", entrada.id).maybeSingle();
        xmlCompleto = dep?.resumo === false;
      }
      if (!xmlCompleto) {
        // A SEFAZ leva alguns minutos para propagar o evento ao Ambiente Nacional.
        avisoXml = "manifestação registrada; o XML completo costuma levar alguns minutos para ficar disponível";
      }
    }

    return json(200, {
      ok: true,
      tipo,
      cstat: str(data?.cstat),
      motivo: str(data?.motivo),
      protocolo: str(data?.protocolo) || null,
      ja_existia: data?.ja_existia === true,
      xml_completo: xmlCompleto,
      aviso: avisoXml,
    });
  } catch (err) {
    console.error("erp-dfe:", err);
    return json(500, { erro: err instanceof Error ? err.message : "erro interno" });
  }
});
