import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { permissaoDaRota, ROTAS_APELIDO } from "./app-sidebar";

/** Rotas declaradas no App.tsx, agrupadas pelo componente que abrem. */
function rotasPorComponente() {
  const app = readFileSync("src/App.tsx", "utf8");
  const achadas = [...app.matchAll(/<Route path="([^"]+)" element=\{<(\w+)/g)]
    .map(([, p, comp]) => ({ url: p.startsWith("/") ? p : "/" + p, comp }))
    // Navigate é redirecionamento, não tela; :param não é endereço fixo
    .filter((r) => r.comp !== "Navigate" && !r.url.includes(":"));
  const mapa = new Map<string, string[]>();
  for (const r of achadas) mapa.set(r.comp, [...(mapa.get(r.comp) ?? []), r.url]);
  return mapa;
}

describe("apelidos de rota", () => {
  it("nenhuma tela protegida abre livre por outro endereço", () => {
    // Este é o teste que importa: o sistema tem apelidos por compatibilidade
    // com os endereços do Excellent, e cada um deles é uma porta. Se uma
    // porta ficar sem fechadura, a tela abre para qualquer usuário logado.
    const furos: string[] = [];
    for (const [comp, urls] of rotasPorComponente()) {
      if (urls.length < 2) continue;
      const perms = urls.map((u) => ({ url: u, perm: permissaoDaRota(u) }));
      const protegida = perms.find((p) => p.perm);
      if (!protegida) continue;                       // tela aberta de propósito
      const livres = perms.filter((p) => !p.perm);
      if (livres.length) {
        furos.push(`${comp} exige ${protegida.perm} em ${protegida.url}, mas abre livre em ${livres.map((l) => l.url).join(", ")}`);
      }
    }
    expect(furos).toEqual([]);
  });

  it("todo apelido aponta para uma rota que existe", () => {
    const todas = new Set([...rotasPorComponente().values()].flat());
    const orfaos = Object.entries(ROTAS_APELIDO)
      // /relatorios/financeiro → /financeiro/relatorio são prefixos de rota
      // com parâmetro, que ficam fora da varredura acima
      .filter(([, destino]) => !todas.has(destino) && !destino.includes("relatorio"))
      .map(([a, d]) => `${a} → ${d}`);
    expect(orfaos).toEqual([]);
  });

  it("os endereços do print do usuário resolvem para a mesma permissão", () => {
    expect(permissaoDaRota("/funcionarios")).toBe(permissaoDaRota("/gestao/funcionarios"));
    expect(permissaoDaRota("/gestao/administrar-usuarios")).toBe("usuario.ver");
    expect(permissaoDaRota("/produtos")).toBe("produto.ver");
    expect(permissaoDaRota("/gestao/relatorios-financeiros")).toBe("financeiro.ver");
  });
});
