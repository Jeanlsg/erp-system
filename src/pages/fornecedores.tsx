import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Plus, Search, Phone, Mail, Loader2 } from "lucide-react";
import { useFornecedores, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function FornecedoresPage() {
  const { data: pessoas = [], isLoading } = useFornecedores();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  // === MELHORIAS IDENTIFICADAS ===
  // TODO: Filtros por categoria (fabricante, distribuidor, importador)
  // TODO: Histórico de compras por fornecedor
  // TODO: Avaliação de fornecedores (rating)
  // TODO: Ordem de compra rápida
  // TODO: Exportar para Excel
  // TODO: Integração com API de CNPJ (consulta automática)
  // TODO: Detalhes expandidos (endereço, contato, condições)

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Fornecedores" />;
  }

  const filtrados = pessoas.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.nome_razao.toLowerCase().includes(s) ||
      p.cpf_cnpj.toLowerCase().includes(s) ||
      (p.email ?? "").toLowerCase().includes(s)
    );
  });

  const toggleAll = () => {
    if (selected.length === filtrados.length) setSelected([]);
    else setSelected(filtrados.map((p) => p.id));
  };

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6" /> Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pessoas.length} fornecedor(es) cadastrado(s)
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.length > 0 && (
          <Badge variant="default">{selected.length} selecionado(s)</Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando fornecedores...
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left p-3 w-10">
                    <Checkbox checked={selected.length === filtrados.length && filtrados.length > 0} onCheckedChange={toggleAll} />
                  </th>
                  <th className="text-left p-3">Fornecedor</th>
                  <th className="text-left p-3">CNPJ</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum fornecedor encontrado
                    </td>
                  </tr>
                ) : (
                  filtrados.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-accent">
                      <td className="p-3">
                        <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{p.nome_razao}</div>
                        {p.nome_fantasia && (
                          <div className="text-xs text-muted-foreground">{p.nome_fantasia}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">{p.cpf_cnpj}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm">
                          {p.email && <Mail className="h-3 w-3 text-muted-foreground" />}
                          <span>{p.email ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {p.telefone && <Phone className="h-3 w-3" />}
                          <span>{p.telefone ?? p.celular ?? "—"}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{p.tipo.toUpperCase()}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={p.ativo ? "default" : "outline"}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}