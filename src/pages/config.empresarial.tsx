import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Briefcase, Save } from "lucide-react";
import { useState } from "react";
import { useDadosEmpresariais, useUpsertDadosEmpresariais, isSupabaseConfigured } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function ConfigEmpresarialPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: dados } = useDadosEmpresariais(lojaId ?? undefined);
  const upsert = useUpsertDadosEmpresariais();
  const [form, setForm] = useState<any>(null);

  // Hidrata form quando dados chegam
  if (dados && !form) {
    setForm(dados);
  }
  if (!dados && form === null && lojaId) {
    setForm({ loja_id: lojaId, razao_social: "", cnpj: "" });
  }

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Configurações Empresariais" />;

  const handleSalvar = async () => {
    if (!form || !form.loja_id) return;
    await upsert.mutateAsync(form);
    alert("Dados salvos!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="h-6 w-6" /> Configurações Empresariais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Dados cadastrais da empresa</p>
      </div>

      {form && (
        <Card>
          <CardHeader><CardTitle>Dados da Empresa</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Razão Social *</Label><Input value={form.razao_social ?? ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
              <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia ?? ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>CNPJ *</Label><Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual ?? ""} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} /></div>
              <div><Label>Inscrição Municipal</Label><Input value={form.inscricao_municipal ?? ""} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>CEP</Label><Input value={form.cep ?? ""} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
              <div><Label>Logradouro</Label><Input value={form.logradouro ?? ""} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} /></div>
              <div><Label>Número</Label><Input value={form.numero ?? ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Bairro</Label><Input value={form.bairro ?? ""} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf ?? ""} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Celular</Label><Input value={form.celular ?? ""} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Regime Tributário</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.regime_tributario ?? ""} onChange={(e) => setForm({ ...form, regime_tributario: e.target.value })}>
                  <option value="">Selecione</option>
                  <option value="simples">Simples Nacional</option>
                  <option value="presumido">Lucro Presumido</option>
                  <option value="real">Lucro Real</option>
                </select>
              </div>
              <div><Label>CNAE</Label><Input value={form.cnae ?? ""} onChange={(e) => setForm({ ...form, cnae: e.target.value })} /></div>
              <div><Label>Sócio (Nome)</Label><Input value={form.socio_nome ?? ""} onChange={(e) => setForm({ ...form, socio_nome: e.target.value })} /></div>
            </div>
            <Button onClick={handleSalvar} disabled={upsert.isPending}>
              <Save className="mr-2 h-4 w-4" /> {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}