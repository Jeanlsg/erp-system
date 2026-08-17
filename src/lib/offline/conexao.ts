// ============================================================
// Estado de conexão do PDV
//
// navigator.onLine mente: ele responde "true" para qualquer placa de rede
// ativa. Wi-Fi conectado com o roteador sem link, portal cativo de hotel e
// Supabase fora do ar são todos "online" para o navegador — e são
// exatamente os casos em que o caixa trava.
//
// Então o estado real é: o navegador acha que há rede E a última conversa
// com o servidor funcionou. Quem descobre a queda de verdade é a própria
// venda que falhou, por isso `marcarFalhaDeRede` é exportado.
// ============================================================

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type Ouvinte = (online: boolean) => void;

let onlineAtual = typeof navigator === "undefined" ? true : navigator.onLine;
const ouvintes = new Set<Ouvinte>();

function definir(v: boolean) {
  if (v === onlineAtual) return;
  onlineAtual = v;
  ouvintes.forEach((f) => f(v));
}

export const estaOnline = () => onlineAtual;

/** Chamado por quem tentou falar com o servidor e levou erro de rede. */
export function marcarFalhaDeRede() {
  definir(false);
}

export function marcarSucessoDeRede() {
  definir(true);
}

/** Erro de rede e erro de regra de negócio pedem tratamentos opostos. */
export function ehErroDeRede(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch derrubado
  const msg = String((err as any)?.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("aborted")
  );
}

/** Bate no servidor de verdade — é a única resposta confiável. */
export async function sondar(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    definir(false);
    return false;
  }
  if (!isSupabaseConfigured()) return false;
  try {
    // head+limit(0) não traz linha nenhuma: é o menor ida-e-volta possível.
    const { error } = await supabase
      .schema("erp")
      .from("erp_lojas")
      .select("id", { head: true, count: "exact" })
      .limit(0);
    const ok = !error || !ehErroDeRede(error);
    definir(ok);
    return ok;
  } catch (e) {
    definir(!ehErroDeRede(e));
    return estaOnline();
  }
}

export function useConexao() {
  const [online, setOnline] = useState(onlineAtual);

  useEffect(() => {
    const ouvinte: Ouvinte = setOnline;
    ouvintes.add(ouvinte);

    const aoVoltar = () => { void sondar(); };
    const aoCair = () => definir(false);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);

    // Enquanto offline, sonda com frequência para o caixa não ficar preso
    // depois que a rede volta sem o navegador perceber.
    const timer = window.setInterval(() => {
      if (!onlineAtual) void sondar();
    }, 15_000);

    void sondar();
    return () => {
      ouvintes.delete(ouvinte);
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
      window.clearInterval(timer);
    };
  }, []);

  return online;
}
