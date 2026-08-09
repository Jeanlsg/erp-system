import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Loader2 } from "lucide-react";
import { useKits, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl } from "@/lib/format";

export function KitsPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: kits = [], isLoading } = useKits(lojaId ?? undefined);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Kits" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Package className="h-6 w-6" /> Kits
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{kits.length} kit(s) cadastrado(s)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <div className="col-span-full text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> :
          kits.length === 0 ? <p className="col-span-full text-center text-muted-foreground p-8">Nenhum kit cadastrado</p> :
          kits.map((k: any) => (
            <Card key={k.id}>
              <CardHeader>
                <CardTitle className="text-base">{k.nome}</CardTitle>
                {k.descricao && <p className="text-xs text-muted-foreground">{k.descricao}</p>}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{(k.itens ?? []).length} produto(s)</p>
                <p className="text-2xl font-semibold mt-2 text-green-600">{brl(k.preco_venda)}</p>
              </CardContent>
            </Card>
          ))
        }
      </div>
    </div>
  );
}