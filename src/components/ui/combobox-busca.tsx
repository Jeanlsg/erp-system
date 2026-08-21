// ============================================================
// Combobox com busca — para escolher cliente/fornecedor/venda em
// listas grandes, onde rolar um dropdown é inviável.
//
// Sem dependência nova: input + lista filtrada, busca sem acento,
// teclado (↑ ↓ Enter Esc) e clique fora fecha. Mostra até 50
// resultados e diz quantos ficaram de fora — truncar em silêncio é
// como cliente "some" do sistema.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

export interface ItemBusca {
  id: string;
  rotulo: string;
  detalhe?: string;   // linha menor: CPF, telefone, valor…
}

interface Props {
  itens: ItemBusca[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Rótulo da opção vazia (ex.: "Consumidor Final"). Ausente = seleção obrigatória. */
  vazio?: string;
  disabled?: boolean;
  className?: string;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ComboboxBusca({ itens, value, onChange, placeholder, vazio, disabled, className }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const selecionado = itens.find((i) => i.id === value) ?? null;

  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q) return itens;
    return itens.filter((i) =>
      semAcento(i.rotulo).includes(q) || (i.detalhe && semAcento(i.detalhe).includes(q)),
    );
  }, [itens, busca]);
  const visiveis = filtrados.slice(0, 50);

  // clique fora fecha
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  // item em foco sempre visível
  useEffect(() => {
    listaRef.current?.querySelector(`[data-idx="${foco}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [foco]);

  const escolher = (id: string) => {
    onChange(id);
    setAberto(false);
    setBusca("");
  };

  const teclado = (e: React.KeyboardEvent) => {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter")) {
      setAberto(true); e.preventDefault(); return;
    }
    if (!aberto) return;
    if (e.key === "ArrowDown") { setFoco((f) => Math.min(f + 1, visiveis.length - 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setFoco((f) => Math.max(f - 1, 0)); e.preventDefault(); }
    else if (e.key === "Enter") { if (visiveis[foco]) escolher(visiveis[foco].id); e.preventDefault(); }
    else if (e.key === "Escape") { setAberto(false); setBusca(""); }
  };

  return (
    <div ref={raiz} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <input
          ref={inputRef}
          disabled={disabled}
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 pr-14 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          placeholder={selecionado ? undefined : (placeholder ?? (vazio ? vazio : "Buscar…"))}
          value={aberto ? busca : (selecionado?.rotulo ?? "")}
          onChange={(e) => { setBusca(e.target.value); setFoco(0); if (!aberto) setAberto(true); }}
          onFocus={() => { setAberto(true); setBusca(""); setFoco(0); }}
          onKeyDown={teclado}
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {selecionado && vazio !== undefined && !disabled && (
            <button type="button" tabIndex={-1} title="Limpar"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => { escolher(""); inputRef.current?.focus(); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" tabIndex={-1}
            className="rounded p-1 text-muted-foreground"
            onClick={() => { setAberto((a) => !a); if (!aberto) inputRef.current?.focus(); }}>
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {aberto && (
        <div ref={listaRef}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {vazio !== undefined && (
            <button type="button" data-idx={-1}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
              onClick={() => escolher("")}>
              {value === "" && <Check className="h-3.5 w-3.5" />}{vazio}
            </button>
          )}
          {visiveis.length === 0 && (
            <p className="px-2.5 py-3 text-center text-sm text-muted-foreground">
              Nada encontrado para “{busca}”.
            </p>
          )}
          {visiveis.map((i, idx) => (
            <button type="button" key={i.id} data-idx={idx}
              className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-accent ${
                idx === foco ? "bg-accent" : ""}`}
              onMouseEnter={() => setFoco(idx)}
              onClick={() => escolher(i.id)}>
              <span className="mt-0.5 w-3.5 shrink-0">
                {i.id === value && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{i.rotulo}</span>
                {i.detalhe && (
                  <span className="block truncate text-xs text-muted-foreground">{i.detalhe}</span>
                )}
              </span>
            </button>
          ))}
          {filtrados.length > 50 && (
            <p className="border-t px-2.5 py-1.5 text-xs text-muted-foreground">
              e mais {filtrados.length - 50} — refine a busca.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
