// ============================================================
// Central de Tutoriais — uma página por tela do sistema.
//
// O conteúdo NÃO é escrito à mão: vem de src/content/tutoriais.json,
// gerado a partir da auditoria funcional, onde cada botão foi clicado e
// o que ele faz foi observado. Por isso a descrição bate com o sistema
// real — e não com o que alguém lembrava que ele fazia.
//
// Cada pessoa vê só as telas do próprio cargo: mostrar tutorial de
// página que o usuário não acessa é ruído.
// ============================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Search, ExternalLink, AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/store/auth-store";
import tutoriaisJson from "@/content/tutoriais.json";

interface Controle { nome: string; tipo: string; faz: string; cuidado: boolean }
interface Imagem { arquivo: string; legenda: string }
interface Tutorial {
  url: string; titulo: string; sessao: string; grupo: string | null;
  objetivo: string; apoio: string; perfis: string[];
  campos: string[]; controles: Controle[]; imagens: Imagem[];
}
const TUTORIAIS = tutoriaisJson as Tutorial[];

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TutoriaisPage() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const meus = useMemo(() => {
    const papel = user?.role ?? "admin";
    return TUTORIAIS.filter((t) => t.perfis.includes(papel));
  }, [user?.role]);

  // A busca varre título, objetivo e o nome de cada botão: quem procura
  // "sangria" ou "ticket médio" chega na tela certa sem saber o nome dela.
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q) return meus;
    return meus.filter((t) =>
      semAcento(t.titulo).includes(q) ||
      semAcento(t.objetivo).includes(q) ||
      semAcento(t.sessao).includes(q) ||
      t.controles.some((c) => semAcento(c.nome).includes(q) || semAcento(c.faz).includes(q)) ||
      t.campos.some((c) => semAcento(c).includes(q)),
    );
  }, [meus, busca]);

  const porSessao = useMemo(() => {
    const m = new Map<string, Tutorial[]>();
    for (const t of filtrados) {
      if (!m.has(t.sessao)) m.set(t.sessao, []);
      m.get(t.sessao)!.push(t);
    }
    return [...m.entries()];
  }, [filtrados]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Tutoriais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Como usar cada tela e o que cada botão faz. {meus.length} tutorial(is) para o seu acesso.
        </p>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tela, função ou botão — ex.: sangria, comissão, validade…"
          className="pl-9"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Nenhum tutorial encontrado para “{busca}”. Tente o nome do botão ou da tela.
        </CardContent></Card>
      ) : (
        porSessao.map(([sessao, itens]) => (
          <div key={sessao} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {sessao} · {itens.length}
            </h2>
            <div className="space-y-2">
              {itens.map((t) => {
                const expandido = aberto === t.url;
                return (
                  <Card key={t.url}>
                    <CardContent className="p-0">
                      <button
                        type="button"
                        onClick={() => setAberto(expandido ? null : t.url)}
                        aria-expanded={expandido}
                        className="flex w-full items-start gap-3 p-4 text-left hover:bg-accent/50 transition-colors"
                      >
                        {expandido ? <ChevronDown className="h-4 w-4 mt-1 shrink-0" /> : <ChevronRight className="h-4 w-4 mt-1 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t.titulo}</p>
                          <p className="text-sm text-muted-foreground">{t.objetivo}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {t.controles.length} ação(ões)
                        </Badge>
                      </button>

                      {expandido && (
                        <div className="border-t p-4 space-y-5">
                          {t.apoio && (
                            <p className="text-sm text-muted-foreground italic">{t.apoio}</p>
                          )}

                          {t.imagens.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como a tela se comporta</p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {t.imagens.map((img) => (
                                  <figure key={img.arquivo} className="space-y-1">
                                    <img
                                      src={`/tutorial/${img.arquivo}`}
                                      alt={img.legenda}
                                      loading="lazy"
                                      className="w-full rounded-md border"
                                    />
                                    <figcaption className="text-xs text-muted-foreground">{img.legenda}</figcaption>
                                  </figure>
                                ))}
                              </div>
                            </div>
                          )}

                          {t.controles.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que cada botão faz</p>
                              <div className="rounded-md border divide-y">
                                {t.controles.map((c, i) => (
                                  <div key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
                                    <span className="font-medium min-w-[9rem] shrink-0">{c.nome}</span>
                                    <span className="text-muted-foreground flex-1">{c.faz}</span>
                                    {c.cuidado && (
                                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-amber-600 shrink-0">
                                        <AlertTriangle className="h-3 w-3" /> definitivo
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {t.campos.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos desta tela</p>
                              <p className="text-sm text-muted-foreground">{t.campos.join(" · ")}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button asChild size="sm">
                              <Link to={t.url}>
                                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Ir para a tela
                              </Link>
                            </Button>
                            <span className="text-xs text-muted-foreground self-center">
                              Acesso: {t.perfis.join(", ")}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
