import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Plus, Loader2, Trash2, Wrench, AlertTriangle } from "lucide-react";
import { useVeiculos, useCreateVeiculo, useUpdateVeiculo, useDeleteVeiculo, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { date } from "@/lib/format";

export function VeiculosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: veiculos = [], isLoading } = useVeiculos(lojaId ?? undefined);
  const create = useCreateVeiculo();
  const update = useUpdateVeiculo();
  const del = useDeleteVeiculo();
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({
    placa: "",
    marca: "",
    modelo: "",
    ano_fabricacao: "",
    ano_modelo: "",
    cor: "",
    km_atual: "0",
    tipo_combustivel: "flex",
    capacidade_carga: "",
    status: "ativo",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Veículos / Frota" />;

  const ativos = veiculos.filter((v) => v.status === "ativo").length;
  const manutencao = veiculos.filter((v) => v.status === "manutencao").length;

  const ipvaVencendo = veiculos.filter((v) => {
    if (!v.ipva_vencimento) return false;
    const dias = Math.floor((new Date(v.ipva_vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return dias >= 0 && dias <= 30;
  });

  const handleCriar = async () => {
    if (!form.placa) return;
    await create.mutateAsync({
      loja_id: lojaId ?? null,
      placa: form.placa.toUpperCase(),
      marca: form.marca || null,
      modelo: form.modelo || null,
      ano_fabricacao: form.ano_fabricacao ? parseInt(form.ano_fabricacao) : null,
      ano_modelo: form.ano_modelo ? parseInt(form.ano_modelo) : null,
      cor: form.cor || null,
      km_atual: parseInt(form.km_atual) || 0,
      tipo_combustivel: form.tipo_combustivel,
      capacidade_carga: form.capacidade_carga ? parseFloat(form.capacidade_carga) : null,
      status: form.status,
    });
    setModalAberto(false);
    setForm({ placa: "", marca: "", modelo: "", ano_fabricacao: "", ano_modelo: "", cor: "", km_atual: "0", tipo_combustivel: "flex", capacidade_carga: "", status: "ativo" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Car className="h-6 w-6" /> Consulta de Veículos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{veiculos.length} veículo(s) na frota</p>
        </div>
        <Button onClick={() => setModalAberto(true)}><Plus className="mr-2 h-4 w-4" /> Novo Veículo</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Ativos</p><p className="text-2xl font-semibold text-green-600">{ativos}</p></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Wrench className="h-6 w-6 text-orange-600" /><div><p className="text-xs uppercase text-muted-foreground">Em Manutenção</p><p className="text-2xl font-semibold text-orange-600">{manutencao}</p></div></CardContent></Card>
        <Card className={ipvaVencendo.length > 0 ? "border-orange-500 bg-orange-50" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            <div>
              <p className="text-xs uppercase text-orange-600">IPVA Vencendo</p>
              <p className="text-2xl font-semibold text-orange-600">{ipvaVencendo.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Frota</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : veiculos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum veículo cadastrado</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Placa</th>
                  <th className="text-left p-3">Marca/Modelo</th>
                  <th className="text-center p-3">Ano</th>
                  <th className="text-right p-3">KM</th>
                  <th className="text-center p-3">Combustível</th>
                  <th className="text-center p-3">IPVA</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono font-semibold">{v.placa}</td>
                    <td className="p-3">{v.marca ?? "—"} {v.modelo ?? ""}</td>
                    <td className="p-3 text-center text-xs">{v.ano_fabricacao ?? "—"}/{v.ano_modelo ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{v.km_atual.toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{v.tipo_combustivel ?? "—"}</Badge></td>
                    <td className="p-3 text-center text-xs">{v.ipva_vencimento ? date(v.ipva_vencimento) : "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={v.status === "ativo" ? "default" : v.status === "manutencao" ? "destructive" : "outline"}>
                        {v.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => update.mutate({ id: v.id, status: v.status === "ativo" ? "manutencao" : "ativo" })} title="Alternar Status">
                          <Wrench className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) del.mutate(v.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Veículo</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Placa *</Label><Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} placeholder="ABC-1234" /></div>
              <div><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>Ano Fab.</Label><Input type="number" value={form.ano_fabricacao} onChange={(e) => setForm({ ...form, ano_fabricacao: e.target.value })} /></div>
              <div><Label>Ano Mod.</Label><Input type="number" value={form.ano_modelo} onChange={(e) => setForm({ ...form, ano_modelo: e.target.value })} /></div>
              <div><Label>Cor</Label><Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
              <div><Label>KM Atual</Label><Input type="number" value={form.km_atual} onChange={(e) => setForm({ ...form, km_atual: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Combustível</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.tipo_combustivel} onChange={(e) => setForm({ ...form, tipo_combustivel: e.target.value })}>
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="etanol">Etanol</option>
                  <option value="diesel">Diesel</option>
                  <option value="gnv">GNV</option>
                  <option value="eletrico">Elétrico</option>
                </select>
              </div>
              <div><Label>Capacidade (ton)</Label><Input type="number" step="0.01" value={form.capacidade_carga} onChange={(e) => setForm({ ...form, capacidade_carga: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ativo">Ativo</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriar} disabled={create.isPending || !form.placa}>{create.isPending ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}