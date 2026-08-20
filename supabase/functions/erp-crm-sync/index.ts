// ============================================================================
// Edge Function: erp-crm-sync
// Processa a fila erp_crm_sync: leva vendas e orçamentos do ERP ao CRM pela
// API pública de leads, a mesma porta que qualquer sistema externo usaria.
//
// O CRM é multi-tenant e roda em outras VPSs — ele não pode conhecer o ERP.
// Toda a especificidade X-Life mora AQUI: mapa loja→chave de workspace,
// nomes dos campos, cálculo do término estimado. O CRM recebe um lead com
// campos, como receberia de um site ou de um Kanban externo.
//
// Chamada pelo cron erp_crm_sync (5 min) com service_role; aceita também um
// POST manual autenticado de admin para reprocessar.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Telefone do jeito que o CRM identifica o lead (só dígitos; DDI 55 na frente). */
function telefoneLead(p: string | null | undefined): string | null {
  const d = String(p ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;         // sem DDD não é um telefone discável
  return d.length <= 11 ? `55${d}` : d;   // 10/11 dígitos = nacional sem DDI
}

const dataISO = (v: unknown): string => String(v ?? "").slice(0, 10);

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
    if (jwt !== serviceKey) {
      const { data: u } = await adminPublic.auth.getUser(jwt);
      if (!u?.user) return json(401, { erro: "não autenticado" });
      const { data: eu } = await admin
        .from("erp_usuarios").select("role, ativo").eq("id", u.user.id).maybeSingle();
      if (!eu?.ativo || eu.role !== "admin") return json(403, { erro: "requer admin" });
    }

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "crm_leads").maybeSingle();
    if (!integ?.config?.url || !integ?.config?.keys) {
      return json(500, { erro: "integração crm_leads não configurada (public.integrations)" });
    }
    const cfg = integ.config as {
      url: string; keys: Record<string, string>;
      etapa_venda?: string; campos: Record<string, string>;
    };

    const { data: fila } = await admin
      .from("erp_crm_sync").select("*")
      .eq("status", "pendente").order("created_at").limit(20);

    // No CRM o telefone identifica o lead GLOBALMENTE (único entre
    // workspaces). Um cliente que comprou nas duas lojas tem lead em UMA
    // delas — e o histórico de compra deve ir para onde o relacionamento
    // vive. Por isso a chave é escolhida assim: primeiro o workspace onde o
    // lead JÁ existe; se não existe em nenhum, o da loja da venda.
    async function chaveParaLead(tel: string, lojaId: string): Promise<string> {
      const daLoja = cfg.keys[lojaId];
      const ordem = [daLoja, ...Object.values(cfg.keys).filter((k) => k !== daLoja)];
      for (const k of ordem) {
        try {
          const r = await fetch(`${cfg.url}?telefone=${encodeURIComponent(tel)}`, {
            headers: { Authorization: `Bearer ${k}` },
          });
          if (r.ok) return k;               // lead existe neste workspace
        } catch { /* rede: cai no default */ }
      }
      return daLoja;
    }

    let processados = 0, ignorados = 0, erros = 0;

    for (const item of fila ?? []) {
      const marcar = (status: string, detalhe?: string) =>
        admin.from("erp_crm_sync").update({
          status, detalhe: detalhe ?? null,
          tentativas: item.tentativas + 1,
          processado_em: new Date().toISOString(),
        }).eq("id", item.id);

      const apiKey = cfg.keys[item.loja_id];
      if (!apiKey) {
        await marcar("ignorado", "loja sem chave de workspace no mapa da integração");
        ignorados++; continue;
      }

      // ---- monta o payload conforme o evento ----
      let corpo: Record<string, unknown> | null = null;
      let motivoIgnorar: string | null = null;

      if (item.evento === "venda") {
        const { data: v } = await admin
          .from("erp_vendas")
          .select("id, total, data_venda, cliente:erp_pessoas(nome_razao, telefone, celular), itens:erp_venda_itens(nome, quantidade, produto:erp_produtos(duracao_dias))")
          .eq("id", item.referencia_id).maybeSingle();
        if (!v) { await marcar("ignorado", "venda não existe mais"); ignorados++; continue; }

        const tel = telefoneLead((v.cliente as any)?.celular ?? (v.cliente as any)?.telefone);
        if (!tel) motivoIgnorar = "cliente sem telefone — lead do CRM é identificado pelo telefone";
        else {
          const dataVenda = dataISO(v.data_venda);
          // Término estimado: o item que dura MAIS define a próxima recompra
          // (o cliente volta quando o último pote acaba).
          const duracoes = (v.itens as any[])
            .map((i) => Number(i.produto?.duracao_dias ?? 0))
            .filter((d) => d > 0);
          const termino = duracoes.length
            ? new Date(new Date(dataVenda + "T12:00:00Z").getTime()
                + Math.max(...duracoes) * 86_400_000).toISOString().slice(0, 10)
            : null;
          const produtos = (v.itens as any[])
            .map((i) => `${Number(i.quantidade)}x ${i.nome}`).join(", ").slice(0, 500);

          corpo = {
            telefone: tel,
            nome: (v.cliente as any)?.nome_razao ?? undefined,
            ...(cfg.etapa_venda ? { etapa: cfg.etapa_venda } : {}),
            campos: {
              [cfg.campos.ultima_compra]: dataVenda,
              [cfg.campos.produtos]: produtos,
              [cfg.campos.valor]: String(v.total),
              // Sem duração cadastrada não há término: apagar o valor antigo é
              // melhor que deixar uma previsão obsoleta disparando recompra.
              [cfg.campos.termino]: termino ?? "",
            },
          };
        }
      } else {
        const { data: o } = await admin
          .from("erp_orcamentos")
          .select("id, total, created_at, cliente:erp_pessoas(nome_razao, telefone, celular)")
          .eq("id", item.referencia_id).maybeSingle();
        if (!o) { await marcar("ignorado", "orçamento não existe mais"); ignorados++; continue; }
        const tel = telefoneLead((o.cliente as any)?.celular ?? (o.cliente as any)?.telefone);
        if (!tel) motivoIgnorar = "cliente sem telefone";
        else {
          corpo = {
            telefone: tel,
            nome: (o.cliente as any)?.nome_razao ?? undefined,
            campos: {
              [cfg.campos.orcamento_em]: dataISO(o.created_at),
              [cfg.campos.orcamento_valor]: String(o.total),
            },
          };
        }
      }

      if (!corpo) { await marcar("ignorado", motivoIgnorar ?? "sem dados"); ignorados++; continue; }

      // ---- envia ao CRM, para o workspace onde o lead vive ----
      try {
        const chave = await chaveParaLead(String(corpo.telefone), item.loja_id);
        const resp = await fetch(cfg.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
          body: JSON.stringify(corpo),
        });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          // 4xx é problema do payload/config — não adianta insistir para sempre
          const final = resp.status < 500 || item.tentativas >= 5;
          await marcar(final ? "erro" : "pendente", `HTTP ${resp.status}: ${JSON.stringify(dados).slice(0, 300)}`);
          erros++; continue;
        }
        if (!dados?.lead) {
          // resposta ok sem lead = nada foi gravado; não pode virar sucesso
          await marcar("erro", `resposta sem lead: ${JSON.stringify(dados).slice(0, 200)}`);
          erros++; continue;
        }
        await marcar("processado", dados?.created ? "lead criado" : "lead atualizado");
        processados++;
      } catch (e) {
        // rede: fica pendente para o próximo ciclo do cron
        await admin.from("erp_crm_sync").update({
          tentativas: item.tentativas + 1,
          detalhe: e instanceof Error ? e.message : "falha de rede",
        }).eq("id", item.id);
        erros++;
      }
    }

    return json(200, { ok: true, processados, ignorados, erros, na_fila: (fila ?? []).length });
  } catch (err) {
    console.error("erp-crm-sync:", err);
    return json(500, { erro: err instanceof Error ? err.message : "erro interno" });
  }
});
