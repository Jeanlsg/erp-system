// ============================================================
// "Precisa de entrega?" na tela de pagamento do PDV.
//
// Como no sistema anterior da loja: com "Sim" aparecem entrega futura,
// transportadora, região (que traz a taxa) e o endereço. A taxa entra no
// total a pagar — a conta está em src/lib/entrega-venda.ts.
//
// O endereço começa com o padrão do cliente escolhido. ⚠️ Trocar de cliente
// troca o endereço: o do cliente anterior nunca fica na tela (foi o defeito
// do pedido de balcão que regravava o endereço de A no cadastro de B).
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Check, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useEnderecosPessoa, useRegioesEntrega, useTransportadoras } from "@/lib/supabase-queries";
import {
  ENDERECO_VAZIO, aplicarViaCep, avisoValorMinimo, enderecoDoCadastro, entregaVazia,
  sugerirRegiao, taxaDaRegiao, type EnderecoEntrega, type EntregaVenda, type RegiaoEntrega,
} from "@/lib/entrega-venda";

const PROPRIA = "__propria__";
const SEM_REGIAO = "__sem__";

interface Props {
  entrega: EntregaVenda | null;
  aoMudar: (e: EntregaVenda | null) => void;
  clienteId: string | null;
  /** Pagamento já lançado: o total não pode mudar (taxa, região e Sim/Não travam). */
  travado: boolean;
  /** Valor da mercadoria, para o aviso de pedido mínimo da região. */
  valorMercadoria: number;
  online: boolean;
}

export function EntregaVendaPdv({ entrega, aoMudar, clienteId, travado, valorMercadoria, online }: Props) {
  const { data: regioes = [] } = useRegioesEntrega();
  const { data: transportadoras = [] } = useTransportadoras();
  const { data: enderecos = [] } = useEnderecosPessoa(entrega && clienteId ? clienteId : undefined);
  const [buscandoCep, setBuscandoCep] = useState(false);
  // A região veio da sugestão (CEP/bairro) ou o operador escolheu? Escolha
  // manual não é sobrescrita quando o endereço muda.
  const regiaoManual = useRef(false);

  const mudar = (parcial: Partial<EntregaVenda>) => entrega && aoMudar({ ...entrega, ...parcial });

  const mudarEndereco = (campo: keyof EnderecoEntrega, valor: string) => {
    if (!entrega) return;
    // endereço salvo editado continua ligado a ele: salvar atualiza, não duplica
    aoMudar({ ...entrega, endereco: { ...entrega.endereco, [campo]: valor }, salvar_endereco: true });
  };

  const usarEnderecoSalvo = (e: any) => {
    if (!entrega) return;
    aoMudar({ ...entrega, endereco: enderecoDoCadastro(e), endereco_id: e.id, salvar_endereco: !e.codigo_municipio_ibge });
  };

  // ---- cliente trocado: o endereço passa a ser o dele ----
  const clienteAnterior = useRef<string | null>(clienteId);
  useEffect(() => {
    if (!entrega) { clienteAnterior.current = clienteId; return; }
    if (clienteAnterior.current !== clienteId) {
      clienteAnterior.current = clienteId;
      aoMudar({ ...entrega, endereco: { ...ENDERECO_VAZIO }, endereco_id: null, salvar_endereco: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só à troca de cliente
  }, [clienteId]);

  // ---- endereço padrão do cliente entra sozinho, se o formulário está vazio ----
  useEffect(() => {
    if (!entrega || entrega.endereco_id || entrega.endereco.logradouro) return;
    const padrao = (enderecos as any[]).find((e) => e.padrao) ?? (enderecos as any[])[0];
    if (padrao) usarEnderecoSalvo(padrao);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando os endereços chegam
  }, [enderecos, !!entrega]);

  // ---- região sugerida pelo CEP/bairro ----
  const cep = entrega?.endereco.cep ?? "";
  const bairro = entrega?.endereco.bairro ?? "";
  useEffect(() => {
    if (!entrega || travado || regiaoManual.current) return;
    const r = sugerirRegiao(regioes as RegiaoEntrega[], { cep, bairro });
    if (r && r.id !== entrega.regiao_id) mudar({ regiao_id: r.id, taxa: taxaDaRegiao(r) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage ao endereço e à lista de regiões
  }, [cep, bairro, regioes]);

  const regiao = useMemo(
    () => (regioes as RegiaoEntrega[]).find((r) => r.id === entrega?.regiao_id) ?? null,
    [regioes, entrega?.regiao_id],
  );
  const aviso = entrega ? avisoValorMinimo(regiao, valorMercadoria) : null;

  const buscarCep = async () => {
    if (!entrega) return;
    const digitos = entrega.endereco.cep.replace(/\D/g, "");
    if (digitos.length !== 8 || !online) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`).then((x) => x.json());
      aoMudar({ ...entrega, endereco: aplicarViaCep(entrega.endereco, r), salvar_endereco: true });
    } catch {
      // sem a busca, o endereço é digitado à mão — não trava a venda
    } finally {
      setBuscandoCep(false);
    }
  };

  const ligar = (sim: boolean) => {
    regiaoManual.current = false;
    aoMudar(sim ? entregaVazia() : null);
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Bike className="h-4 w-4" /> Precisa de entrega?
        </span>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="pdv-entrega" checked={!entrega} disabled={travado} onChange={() => ligar(false)} /> Não
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="pdv-entrega" checked={!!entrega} disabled={travado} onChange={() => ligar(true)} /> Sim
        </label>
        {entrega && (
          <>
            <span className="text-sm text-muted-foreground">Entrega futura?</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="pdv-entrega-futura" checked={!entrega.entrega_futura}
                onChange={() => mudar({ entrega_futura: false, previsao: "" })} /> Não
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="pdv-entrega-futura" checked={entrega.entrega_futura}
                onChange={() => mudar({ entrega_futura: true })} /> Sim
            </label>
          </>
        )}
      </div>

      {travado && (
        <p className="text-[11px] text-muted-foreground">
          A entrega trava depois do primeiro pagamento lançado — a taxa muda o total. Remova os pagamentos para alterar.
        </p>
      )}

      {entrega && (
        <>
          {!clienteId && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/20">
              Escolha ou cadastre o cliente (F2, ou "cliente pelo celular") antes de confirmar — o
              entregador precisa do nome e do telefone, e o pedido entra no Ciclo de pedidos ligado a ele.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Transportadora</Label>
              <Select value={entrega.transportadora_id ?? PROPRIA}
                onValueChange={(v) => mudar({ transportadora_id: v === PROPRIA ? null : v })}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROPRIA}>Entrega da loja</SelectItem>
                  {(transportadoras as any[]).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome ?? "Transportadora"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Região de entrega</Label>
              <Select value={entrega.regiao_id ?? SEM_REGIAO} disabled={travado}
                onValueChange={(v) => {
                  regiaoManual.current = true;
                  const r = (regioes as RegiaoEntrega[]).find((x) => x.id === v) ?? null;
                  mudar({ regiao_id: r?.id ?? null, ...(r ? { taxa: taxaDaRegiao(r) } : {}) });
                }}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_REGIAO}>
                    {regioes.length ? "Selecione uma taxa de entrega" : "Nenhuma região cadastrada"}
                  </SelectItem>
                  {(regioes as RegiaoEntrega[]).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome} — R$ {taxaDaRegiao(r).toFixed(2).replace(".", ",")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Frete (R$)</Label>
              <InputMoeda className="mt-1 h-9" value={entrega.taxa} disabled={travado}
                onChange={(v) => mudar({ taxa: v === "" ? 0 : Math.max(0, v) })} />
            </div>
          </div>
          {aviso && <p className="text-xs text-amber-600">{aviso}</p>}

          {entrega.entrega_futura && (
            <div className="sm:w-1/2">
              <Label className="text-xs">Previsão de entrega</Label>
              <Input type="datetime-local" className="mt-1 h-9" value={entrega.previsao}
                onChange={(e) => mudar({ previsao: e.target.value })} />
            </div>
          )}

          {/* Endereços que o cliente já usou: um clique em vez de ditar a rua */}
          {clienteId && enderecos.length > 0 && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs"><MapPin className="h-3.5 w-3.5" /> Endereços do cliente</Label>
              <div className="flex flex-wrap gap-2">
                {(enderecos as any[]).map((e) => (
                  <button key={e.id} type="button" onClick={() => usarEnderecoSalvo(e)}
                    className={`rounded-md border px-3 py-1.5 text-left text-xs transition ${
                      entrega.endereco_id === e.id ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
                    <span className="font-medium">
                      {entrega.endereco_id === e.id && <Check className="mr-1 inline h-3 w-3" />}
                      {e.apelido || "Endereço"}{e.padrao ? " · padrão" : ""}
                    </span>
                    <span className="block text-muted-foreground">
                      {e.logradouro}, {e.numero}{e.bairro ? ` — ${e.bairro}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">CEP</Label>
              <div className="mt-1 flex gap-1">
                <Input className="h-9" inputMode="numeric" placeholder="00000-000" value={entrega.endereco.cep}
                  onChange={(e) => mudarEndereco("cep", e.target.value)} onBlur={() => void buscarCep()} />
                <Button type="button" variant="outline" size="sm" className="h-9 px-2" title="Buscar CEP"
                  onClick={() => void buscarCep()} disabled={buscandoCep || !online}>
                  {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Endereço *</Label>
              <Input className="mt-1 h-9" value={entrega.endereco.logradouro} onChange={(e) => mudarEndereco("logradouro", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nº *</Label>
              <Input className="mt-1 h-9" value={entrega.endereco.numero} onChange={(e) => mudarEndereco("numero", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Complemento</Label>
              <Input className="mt-1 h-9" placeholder="Apto, bloco" value={entrega.endereco.complemento} onChange={(e) => mudarEndereco("complemento", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Bairro *</Label>
              <Input className="mt-1 h-9" value={entrega.endereco.bairro} onChange={(e) => mudarEndereco("bairro", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Cidade *</Label>
              <Input className="mt-1 h-9" value={entrega.endereco.cidade} onChange={(e) => mudarEndereco("cidade", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">UF *</Label>
              <Input className="mt-1 h-9" maxLength={2} value={entrega.endereco.uf} onChange={(e) => mudarEndereco("uf", e.target.value.toUpperCase())} />
            </div>
            <div className="sm:col-span-4">
              <Label className="text-xs">Ponto de referência</Label>
              <Input className="mt-1 h-9" placeholder="Ex.: portão verde, em frente à praça" value={entrega.endereco.referencia}
                onChange={(e) => mudarEndereco("referencia", e.target.value)} />
            </div>
          </div>

          {clienteId && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="h-3.5 w-3.5" checked={entrega.salvar_endereco}
                onChange={(e) => mudar({ salvar_endereco: e.target.checked })} />
              {entrega.endereco_id
                ? "Atualizar este endereço no cadastro do cliente"
                : "Guardar este endereço no cadastro do cliente"}
            </label>
          )}
        </>
      )}
    </div>
  );
}
