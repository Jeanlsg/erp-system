// ============================================================================
// Edge Function: erp-email-campanha
// Dispara uma campanha de e-mail marketing via Resend.
//
// Body: { campanha_id }
//   - a campanha (erp.erp_email_marketing) precisa estar em rascunho/agendada
//   - destinatários: pessoas ativas, não bloqueadas, com e-mail válido
//
// Envio individual (não batch): a base é pequena e cada envio ganha
// rastreio próprio de erro. Respeita o limite de 2 req/s do Resend com
// pausa entre envios. Totais e status ficam gravados na própria campanha.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
      if (!eu?.ativo || !["admin", "gerente"].includes(eu.role)) {
        return json(403, { erro: "requer admin/gerente" });
      }
    }

    const { campanha_id } = await req.json();
    if (!campanha_id) return json(422, { erro: "campanha_id é obrigatório" });

    const { data: camp } = await admin
      .from("erp_email_marketing").select("*").eq("id", campanha_id).maybeSingle();
    if (!camp) return json(422, { erro: "campanha não encontrada" });
    if (!["rascunho", "agendada", "erro"].includes(camp.status ?? "rascunho")) {
      return json(422, { erro: `campanha com status "${camp.status}" — só rascunho/agendada pode ser enviada` });
    }
    if (!camp.assunto?.trim() || !camp.template?.trim()) {
      return json(422, { erro: "campanha sem assunto ou sem corpo" });
    }

    const { data: integ } = await adminPublic
      .from("integrations").select("config").eq("provider", "resend").maybeSingle();
    if (!integ?.config?.api_key) return json(500, { erro: "integração resend não configurada" });
    const remetente = camp.remetente ?? integ.config.de ?? "noreply@lojaxlife.com.br";

    const { data: pessoas } = await admin
      .from("erp_pessoas")
      .select("id, nome_razao, email")
      .eq("ativo", true)
      .eq("bloqueado", false)
      .not("email", "is", null);
    const destinatarios = (pessoas ?? []).filter((p) => EMAIL_RE.test((p.email ?? "").trim()));
    if (destinatarios.length === 0) {
      return json(422, { erro: "nenhum cliente ativo com e-mail válido" });
    }

    // marca "enviando" antes do loop: reenvio concorrente esbarra no status
    await admin.from("erp_email_marketing")
      .update({ status: "enviando", total_destinatarios: destinatarios.length })
      .eq("id", campanha_id);

    const corpoTexto: string = camp.template;
    const rodape = "\n\n—\nX-Life Suplementos\nVocê recebe este e-mail por ser cliente cadastrado. " +
      "Para não receber mais, responda pedindo a remoção.";
    const corpoHtml =
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;line-height:1.6;color:#111">` +
      escHtml(corpoTexto).replace(/\n/g, "<br>") +
      `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">` +
      `<p style="font-size:12px;color:#777">X-Life Suplementos — você recebe este e-mail por ser cliente cadastrado.<br>` +
      `Para não receber mais, responda pedindo a remoção.</p></div>`;

    let enviados = 0, erros = 0;
    const falhas: string[] = [];
    for (const p of destinatarios) {
      const para = p.email!.trim();
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${integ.config.api_key}`,
          },
          body: JSON.stringify({
            from: remetente,
            to: [para],
            subject: camp.assunto,
            text: corpoTexto + rodape,
            html: corpoHtml,
          }),
        });
        if (resp.ok) enviados++;
        else {
          erros++;
          const d = await resp.json().catch(() => ({}));
          falhas.push(`${para}: HTTP ${resp.status} ${JSON.stringify(d).slice(0, 120)}`);
        }
      } catch (e) {
        erros++;
        falhas.push(`${para}: ${String(e).slice(0, 120)}`);
      }
      await dormir(600); // Resend: 2 req/s
    }

    await admin.from("erp_email_marketing").update({
      status: erros === destinatarios.length ? "erro" : "enviada",
      data_enviada: new Date().toISOString(),
      total_enviados: enviados,
      total_erros: erros,
    }).eq("id", campanha_id);

    return json(200, {
      ok: erros < destinatarios.length,
      total_destinatarios: destinatarios.length,
      enviados, erros,
      falhas: falhas.slice(0, 10),
    });
  } catch (e) {
    return json(500, { erro: String(e) });
  }
});
