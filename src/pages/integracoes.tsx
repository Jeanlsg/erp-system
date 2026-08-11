import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, MessageSquare, CreditCard, Save, PlugZap } from "lucide-react";
import { useConfiguracoesGerais, useUpsertConfiguracao, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

// ============================================================================
// Página genérica de configuração de integração.
// As credenciais ficam em erp_configuracoes_sistema (chave = integracao_<slug>).
// Enquanto o contrato/credencial não é ativado, o status é "não conectado".
// ============================================================================

type Campo = { chave: string; label: string; placeholder?: string; tipo?: "text" | "password" };

function IntegracaoConfigPage({ slug, titulo, descricao, icon: Icon, campos, observacao }: {
  slug: string; titulo: string; descricao: string; icon: any; campos: Campo[]; observacao: string;
}) {
  const { data: configs = [], isLoading } = useConfiguracoesGerais();
  const upsert = useUpsertConfiguracao();
  const chave = `integracao_${slug}`;
  const [form, setForm] = useState<Record<string, string>>({});
  const [ativa, setAtiva] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const registro = (configs as any[]).find((c) => c.chave === chave);

  useEffect(() => {
    if (carregado || isLoading) return;
    try {
      const salvo = registro?.valor ? JSON.parse(registro.valor) : null;
      if (salvo) {
        setForm(salvo.campos ?? {});
        setAtiva(salvo.ativa ?? false);
      }
    } catch { /* valor inválido — começa vazio */ }
    setCarregado(true);
  }, [carregado, isLoading, registro]);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title={titulo} />;

  const preenchida = campos.some((c) => (form[c.chave] ?? "").trim() !== "");
  const conectada = ativa && preenchida;

  const salvar = async () => {
    await upsert.mutateAsync({
      chave,
      valor: JSON.stringify({ ativa, campos: form }),
      categoria: "integracoes",
      descricao: `Integração: ${titulo}`,
    } as any);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Icon className="h-6 w-6" /> {titulo}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
        </div>
        <Badge variant={conectada ? "default" : "outline"} className="gap-1">
          <PlugZap className="h-3 w-3" /> {conectada ? "Configurada" : "Não conectada"}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Credenciais e Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {campos.map((c) => (
            <div key={c.chave}>
              <Label>{c.label}</Label>
              <Input
                type={c.tipo ?? "text"}
                placeholder={c.placeholder}
                value={form[c.chave] ?? ""}
                onChange={(e) => setForm({ ...form, [c.chave]: e.target.value })}
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Integração ativa
          </label>
          <p className="text-xs text-muted-foreground">{observacao}</p>
          <Button onClick={salvar} disabled={upsert.isPending}>
            <Save className="mr-2 h-4 w-4" /> {upsert.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
          {upsert.isSuccess && <p className="text-xs text-green-600">Configuração salva.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export function IFoodPage() {
  return (
    <IntegracaoConfigPage
      slug="ifood"
      titulo="Pedidos iFood"
      descricao="Recebimento automático de pedidos do iFood"
      icon={ShoppingCart}
      campos={[
        { chave: "merchant_id", label: "Merchant ID", placeholder: "UUID da loja no iFood" },
        { chave: "client_id", label: "Client ID" },
        { chave: "client_secret", label: "Client Secret", tipo: "password" },
      ]}
      observacao="As credenciais são geradas no Portal do Parceiro iFood (developer.ifood.com.br). Após salvar e ativar, os pedidos passam a aparecer em Pedidos Delivery."
    />
  );
}

export function ExAppPedidosPage() {
  return (
    <IntegracaoConfigPage
      slug="exapp_whatsapp"
      titulo="ExApp Pedidos (WhatsApp)"
      descricao="Pedidos recebidos pelo WhatsApp via instância UAZAPI"
      icon={MessageSquare}
      campos={[
        { chave: "instancia_url", label: "URL da instância", placeholder: "https://lojaxlife.uazapi.com" },
        { chave: "instancia_token", label: "Token da instância", tipo: "password" },
        { chave: "numero", label: "Número do WhatsApp", placeholder: "5591999999999" },
      ]}
      observacao="Use a instância UAZAPI já existente da loja. Com a integração ativa, mensagens de pedido geram registros em Pedidos Delivery."
    />
  );
}

export function TEFPage() {
  return (
    <IntegracaoConfigPage
      slug="tef_sitef"
      titulo="TEF / SITEF"
      descricao="Pagamento integrado com maquininha via SITEF"
      icon={CreditCard}
      campos={[
        { chave: "endereco_sitef", label: "Endereço do servidor SITEF", placeholder: "127.0.0.1" },
        { chave: "codigo_loja", label: "Código da loja", placeholder: "00000000" },
        { chave: "numero_terminal", label: "Número do terminal", placeholder: "SE000001" },
      ]}
      observacao="Requer o CliSiTef instalado no computador do caixa e contrato com a Software Express. Com a integração ativa, o PDV oferece a opção TEF nas formas de pagamento com cartão."
    />
  );
}
