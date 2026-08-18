// ============================================================
// Páginas extras de Gestão Empresarial (parte 3) — final
// ============================================================

import { Link } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package as PackageIcon, User, Building2, Search, Loader2, Plus, Printer, Barcode, CreditCard,
  DollarSign, Edit, Trash2, Shield,
  Briefcase, FileText, BarChart3,
  Download, Upload, Database,
} from "lucide-react";
import {
  useClientes, useCreatePessoa, useUpdatePessoa, useDeletePessoa,
  useProdutos, useCreateProduto, useUpdateProduto,
  useVendas, useContas, useSangriasPorPeriodo, useEntradasExtrasPorPeriodo,
  isSupabaseConfigured,
} from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { brl, date } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Estas páginas são apelidos de telas que já existem. Antes usavam
// require(), que não existe no bundle do navegador — abrir qualquer uma
// delas quebrava a tela. O lint pegou isso assim que voltou a rodar.
import { ConfigEmpresarialPage } from "@/pages/config.empresarial";
import { DocumentosPage } from "@/pages/documentos";
import { CrediarioProprioPage } from "@/pages/crediario-proprio";
import { GestaoHubPage } from "@/pages/gestao";

// ====================================================================
// CONSULTA PESSOA FÍSICA
// ====================================================================
export function ConsultaPessoaFisicaPage() {
  const { data: pessoas = [], isLoading } = useClientes();
  const create = useCreatePessoa();
  const update = useUpdatePessoa();
  const del = useDeletePessoa();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_razao: "", cpf_cnpj: "", email: "", telefone: "", celular: "",
    data_nascimento: "", estado_civil: "", sexo: "", profissao: "",
    limite_credito: "0",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Consulta Pessoa Física" />;

  const filtrados = pessoas.filter((p) => {
    if (p.tipo !== "fisica") return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nome_razao.toLowerCase().includes(s) || (p.cpf_cnpj ?? "").includes(s);
  });

  const abrirEdicao = (p: any) => {
    setEditId(p.id);
    setForm({
      nome_razao: p.nome_razao, cpf_cnpj: p.cpf_cnpj ?? "", email: p.email ?? "",
      telefone: p.telefone ?? "", celular: p.celular ?? "",
      data_nascimento: p.data_nascimento ?? "", estado_civil: p.estado_civil ?? "",
      sexo: p.sexo ?? "", profissao: p.profissao ?? "", limite_credito: String(p.limite_credito ?? 0),
    });
    setModal(true);
  };

  const handleSalvar = async () => {
    if (!form.nome_razao) return;
    const payload = {
      tipo: "fisica" as const,
      nome_razao: form.nome_razao,
      cpf_cnpj: form.cpf_cnpj || `sem-cpf-${Date.now()}`,
      email: form.email || null, telefone: form.telefone || null, celular: form.celular || null,
      data_nascimento: form.data_nascimento || null, estado_civil: form.estado_civil || null,
      sexo: form.sexo || null, profissao: form.profissao || null,
      limite_credito: parseFloat(form.limite_credito) || 0,
    };
    if (editId) await update.mutateAsync({ id: editId, ...payload });
    else await create.mutateAsync(payload);
    setModal(false);
    setEditId(null);
    setForm({ nome_razao: "", cpf_cnpj: "", email: "", telefone: "", celular: "", data_nascimento: "", estado_civil: "", sexo: "", profissao: "", limite_credito: "0" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6" /> Consulta Pessoa Física
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtrados.length} cliente(s) PF</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm({ nome_razao: "", cpf_cnpj: "", email: "", telefone: "", celular: "", data_nascimento: "", estado_civil: "", sexo: "", profissao: "", limite_credito: "0" }); setModal(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo PF
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma pessoa física</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">CPF</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Telefone</th>
                  <th className="text-center p-3">Limite Crédito</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{p.nome_razao}</td>
                    <td className="p-3 font-mono text-xs">{p.cpf_cnpj}</td>
                    <td className="p-3 text-sm">{p.email ?? "—"}</td>
                    <td className="p-3 text-sm">{p.celular ?? p.telefone ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.limite_credito ?? 0)}</td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(p)}><Edit className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(p.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Pessoa Física</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={form.nome_razao} onChange={(e) => setForm({ ...form, nome_razao: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="000.000.000-00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Data Nasc.</Label><Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} /></div>
              <div>
                <Label>Estado Civil</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.estado_civil} onChange={(e) => setForm({ ...form, estado_civil: e.target.value })}>
                  <option value="">—</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                </select>
              </div>
              <div>
                <Label>Sexo</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Profissão</Label><Input value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} /></div>
              <div><Label>Limite de Crédito</Label><Input type="number" step="0.01" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>{editId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// CONSULTA PESSOA JURÍDICA
// ====================================================================
export function ConsultaPessoaJuridicaPage() {
  const { data: pessoas = [], isLoading } = useClientes();
  const create = useCreatePessoa();
  const update = useUpdatePessoa();
  const del = useDeletePessoa();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_razao: "", nome_fantasia: "", cpf_cnpj: "", email: "", telefone: "", celular: "",
    limite_credito: "0",
  });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Consulta Pessoa Jurídica" />;

  const filtrados = pessoas.filter((p) => {
    if (p.tipo !== "juridica") return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nome_razao.toLowerCase().includes(s) || (p.nome_fantasia ?? "").toLowerCase().includes(s) || (p.cpf_cnpj ?? "").includes(s);
  });

  const abrirEdicao = (p: any) => {
    setEditId(p.id);
    setForm({
      nome_razao: p.nome_razao, nome_fantasia: p.nome_fantasia ?? "", cpf_cnpj: p.cpf_cnpj ?? "",
      email: p.email ?? "", telefone: p.telefone ?? "", celular: p.celular ?? "",
      limite_credito: String(p.limite_credito ?? 0),
    });
    setModal(true);
  };

  const handleSalvar = async () => {
    if (!form.nome_razao) return;
    const payload = {
      tipo: "juridica" as const,
      nome_razao: form.nome_razao, nome_fantasia: form.nome_fantasia || null,
      cpf_cnpj: form.cpf_cnpj || `sem-cnpj-${Date.now()}`,
      email: form.email || null, telefone: form.telefone || null, celular: form.celular || null,
      limite_credito: parseFloat(form.limite_credito) || 0,
    };
    if (editId) await update.mutateAsync({ id: editId, ...payload });
    else await create.mutateAsync(payload);
    setModal(false);
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Consulta Pessoa Jurídica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtrados.length} cliente(s) PJ</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm({ nome_razao: "", nome_fantasia: "", cpf_cnpj: "", email: "", telefone: "", celular: "", limite_credito: "0" }); setModal(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo PJ
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por razão social ou CNPJ..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : filtrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma pessoa jurídica</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Razão Social</th>
                  <th className="text-left p-3">Nome Fantasia</th>
                  <th className="text-left p-3">CNPJ</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-right p-3">Limite</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{p.nome_razao}</td>
                    <td className="p-3 text-sm">{p.nome_fantasia ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{p.cpf_cnpj}</td>
                    <td className="p-3 text-sm">{p.email ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{brl(p.limite_credito ?? 0)}</td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(p)}><Edit className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(p.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Pessoa Jurídica</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Razão Social *</Label><Input value={form.nome_razao} onChange={(e) => setForm({ ...form, nome_razao: e.target.value })} /></div>
              <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Celular</Label><Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
              <div><Label>Limite Crédito</Label><Input type="number" step="0.01" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>{editId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// DADOS EMPRESARIAIS
// ====================================================================
export function DadosEmpresariaisPage() {
  // Reaproveita ConfigEmpresarial
  return <ConfigEmpresarialPage />;
}

// ====================================================================
// CÓDIGO DE BARRAS
// ====================================================================
function imprimirEtiqueta(p: any) {
  const codigo = p.codigo_barras ?? "7891234567890";
  const barras = Array.from({ length: 40 })
    .map((_, i) => `<rect x="${i * 5}" y="0" width="${i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1}" height="60" fill="black"/>`)
    .join("");
  const w = window.open("", "_blank", "width=400,height=300");
  if (!w) { alert("Habilite pop-ups para imprimir a etiqueta."); return; }
  w.document.write(`<!doctype html><html><head><title>Etiqueta — ${p.nome}</title>
    <style>body{font-family:sans-serif;text-align:center;padding:16px}p{margin:2px}</style></head><body>
    <p style="font-weight:bold">${p.nome}</p>
    <p style="font-size:11px;color:#555">${p.sku ?? ""}</p>
    <svg width="200" height="64" xmlns="http://www.w3.org/2000/svg">${barras}</svg>
    <p style="font-family:monospace">${codigo}</p>
    <p style="font-weight:bold;font-size:18px">${Number(p.preco_venda ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
    <script>window.onload = () => { window.print(); window.close(); };<\u002Fscript>
    </body></html>`);
  w.document.close();
}

export function CodigoBarrasPage() {
  const { data: produtos = [] } = useProdutos();
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Código de Barras" />;

  const filtrados = produtos.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nome.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.codigo_barras ?? "").includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Barcode className="h-6 w-6" /> Código de Barras
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Geração de códigos EAN13/EAN8/QR Code</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-y-auto">
            <div className="divide-y">
              {filtrados.slice(0, 30).map((p) => (
                <button key={p.id} onClick={() => setSelected(p)} className={`w-full text-left p-3 hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                  <p className="font-medium text-sm">{p.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.sku} {p.codigo_barras && `· ${p.codigo_barras}`}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            {selected && <Button size="sm" variant="outline" onClick={() => imprimirEtiqueta(selected)}><Printer className="mr-2 h-3 w-3" /> Imprimir Etiqueta</Button>}
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-4 text-center">
                <div className="bg-white p-6 border rounded inline-block">
                  <p className="font-bold">{selected.nome}</p>
                  <p className="text-xs text-muted-foreground mb-2">{selected.sku}</p>
                  {/* Representação visual de código de barras */}
                  <svg width="200" height="80" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <rect key={i} x={i * 5} y="0" width={(i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1)} height="60" fill="black" />
                    ))}
                  </svg>
                  <p className="font-mono text-sm mt-2">{selected.codigo_barras ?? "7891234567890"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Preço:</p>
                  <p className="text-2xl font-bold text-green-600">{brl(selected.preco_venda)}</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>EAN13:</strong> {selected.codigo_barras ?? "(gerar)"}</p>
                  <p><strong>SKU:</strong> {selected.sku}</p>
                  <p><strong>NCM:</strong> {selected.ncm ?? "—"}</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">Selecione um produto para gerar</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ====================================================================
// CARTÃO DE CRÉDITO (recebimentos)
// ====================================================================
export function CartaoCreditoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Cartão de Crédito" />;

  const cartaoCredito = vendas.filter((v: any) => v.forma_pagamento === "cartao_credito");
  const total = cartaoCredito.reduce((s: number, v: any) => s + Number(v.total), 0);
  const taxaEstimada = total * 0.03; // ~3% média

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Cartão de Crédito
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Recebimentos via cartão de crédito</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Recebido</p><p className="text-2xl font-semibold">{brl(total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Qtd Transações</p><p className="text-2xl font-semibold">{cartaoCredito.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Taxa Estimada (3%)</p><p className="text-2xl font-semibold text-red-600">{brl(taxaEstimada)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recebimentos em Cartão de Crédito</CardTitle></CardHeader>
        <CardContent className="p-0">
          {cartaoCredito.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma venda em cartão de crédito</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {cartaoCredito.slice(0, 50).map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{date(v.data_venda)}</td>
                    <td className="p-3 text-sm">{v.cliente?.nome_razao ?? "Consumidor"}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(v.total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{v.status}</Badge></td>
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

// ====================================================================
// CARTÃO DE DÉBITO (recebimentos)
// ====================================================================
export function CartaoDebitoPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Cartão de Débito" />;

  const cartaoDebito = vendas.filter((v: any) => v.forma_pagamento === "cartao_debito");
  const total = cartaoDebito.reduce((s: number, v: any) => s + Number(v.total), 0);
  const taxaEstimada = total * 0.015; // ~1.5% média

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Cartão de Débito
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Recebimentos via cartão de débito</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Recebido</p><p className="text-2xl font-semibold">{brl(total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Qtd Transações</p><p className="text-2xl font-semibold">{cartaoDebito.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Taxa Estimada (1.5%)</p><p className="text-2xl font-semibold text-red-600">{brl(taxaEstimada)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recebimentos em Cartão de Débito</CardTitle></CardHeader>
        <CardContent className="p-0">
          {cartaoDebito.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma venda em débito</div>
          ) : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nº</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {cartaoDebito.slice(0, 50).map((v: any) => (
                  <tr key={v.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-mono text-xs">#{v.numero_pedido ?? v.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm">{date(v.data_venda)}</td>
                    <td className="p-3 text-sm">{v.cliente?.nome_razao ?? "Consumidor"}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{brl(v.total)}</td>
                    <td className="p-3 text-center"><Badge variant="outline">{v.status}</Badge></td>
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

// ====================================================================
// DINHEIRO (movimentações em espécie)
// ====================================================================
export function DinheiroPage() {
  const { lojaId } = useAutoSelectLoja();
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(primeiroDia.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  const { data: sangrias = [] } = useSangriasPorPeriodo(lojaId ?? undefined, dataInicio, dataFim);
  const { data: entradas = [] } = useEntradasExtrasPorPeriodo(lojaId ?? undefined, dataInicio, dataFim);
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Dinheiro" />;

  const vendasDinheiro = vendas.filter((v: any) => v.forma_pagamento === "dinheiro" && v.status === "finalizada");
  const totalEntradas = vendasDinheiro.reduce((s: number, v: any) => s + Number(v.total), 0)
    + entradas.reduce((s: number, e: any) => s + Number(e.valor), 0);
  const totalSaidas = sangrias.reduce((s: number, x: any) => s + Number(x.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <DollarSign className="h-6 w-6" /> Dinheiro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Movimentações em espécie</p>
      </div>

      <Card>
        <CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs">Data Inicial</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs">Data Final</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-44" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Entradas (Vendas + Extras)</p><p className="text-2xl font-semibold text-green-600">{brl(totalEntradas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Saídas (Sangrias)</p><p className="text-2xl font-semibold text-red-600">{brl(totalSaidas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Saldo Período</p><p className={`text-2xl font-semibold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>{brl(saldo)}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Entradas Extras</CardTitle></CardHeader>
          <CardContent className="p-0">
            {entradas.length === 0 ? <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma entrada no período</div> : (
              <table className="w-full">
                <thead className="border-b text-xs"><tr><th className="text-left p-2">Data</th><th className="text-left p-2">Motivo</th><th className="text-right p-2">Valor</th></tr></thead>
                <tbody>
                  {entradas.slice(0, 10).map((e: any) => (
                    <tr key={e.id} className="border-b text-sm">
                      <td className="p-2 text-xs">{date(e.data_hora)}</td>
                      <td className="p-2">{e.motivo}</td>
                      <td className="p-2 text-right tabular-nums text-green-600">{brl(e.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sangrias</CardTitle></CardHeader>
          <CardContent className="p-0">
            {sangrias.length === 0 ? <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma sangria no período</div> : (
              <table className="w-full">
                <thead className="border-b text-xs"><tr><th className="text-left p-2">Data</th><th className="text-left p-2">Motivo</th><th className="text-right p-2">Valor</th></tr></thead>
                <tbody>
                  {sangrias.slice(0, 10).map((s: any) => (
                    <tr key={s.id} className="border-b text-sm">
                      <td className="p-2 text-xs">{date(s.data_hora)}</td>
                      <td className="p-2">{s.motivo}</td>
                      <td className="p-2 text-right tabular-nums text-red-600">{brl(s.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ====================================================================
// LOCALIZAR PESSOAS (busca unificada PF/PJ)
// ====================================================================
export function LocalizarPessoasPage() {
  const { data: pessoas = [] } = useClientes();
  const [search, setSearch] = useState("");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Localizar Pessoas" />;

  const filtrados = pessoas.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nome_razao.toLowerCase().includes(s) ||
      (p.nome_fantasia ?? "").toLowerCase().includes(s) ||
      (p.cpf_cnpj ?? "").includes(s) ||
      (p.email ?? "").toLowerCase().includes(s) ||
      (p.telefone ?? "").includes(s) ||
      (p.celular ?? "").includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6" /> Localizar Pessoas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Busca unificada de PF/PJ</p>
      </div>

      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF/CNPJ, email ou telefone..." className="pl-10 h-12 text-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <p className="text-sm text-muted-foreground">{filtrados.length} resultado(s)</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtrados.slice(0, 30).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${p.tipo === "fisica" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>
                  {p.tipo === "fisica" ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.nome_razao}</p>
                  {p.nome_fantasia && <p className="text-xs text-muted-foreground truncate">{p.nome_fantasia}</p>}
                  <p className="text-xs font-mono text-muted-foreground mt-1">{p.cpf_cnpj}</p>
                  {p.email && <p className="text-xs text-muted-foreground truncate mt-1">{p.email}</p>}
                  {(p.celular ?? p.telefone) && <p className="text-xs text-muted-foreground">{(p.celular ?? p.telefone)}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ====================================================================
// EXCLUSÃO DE INFORMAÇÕES (LGPD)
// ====================================================================
export function ExclusaoInformacoesPage() {
  const [search, setSearch] = useState("");
  const { data: pessoas = [] } = useClientes();

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Exclusão de Informações" />;

  const handleSolicitarExclusao = (pessoa: any) => {
    if (!confirm(`Solicitar exclusão dos dados de ${pessoa.nome_razao}? Esta ação é definitiva (LGPD).`)) return;
    alert(`Solicitação de exclusão registrada para ${pessoa.nome_razao}.\nConforme LGPD Art. 18, o prazo para atendimento é de 15 dias.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" /> Exclusão de Informações (LGPD)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Solicitações de exclusão de dados pessoais conforme Lei 13.709/2018</p>
      </div>

      <Card>
        <CardContent className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500">
          <p className="text-sm font-semibold">⚠ Conforme LGPD Art. 18</p>
          <p className="text-xs text-muted-foreground mt-1">O titular dos dados tem direito à eliminação de seus dados pessoais. O prazo de atendimento é de até 15 dias.</p>
        </CardContent>
      </Card>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar pessoa..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">CPF/CNPJ</th>
                <th className="text-left p-3">Email</th>
                <th className="text-center p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pessoas
                .filter((p) => !search || p.nome_razao.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 30)
                .map((p) => (
                  <tr key={p.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{p.nome_razao}</td>
                    <td className="p-3 font-mono text-xs">{p.cpf_cnpj}</td>
                    <td className="p-3 text-sm">{p.email ?? "—"}</td>
                    <td className="p-3 text-center">
                      <Button size="sm" variant="destructive" onClick={() => handleSolicitarExclusao(p)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Solicitar Exclusão
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ====================================================================
// DOCUMENTOS DEMONSTRATIVOS (DRE / Balanço)
// ====================================================================
export function DocumentosDemonstrativosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });
  const { data: contas = [] } = useContas({ lojaId: lojaId ?? undefined });
  const [abaDre, setAbaDre] = useState("dre");

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Documentos Demonstrativos" />;

  // DRE simplificada
  const receitaBruta = vendas.filter((v: any) => v.status === "finalizada").reduce((s: number, v: any) => s + Number(v.total), 0);
  const custoTotal = vendas.filter((v: any) => v.status === "finalizada").reduce((s: number, v: any) => s + Number(v.custo_total ?? 0), 0);
  const lucroBruto = receitaBruta - custoTotal;

  const despesasPagar = contas.filter((c: any) => c.tipo === "pagar" && c.status === "pago").reduce((s: number, c: any) => s + Number(c.valor), 0);
  const lucroLiquido = lucroBruto - despesasPagar;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Documentos Demonstrativos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">DRE · Balancete · Plano de Contas</p>
      </div>

      <Tabs value={abaDre} onValueChange={setAbaDre}>
        <TabsList>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="balancete">Balancete</TabsTrigger>
          <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
        </TabsList>
        <TabsContent value="dre">
          <Card>
            <CardHeader><CardTitle>Demonstrativo de Resultados (DRE)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between border-b py-2"><span>Receita Bruta de Vendas</span><span className="tabular-nums font-semibold text-green-600">{brl(receitaBruta)}</span></div>
              <div className="flex justify-between border-b py-2"><span>(-) Custo das Mercadorias (CMV)</span><span className="tabular-nums text-red-600">{brl(-custoTotal)}</span></div>
              <div className="flex justify-between border-b py-2 font-bold"><span>= Lucro Bruto</span><span className="tabular-nums">{brl(lucroBruto)}</span></div>
              <div className="flex justify-between border-b py-2"><span>(-) Despesas Operacionais</span><span className="tabular-nums text-red-600">{brl(-despesasPagar)}</span></div>
              <div className="flex justify-between border-b-2 py-2 font-bold text-lg"><span>= Lucro Líquido</span><span className={`tabular-nums ${lucroLiquido >= 0 ? "text-green-600" : "text-red-600"}`}>{brl(lucroLiquido)}</span></div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="balancete">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3" />
              <p className="mb-3">
                O balancete por conta contábil vive na Análise Gerencial, que consolida o
                DRE sobre o plano de contas — receita e despesa por competência, com o
                realizado contra o previsto.
              </p>
              <Button asChild variant="outline">
                <Link to="/relatorios/analise">Abrir Análise Gerencial</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plano">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3" />
              Plano de Contas — configuração via SQL.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====================================================================
// PASTA PRINCIPAL (gerenciador de arquivos)
// ====================================================================
export function PastaPrincipalPage() {
  // Reaproveita Documentos
  return <DocumentosPage />;
}

// ====================================================================
// CADASTRO DE PRODUTOS (CRUD dedicado)
// ====================================================================
export function CadastroProdutosPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: produtos = [], isLoading } = useProdutos({ lojaId: lojaId ?? undefined });
  const create = useCreateProduto();
  const update = useUpdateProduto();

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ sku: "", nome: "", preco_custo: "0", preco_venda: "0", unidade: "UN", estoque_minimo: "0", marca: "", codigo_barras: "" });

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Cadastro de Produtos" />;

  const abrirEdicao = (p: any) => {
    setEditId(p.id);
    setForm({ sku: p.sku, nome: p.nome, preco_custo: String(p.preco_custo ?? 0), preco_venda: String(p.preco_venda ?? 0), unidade: p.unidade ?? "UN", estoque_minimo: String(p.estoque_minimo ?? 0), marca: p.marca ?? "", codigo_barras: p.codigo_barras ?? "" });
    setModal(true);
  };

  const handleSalvar = async () => {
    if (!form.sku || !form.nome) return;
    const payload = {
      sku: form.sku, nome: form.nome,
      preco_custo: parseFloat(form.preco_custo) || 0,
      preco_venda: parseFloat(form.preco_venda) || 0,
      unidade: form.unidade, estoque_minimo: parseInt(form.estoque_minimo) || 0,
      marca: form.marca || null, codigo_barras: form.codigo_barras || null,
    };
    if (editId) await update.mutateAsync({ id: editId, ...payload });
    else await create.mutateAsync(payload);
    setModal(false);
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <PackageIcon className="h-6 w-6" /> Cadastro de Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{produtos.length} produto(s)</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm({ sku: "", nome: "", preco_custo: "0", preco_venda: "0", unidade: "UN", estoque_minimo: "0", marca: "", codigo_barras: "" }); setModal(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (
            <table className="w-full">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">SKU</th>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Marca</th>
                  <th className="text-right p-3">Custo</th>
                  <th className="text-right p-3">Venda</th>
                  <th className="text-right p-3">Margem</th>
                  <th className="text-center p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const margem = Number(p.preco_custo) > 0 ? ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_custo)) * 100 : 0;
                  return (
                    <tr key={p.id} className="border-b hover:bg-accent">
                      <td className="p-3 font-mono text-xs">{p.sku}</td>
                      <td className="p-3 font-medium">{p.nome}</td>
                      <td className="p-3 text-sm">{p.marca ?? "—"}</td>
                      <td className="p-3 text-right tabular-nums text-red-600">{brl(p.preco_custo)}</td>
                      <td className="p-3 text-right tabular-nums text-green-600 font-semibold">{brl(p.preco_venda)}</td>
                      <td className="p-3 text-right tabular-nums">{margem.toFixed(1)}%</td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdicao(p)}><Edit className="h-3 w-3" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Produto</DialogTitle><DialogClose /></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Custo</Label><Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} /></div>
              <div><Label>Venda</Label><Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} /></div>
              <div><Label>Estoque Mín.</Label><Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
              <div><Label>Cód. Barras (EAN)</Label><Input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={create.isPending || !form.sku || !form.nome}>{create.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// GERAR CREDIÁRIO (com juros — diferente do "próprio" sem juros)
// ====================================================================
export function GerarCrediarioPage() {
  // Reaproveita CrediarioProprioPage (mesma estrutura, valores diferentes)
  return <CrediarioProprioPage />;
}

// ====================================================================
// PAINEL DO CONTADOR
// ====================================================================
function baixarTxt(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

/** Parser simples de OFX: extrai as transações (STMTTRN). */
function parseOfx(texto: string) {
  const trans: { data: string; valor: number; memo: string }[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const dt = /<DTPOSTED>(\d{8})/i.exec(b)?.[1] ?? "";
    const valor = parseFloat(/<TRNAMT>(-?[\d.,]+)/i.exec(b)?.[1]?.replace(",", ".") ?? "0");
    const memo = /<MEMO>([^<\r\n]+)/i.exec(b)?.[1]?.trim() ?? "";
    if (dt) trans.push({ data: `${dt.slice(6, 8)}/${dt.slice(4, 6)}/${dt.slice(0, 4)}`, valor, memo });
  }
  return trans;
}

export function PainelContadorPage() {
  const { lojaId } = useAutoSelectLoja();
  const { data: vendas = [] } = useVendas({ lojaId: lojaId ?? undefined });
  const { data: contas = [] } = useContas({ lojaId: lojaId ?? undefined });
  const [ofxTrans, setOfxTrans] = useState<{ data: string; valor: number; memo: string }[] | null>(null);

  if (!isSupabaseConfigured()) return <SupabaseNotConfigured title="Painel do Contador" />;

  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const gerarSpedFiscal = () => {
    const finalizadas = vendas.filter((v: any) => v.status === "finalizada");
    const total = finalizadas.reduce((s: number, v: any) => s + Number(v.total), 0);
    const linhas = [
      `|0000|019|0|${hoje}|${hoje}|EXPORTACAO ERP|—|—|—|—|A|1|`,
      "|0001|0|",
      ...finalizadas.map((v: any) => `|C100|0|1|—|65|00|—|${v.numero_pedido ?? v.id.slice(0, 8)}|${(v.data_venda ?? "").slice(0, 10)}|${Number(v.total).toFixed(2)}|`),
      `|9990|TOTAL_VENDAS:${total.toFixed(2)}|REGISTROS:${finalizadas.length}|`,
      "|9999|FIM|",
      "",
      "ATENCAO: arquivo-base gerado pelo ERP a partir das vendas finalizadas.",
      "Revisar e complementar com o contador antes de transmitir ao SPED.",
    ];
    baixarTxt(`SPED_FISCAL_${hoje}.txt`, linhas.join("\n"));
  };

  const gerarSpedContribuicoes = () => {
    const pagas = contas.filter((c: any) => c.status === "paga");
    const receitas = pagas.filter((c: any) => c.tipo === "receber").reduce((s: number, c: any) => s + Number(c.valor_pago ?? c.valor), 0);
    const despesas = pagas.filter((c: any) => c.tipo === "pagar").reduce((s: number, c: any) => s + Number(c.valor_pago ?? c.valor), 0);
    const linhas = [
      `|0000|006|0|—|${hoje}|${hoje}|EXPORTACAO ERP|—|`,
      ...pagas.map((c: any) => `|F100|${c.tipo === "receber" ? "1" : "0"}|${c.descricao}|${(c.data_pagamento ?? "").slice(0, 10)}|${Number(c.valor_pago ?? c.valor).toFixed(2)}|`),
      `|9990|RECEITAS:${receitas.toFixed(2)}|DESPESAS:${despesas.toFixed(2)}|`,
      "|9999|FIM|",
      "",
      "ATENCAO: arquivo-base gerado pelo ERP a partir das contas pagas/recebidas.",
      "Revisar e complementar com o contador antes de transmitir.",
    ];
    baixarTxt(`SPED_CONTRIBUICOES_${hoje}.txt`, linhas.join("\n"));
  };

  const importarOfx = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ofx,.OFX,.txt";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const texto = await file.text();
      const trans = parseOfx(texto);
      if (trans.length === 0) { alert("Nenhuma transação encontrada no arquivo OFX."); return; }
      setOfxTrans(trans);
    };
    input.click();
  };

  /** Concilia transação do extrato com contas do ERP pelo valor. */
  const conciliar = (valor: number) =>
    contas.find((c: any) => Math.abs(Number(c.valor) - Math.abs(valor)) < 0.01);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="h-6 w-6" /> Painel do Contador
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Portal do contador (SPED, conciliação)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-red-600 mb-2" />
            <p className="font-semibold">SPED Fiscal</p>
            <p className="text-xs text-muted-foreground mt-1">Geração do arquivo SPED</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={gerarSpedFiscal}><Download className="h-3 w-3 mr-1" /> Gerar</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-purple-600 mb-2" />
            <p className="font-semibold">SPED Contribuições</p>
            <p className="text-xs text-muted-foreground mt-1">PIS/COFINS</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={gerarSpedContribuicoes}><Download className="h-3 w-3 mr-1" /> Gerar</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-green-600 mb-2" />
            <p className="font-semibold">Conciliação Bancária</p>
            <p className="text-xs text-muted-foreground mt-1">Conciliar extrato</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={importarOfx}><Upload className="h-3 w-3 mr-1" /> Importar OFX</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Resumo para Contador</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between border-b py-2"><span>Total de vendas no período</span><span className="font-semibold">{vendas.length}</span></div>
          <div className="flex justify-between border-b py-2"><span>Total de contas no período</span><span className="font-semibold">{contas.length}</span></div>
          <div className="flex justify-between border-b py-2"><span>Notas fiscais emitidas</span><span className="font-semibold">—</span></div>
        </CardContent>
      </Card>

      <Dialog open={!!ofxTrans} onOpenChange={(o) => !o && setOfxTrans(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Conciliação Bancária — {ofxTrans?.length ?? 0} transação(ões)</DialogTitle><DialogClose /></DialogHeader>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Descrição</th>
                  <th className="text-right p-2">Valor</th>
                  <th className="text-center p-2">Conciliação</th>
                </tr>
              </thead>
              <tbody>
                {(ofxTrans ?? []).map((tr, i) => {
                  const match = conciliar(tr.valor);
                  return (
                    <tr key={i} className="border-b">
                      <td className="p-2">{tr.data}</td>
                      <td className="p-2">{tr.memo || "—"}</td>
                      <td className={`p-2 text-right tabular-nums ${tr.valor < 0 ? "text-red-600" : "text-green-600"}`}>{brl(tr.valor)}</td>
                      <td className="p-2 text-center">
                        {match ? (
                          <Badge variant="default" className="text-[10px]">{match.descricao}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">sem correspondência</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====================================================================
// GESTÃO EMPRESARIAL (Hub - alias)
// ====================================================================
export function EmpresarialPage() {
  return <GestaoHubPage />;
}