// ============================================================================
// Edge Function: emitir-nfe
// Orquestra a emissão REAL de NF-e via microserviço nfe-service (sped-nfe).
//
// Body: { venda_id?: string, remessa_id?: string, loja_id: string, tipo?: 'nfe'|'nfce' }
//   - venda_id   → NF-e de venda (destinatário = cliente da venda)
//   - remessa_id → NF-e de remessa entre filiais (CFOP 5152/6152)
//   - tipo:'nfce' → cupom do varejo presencial (modelo 65): consumidor
//     opcional, sempre operação interna, QR Code assinado com o CSC.
//
// Fluxo: valida usuário ERP → valida pré-requisitos (cert, SEFAZ, NCM) →
// monta payload → chama nfe-service → grava resultado real em erp_notas_fiscais
// + XML/DANFE no bucket `fiscal`.
//
// Credenciais do serviço: public.integrations (provider = 'nfe_service').
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

const FORMA_PAG_MAP: Record<string, string> = {
  dinheiro: "01", cheque: "02", cartao_credito: "03", cartao_debito: "04",
  crediario: "05", boleto: "15", pix: "17", transferencia: "18", promissoria: "99",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "método não suportado" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "erp" } },
  );
  const adminPublic = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ---------------- 1. Autenticação: usuário precisa existir no ERP ----------------
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await adminPublic.auth.getUser(jwt);
    if (userErr || !userData?.user) return json(401, { erro: "não autenticado" });

    const { data: erpUser } = await admin
      .from("erp_usuarios").select("id, role, ativo").eq("id", userData.user.id).maybeSingle();
    if (!erpUser?.ativo) return json(403, { erro: "usuário sem acesso ao ERP" });
    if (!["admin", "gerente"].includes(erpUser.role)) {
      return json(403, { erro: "sem permissão para emitir NF-e (requer admin/gerente)" });
    }

    const { venda_id, remessa_id, loja_id, tipo } = await req.json();
    if (!loja_id || (!venda_id && !remessa_id)) {
      return json(422, { erro: "informe loja_id e venda_id OU remessa_id" });
    }

    // NFC-e (modelo 65) é o cupom do varejo presencial: só para venda.
    const tipoDoc: "nfe" | "nfce" = tipo === "nfce" ? "nfce" : "nfe";
    const isNFCe = tipoDoc === "nfce";
    const modelo = isNFCe ? 65 : 55;
    const rotulo = isNFCe ? "NFC-e" : "NF-e";
    if (isNFCe && remessa_id) {
      return json(422, { erro: "remessa não pode ser emitida como NFC-e — use NF-e modelo 55" });
    }

    // ---------------- 1b. Idempotência: bloquear emissão duplicada ----------------
    const STATUS_VIGENTES = ["autorizada", "pendente", "processando", "pendente_transmissao"];
    if (venda_id) {
      const { data: notaExistente } = await admin
        .from("erp_notas_fiscais")
        .select("id, numero, status, tipo")
        .eq("venda_id", venda_id)
        .eq("tipo", tipoDoc)
        .in("status", STATUS_VIGENTES)
        .limit(1)
        .maybeSingle();
      if (notaExistente) {
        return json(409, {
          erro: `esta venda já possui ${rotulo} nº ${notaExistente.numero} (status: ${notaExistente.status})`,
          nfe_id: notaExistente.id,
        });
      }
    }
    if (remessa_id) {
      const { data: remessaCheck } = await admin
        .from("erp_remessas")
        .select("id, status, nfe_remessa_id")
        .eq("id", remessa_id)
        .maybeSingle();
      if (!remessaCheck) return json(422, { erro: "remessa não encontrada" });
      if (["nf_emitida", "em_transito", "recebida", "cancelada"].includes(remessaCheck.status)) {
        return json(409, {
          erro: `remessa com status "${remessaCheck.status}" não permite nova emissão de NF-e`,
        });
      }
      if (remessaCheck.nfe_remessa_id) {
        const { data: notaRemessa } = await admin
          .from("erp_notas_fiscais")
          .select("id, numero, status")
          .eq("id", remessaCheck.nfe_remessa_id)
          .maybeSingle();
        if (notaRemessa && STATUS_VIGENTES.includes(notaRemessa.status)) {
          return json(409, {
            erro: `esta remessa já possui NF-e nº ${notaRemessa.numero} (status: ${notaRemessa.status})`,
            nfe_id: notaRemessa.id,
          });
        }
      }
    }

    // ---------------- 2. Pré-requisitos da loja ----------------
    const { data: loja } = await admin.from("erp_lojas").select("*").eq("id", loja_id).single();
    if (!loja) return json(422, { erro: "loja não encontrada" });

    const faltas: string[] = [];
    if (!loja.cnpj) faltas.push("CNPJ da loja");
    if (!loja.inscricao_estadual) faltas.push("Inscrição Estadual da loja");
    if (!loja.codigo_municipio_ibge) faltas.push("código IBGE do município da loja");
    if (!loja.logradouro || !loja.cidade || !loja.uf || !loja.cep) faltas.push("endereço completo da loja");

    const { data: sefaz } = await admin
      .from("erp_configuracoes_sefaz").select("*").eq("loja_id", loja_id).maybeSingle();
    if (!sefaz) faltas.push("configuração SEFAZ da loja");

    const { data: cert } = await admin
      .from("erp_certificados_digitais").select("*")
      .eq("loja_id", loja_id).eq("ativo", true)
      .order("data_validade", { ascending: false }).limit(1).maybeSingle();
    if (!cert) faltas.push("certificado digital A1 ativo");
    else if (new Date(cert.data_validade) < new Date()) faltas.push(`certificado vencido em ${cert.data_validade}`);

    // NFC-e exige CSC (código de segurança do contribuinte) para o QR Code
    if (isNFCe && sefaz && (!sefaz.csc_token || !sefaz.csc_id)) {
      faltas.push("CSC e CSC id da NFC-e (obtidos no portal da SEFAZ e cadastrados em Configurações SEFAZ)");
    }

    if (faltas.length > 0) return json(422, { erro: "pré-requisitos ausentes", faltas });

    // ---------------- 3. Certificado: arquivo + senha ----------------
    const { data: pfxFile, error: pfxErr } = await adminPublic.storage
      .from("certificados").download(cert.arquivo_path);
    if (pfxErr || !pfxFile) return json(422, { erro: `falha ao baixar certificado: ${pfxErr?.message}` });
    const pfxB64 = btoa(String.fromCharCode(...new Uint8Array(await pfxFile.arrayBuffer())));

    let senha = cert.senha_armazenada ?? "";
    if (cert.senha_armazenada_cripto) {
      const { data: senhaDec, error: decErr } = await admin
        .rpc("descriptografar_senha_cert", { crypto_data: cert.senha_armazenada_cripto });
      if (decErr) return json(422, { erro: `falha ao decriptar senha do certificado: ${decErr.message}` });
      senha = senhaDec;
    }
    if (!senha) return json(422, { erro: "certificado sem senha armazenada" });

    // ---------------- 4. Montar itens + destinatário ----------------
    let itens: any[] = [];
    let destinatario: any = null;
    let natureza = "VENDA DE MERCADORIA";
    let cfopPadrao = "5102";
    let pagamentos: any[] = [];
    let observacoes = "";
    let totalNota = 0;

    if (remessa_id) {
      const { data: remessa } = await admin
        .from("erp_remessas")
        .select("*, origem:erp_lojas!loja_origem_id(*), destino:erp_lojas!loja_destino_id(*), itens:erp_remessa_itens(*, produto:erp_produtos(*))")
        .eq("id", remessa_id).single();
      if (!remessa) return json(422, { erro: "remessa não encontrada" });

      const mesmaUF = remessa.origem.uf === remessa.destino.uf;
      cfopPadrao = mesmaUF ? "5152" : "6152";
      natureza = "REMESSA ENTRE ESTABELECIMENTOS";
      observacoes = `Remessa para filial ${remessa.destino.apelido}`;
      destinatario = {
        cpf_cnpj: remessa.destino.cnpj,
        nome: remessa.destino.nome,
        ie: remessa.destino.inscricao_estadual,
        endereco: {
          logradouro: remessa.destino.logradouro, numero: remessa.destino.numero,
          bairro: remessa.destino.bairro, municipio: remessa.destino.cidade,
          uf: remessa.destino.uf, cep: remessa.destino.cep,
          codigo_municipio: remessa.destino.codigo_municipio_ibge,
        },
      };
      itens = (remessa.itens ?? []).map((i: any) => ({
        codigo: i.produto?.sku ?? i.produto_id,
        descricao: i.produto?.nome ?? "PRODUTO",
        ean: i.produto?.codigo_barras,
        ncm: i.produto?.ncm,
        cest: i.produto?.cest,
        cfop: cfopPadrao,
        csosn: "400", // remessa: não tributada
        unidade: i.produto?.unidade ?? "UN",
        quantidade: Number(i.quantidade),
        valor_unitario: Number(i.produto?.preco_custo ?? 0),
      }));
      totalNota = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      pagamentos = [{ forma: "90", valor: 0 }]; // 90 = sem pagamento
    } else {
      const { data: venda } = await admin
        .from("erp_vendas")
        .select("*, cliente:erp_pessoas(*), itens:erp_venda_itens(*, produto:erp_produtos(*))")
        .eq("id", venda_id).single();
      if (!venda) return json(422, { erro: "venda não encontrada" });
      if (venda.status !== "finalizada") return json(422, { erro: `venda com status "${venda.status}" — só vendas finalizadas geram ${rotulo}` });

      if (isNFCe) {
        // NFC-e: consumidor é opcional. Se houver CPF/CNPJ, vai identificado;
        // sem ele, sai como consumidor não identificado — e nunca leva endereço.
        destinatario = venda.cliente?.cpf_cnpj
          ? { cpf_cnpj: venda.cliente.cpf_cnpj, nome: venda.cliente.nome_razao }
          : {};
      } else {
        if (!venda.cliente?.cpf_cnpj) {
          return json(422, { erro: "venda sem cliente identificado com CPF/CNPJ (NF-e modelo 55 exige destinatário)" });
        }

        // Endereço do destinatário é obrigatório na NF-e de venda
        const endCliente = venda.cliente.endereco ?? {};
        const faltasEndereco: string[] = [];
        if (!endCliente.logradouro) faltasEndereco.push("logradouro");
        if (!(endCliente.cidade || endCliente.municipio)) faltasEndereco.push("município");
        if (!endCliente.uf) faltasEndereco.push("UF");
        if (faltasEndereco.length > 0) {
          return json(422, {
            erro: `endereço do cliente incompleto para emissão de NF-e — cadastre: ${faltasEndereco.join(", ")}`,
            faltas: faltasEndereco,
          });
        }

        destinatario = {
          cpf_cnpj: venda.cliente.cpf_cnpj,
          nome: venda.cliente.nome_razao,
          endereco: endCliente,
        };
      }
      // NFC-e é sempre operação interna (CFOP 5xxx)
      const interestadual = !isNFCe && (venda.cliente?.endereco?.uf ?? loja.uf) !== loja.uf;
      itens = (venda.itens ?? []).filter((i: any) => i.produto_id).map((i: any) => ({
        codigo: i.produto?.sku ?? i.produto_id,
        descricao: i.produto?.nome ?? i.nome,
        ean: i.produto?.codigo_barras,
        ncm: i.produto?.ncm,
        cest: i.produto?.cest,
        cfop: interestadual ? "6102" : (i.produto?.cfop_padrao ?? "5102"),
        csosn: i.produto?.csosn ?? "102",
        unidade: i.produto?.unidade ?? "UN",
        quantidade: Number(i.quantidade),
        valor_unitario: Number(i.preco_unitario ?? i.preco ?? 0),
      }));
      totalNota = Number(venda.total);
      pagamentos = [{ forma: FORMA_PAG_MAP[venda.forma_pagamento] ?? "99", valor: Number(venda.total) }];
      observacoes = `Venda #${venda.numero_pedido ?? ""}`.trim();
    }

    if (itens.length === 0) return json(422, { erro: "nenhum item de produto para emitir" });
    const semNcm = itens.filter((i) => !i.ncm);
    if (semNcm.length > 0) {
      return json(422, {
        erro: "produtos sem NCM — cadastre o NCM na tela de produtos antes de emitir",
        produtos: semNcm.map((i) => i.descricao),
      });
    }

    // ---------------- 5. Numeração (com lock no banco) ----------------
    const { data: numero, error: numErr } = await admin
      .rpc("incrementar_numeracao_nfe", { p_loja_id: loja_id, p_tipo: tipoDoc });
    if (numErr || !numero) return json(500, { erro: `falha na numeração: ${numErr?.message}` });
    const serieDoc = (isNFCe ? sefaz.serie_nfce : sefaz.serie_nfe) ?? 1;

    // ---------------- 6. Chamar o nfe-service ----------------
    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "nfe_service").single();
    if (!integ?.config?.url || !integ?.config?.token) {
      return json(500, { erro: "integração nfe_service não configurada (public.integrations)" });
    }

    const payload = {
      ambiente: sefaz.ambiente === "producao" ? 1 : 2,
      certificado: { pfx_base64: pfxB64, senha },
      emitente: {
        cnpj: loja.cnpj,
        razao: loja.nome,
        fantasia: loja.apelido,
        ie: loja.inscricao_estadual,
        crt: 1, // Simples Nacional — ajustar se mudar de regime
        uf: loja.uf,
        endereco: {
          logradouro: loja.logradouro, numero: loja.numero, bairro: loja.bairro,
          municipio: loja.cidade, uf: loja.uf, cep: loja.cep,
          codigo_municipio: loja.codigo_municipio_ibge, fone: loja.telefone,
        },
      },
      destinatario,
      // CSC só faz sentido na NFC-e — é o que assina o QR Code do cupom
      ...(isNFCe ? { csc: sefaz.csc_token, csc_id: sefaz.csc_id } : {}),
      nota: { modelo, serie: serieDoc, numero, natureza, observacoes },
      itens,
      pagamentos,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (sefaz.timeout_segundos ?? 30) * 1000);
    let resultado: any;
    try {
      const resp = await fetch(`${integ.config.url}/v1/nfe/emitir`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${integ.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      resultado = await resp.json();
      if (!resp.ok) {
        // O número já foi consumido na numeração — registra rastro da rejeição
        const motivoRejeicao =
          typeof resultado?.motivo === "string"
            ? resultado.motivo
            : `nfe-service HTTP ${resp.status}: ${JSON.stringify(resultado ?? {})}`.slice(0, 1000);
        const { error: rastroErr } = await admin.from("erp_notas_fiscais").insert({
          loja_id, tipo: tipoDoc, numero, serie: serieDoc,
          status: "rejeitada", valor_total: totalNota,
          data_emissao: new Date().toISOString(),
          venda_id: venda_id ?? null, destinatario_id: null,
          certificado_id: cert.id, configuracao_sefaz_id: sefaz.id,
          ambiente: sefaz.ambiente, mensagem_retorno: motivoRejeicao,
          observacoes, tentativas: 1,
        });
        if (rastroErr) console.error(`falha ao gravar rastro da rejeição: ${rastroErr.message}`);
        return json(422, { erro: "nfe-service recusou a emissão", detalhe: resultado });
      }
    } catch (e) {
      // Timeout / serviço fora: registra pendência para retry
      await admin.from("erp_notas_fiscais").insert({
        loja_id, tipo: tipoDoc, numero, serie: serieDoc,
        status: "pendente_transmissao", valor_total: totalNota,
        data_emissao: new Date().toISOString(),
        venda_id: venda_id ?? null, destinatario_id: null,
        certificado_id: cert.id, configuracao_sefaz_id: sefaz.id,
        ambiente: sefaz.ambiente, mensagem_retorno: `sem resposta do serviço: ${e.message}`,
        observacoes, tentativas: 1,
      });
      return json(504, { erro: "SEFAZ/serviço sem resposta — nota registrada como pendente para retry" });
    } finally {
      clearTimeout(timeout);
    }

    // ---------------- 7. Persistir resultado REAL ----------------
    let xmlPath: string | null = null;
    let danfePath: string | null = null;
    let arquivosPendentes = false;

    if (resultado.autorizada) {
      const pasta = `${loja_id}/${new Date().getFullYear()}`;
      xmlPath = `${pasta}/${resultado.chave}.xml`;
      const { error: xmlUpErr } = await adminPublic.storage.from("fiscal").upload(
        xmlPath,
        Uint8Array.from(atob(resultado.xml_base64), (c) => c.charCodeAt(0)),
        { contentType: "application/xml", upsert: true },
      );
      if (xmlUpErr) {
        console.error(`falha ao subir XML da NF-e ${resultado.chave}: ${xmlUpErr.message}`);
        arquivosPendentes = true;
        xmlPath = null;
      }
      if (resultado.danfe_pdf_base64) {
        danfePath = `${pasta}/${resultado.chave}.pdf`;
        const { error: danfeUpErr } = await adminPublic.storage.from("fiscal").upload(
          danfePath,
          Uint8Array.from(atob(resultado.danfe_pdf_base64), (c) => c.charCodeAt(0)),
          { contentType: "application/pdf", upsert: true },
        );
        if (danfeUpErr) {
          console.error(`falha ao subir DANFE da NF-e ${resultado.chave}: ${danfeUpErr.message}`);
          arquivosPendentes = true;
          danfePath = null;
        }
      }
    }

    const { data: nfe, error: nfeErr } = await admin.from("erp_notas_fiscais").insert({
      loja_id,
      tipo: tipoDoc,
      numero,
      serie: serieDoc,
      chave_acesso: resultado.chave || null,
      protocolo: resultado.protocolo || null,
      status: resultado.autorizada
        ? (arquivosPendentes ? "pendente_arquivo" : "autorizada")
        : "rejeitada",
      cstat: resultado.cstat,
      valor_total: totalNota,
      data_emissao: new Date().toISOString(),
      data_processamento: resultado.data_autorizacao || new Date().toISOString(),
      codigo_retorno: resultado.cstat,
      mensagem_retorno: arquivosPendentes
        ? `${resultado.motivo ?? ""} [XML/DANFE não gravados no storage — reprocessar arquivos]`.trim()
        : resultado.motivo,
      venda_id: venda_id ?? null,
      certificado_id: cert.id,
      configuracao_sefaz_id: sefaz.id,
      ambiente: sefaz.ambiente,
      tipo_emissao: 1,
      observacoes,
      xml_path: xmlPath,
      danfe_path: danfePath,
    }).select().single();
    if (nfeErr) return json(500, { erro: `nota processada mas falhou ao gravar: ${nfeErr.message}`, resultado });

    // Vincular à remessa + baixar estoque da ORIGEM (o destino recebe via "Receber Remessa")
    if (remessa_id && resultado.autorizada) {
      await admin.from("erp_remessas").update({ nfe_remessa_id: nfe.id, status: "em_transito" }).eq("id", remessa_id);

      const { data: remItens } = await admin
        .from("erp_remessa_itens").select("produto_id, quantidade, remessa:erp_remessas(loja_origem_id)")
        .eq("remessa_id", remessa_id);
      for (const item of remItens ?? []) {
        const lojaOrigem = (item as any).remessa?.loja_origem_id;
        if (!lojaOrigem || !item.produto_id) continue;
        const { data: est } = await admin
          .from("erp_estoque").select("id, quantidade")
          .eq("produto_id", item.produto_id).eq("loja_id", lojaOrigem).maybeSingle();
        if (est) {
          await admin.from("erp_estoque")
            .update({ quantidade: Math.max(0, Number(est.quantidade) - Number(item.quantidade)) })
            .eq("id", est.id);
        }
      }
    }

    return json(200, {
      autorizada: resultado.autorizada,
      cstat: resultado.cstat,
      motivo: resultado.motivo,
      chave: resultado.chave,
      protocolo: resultado.protocolo,
      numero,
      nfe_id: nfe.id,
      xml_path: xmlPath,
      danfe_path: danfePath,
      ambiente: sefaz.ambiente,
    });
  } catch (e) {
    return json(500, { erro: `falha interna: ${e.message}` });
  }
});
