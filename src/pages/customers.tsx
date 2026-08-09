import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClientes, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function CustomersPage() {
  const { data: clientes = [], isLoading } = useClientes();
  const [search, setSearch] = useState("");

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Clientes" />;
  }

  const filtrados = clientes.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.nome_razao.toLowerCase().includes(s) ||
      c.cpf_cnpj.toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientes.length} cliente(s) cadastrado(s)
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF/CNPJ ou email..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando clientes...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs uppercase">{c.tipo}</TableCell>
                      <TableCell className="font-medium">{c.nome_razao}</TableCell>
                      <TableCell className="font-mono text-xs">{c.cpf_cnpj}</TableCell>
                      <TableCell>{c.email ?? "—"}</TableCell>
                      <TableCell>{c.telefone ?? c.celular ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}