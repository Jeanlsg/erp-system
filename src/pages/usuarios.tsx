import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Loader2, Shield } from "lucide-react";
import { isSupabaseConfigured, useLojas } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function UsuariosPage() {
  const { data: lojas = [] } = useLojas();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      const { data, error } = await supabase
        .from("erp_usuarios")
        .select("id, email, nome, role, ativo, loja_default_id, tentativas_login, bloqueado, ultimo_login, created_at")
        .order("created_at", { ascending: false });
      if (!error) setUsuarios(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Gestão de Usuários" />;

  const lojaMap = Object.fromEntries(lojas.map((l) => [l.id, l.apelido]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" /> Gestão de Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{usuarios.length} usuário(s) cadastrado(s)</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Usuários do Sistema</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-center p-3">Papel</th>
                  <th className="text-left p-3">Loja Padrão</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Tentativas</th>
                  <th className="text-left p-3">Último Login</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        {u.nome}
                      </div>
                    </td>
                    <td className="p-3 text-xs">{u.email}</td>
                    <td className="p-3 text-center">
                      <Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge>
                    </td>
                    <td className="p-3 text-sm">{u.loja_default_id ? lojaMap[u.loja_default_id] ?? "—" : "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={u.bloqueado ? "destructive" : u.ativo ? "default" : "outline"}>
                        {u.bloqueado ? "Bloqueado" : u.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="p-3 text-center text-xs">{u.tentativas_login ?? 0}</td>
                    <td className="p-3 text-xs">{u.ultimo_login ? new Date(u.ultimo_login).toLocaleString("pt-BR") : "Nunca"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}