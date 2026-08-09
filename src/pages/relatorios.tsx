import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, ShoppingCart, Users, Package, Wallet, Loader2 } from "lucide-react";
import { useVendas, useContasVencidas, useProdutos, useLojas, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function RelatoriosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [], isLoading } = useVendas({ lojaId: lojaId ?? undefined });
  const { data: contasVencidas = [] } = useContasVencidas(lojaId ?? undefined);
  const { data: produtos = [] } = useProdutos({ lojaId: lojaId ?? undefined });
  const { data: lojas = [] } = useLojas();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Relatórios" />;

  const receita = vendas.filter((v: any) => v.status === "finalizada").reduce((s: number, v: any) => s + Number(v.total), 0);
  const ticketMedio = vendas.length > 0 ? receita / vendas.length : 0;
  const totalVencido = contasVencidas.reduce((s: number, c: any) => s + Number(c.valor), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Relatórios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral de KPIs do sistema</p>
      </div>

      {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Receita Total</p>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-semibold mt-2 text-green-600">{brl(receita)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Vendas</p>
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-semibold mt-2">{vendas.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Ticket Médio</p>
                <Wallet className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-2xl font-semibold mt-2">{brl(ticketMedio)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <p className="text-xs uppercase text-red-600">Contas Vencidas</p>
              <p className="text-2xl font-semibold text-red-600 mt-2">{brl(totalVencido)}</p>
              <p className="text-xs text-red-600">{contasVencidas.length} conta(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Produtos</p>
                <Package className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold mt-2">{produtos.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">Lojas Ativas</p>
                <Users className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold mt-2">{lojas.filter((l) => l.ativo).length}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}