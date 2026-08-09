import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cog } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function ConfigSistemaPage() {
  const { data: configs = [], refetch } = useQuery<any[]>({
    queryKey: ["erp_configuracoes_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase.from("erp_configuracoes_sistema").select("*").order("chave");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("erp_configuracoes_sistema").upsert(item);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Configurações do Sistema" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Cog className="h-6 w-6" /> Configurações do Sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Parâmetros técnicos</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Configurações ({configs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {configs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma configuração cadastrada. Adicione via SQL:</p>
          ) : configs.map((c: any) => (
            <div key={c.id} className="flex items-end gap-2 border-b pb-3">
              <div className="flex-1">
                <Label className="text-xs">{c.chave} {c.descricao && <span className="text-muted-foreground">— {c.descricao}</span>}</Label>
                <Input
                  defaultValue={c.valor ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== c.valor) {
                      upsert.mutate({ id: c.id, chave: c.chave, valor: e.target.value });
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}