// ============================================================
// "Novo cliente" no PDV: o caixa digita o celular e o sistema procura
// primeiro no cadastro do ERP, depois no CRM (mesmo banco). Achou no ERP:
// usa. Achou no CRM: preenche nome/e-mail/CPF do lead e cadastra. Não
// achou: cadastra do zero. Em todo caso a venda sai com o cliente — e é
// pelo celular que o erp-crm-sync marca a venda no lead do CRM.
// ============================================================

import { useEffect, useState } from "react";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { Loader2, Search, UserPlus, MessageSquare, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { documentoValido, mascaraDocumento } from "@/lib/documento";

type ClienteErp = { id: string; nome_razao: string; cpf_cnpj: string | null; celular: string | null; telefone: string | null; email: string | null };
type LeadCrm = { lead_id: string; nome: string | null; email: string | null; cpf: string | null; telefone: string | null; workspace: string | null; etapa: string | null; status: string | null };

const soDigitos = (s: string) => s.replace(/\D/g, "");
const mascaraCelular = (s: string) => {
  const d = soDigitos(s).replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** cliente escolhido ou criado */
  onCliente: (id: string, nome: string) => void;
  online: boolean;
}

export function ClienteRapidoPdvDialog({ open, onOpenChange, onCliente, online }: Props) {
  // cliente cadastrado no balcão é da filial do balcão (migration 096)
  const { lojaId } = useAutoSelectLoja();
  const qc = useQueryClient();
  const [celular, setCelular] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [locais, setLocais] = useState<ClienteErp[]>([]);
  const [lead, setLead] = useState<LeadCrm | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", cpf: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) { setCelular(""); setLocais([]); setLead(null); setBuscou(false); setForm({ nome: "", email: "", cpf: "" }); }
  }, [open]);

  const buscar = async () => {
    const d = soDigitos(celular);
    if (d.length < 10) { toast.error("Digite o celular com DDD."); return; }
    setBuscando(true); setBuscou(false); setLocais([]); setLead(null);
    try {
      const [r1, r2] = await Promise.all([
        supabase.schema("erp").rpc("buscar_cliente_por_telefone", { p_telefone: d }),
        supabase.schema("erp").rpc("buscar_lead_crm", { p_telefone: d }),
      ]);
      if (r1.error) throw r1.error;
      const achados = (r1.data ?? []) as ClienteErp[];
      setLocais(achados);
      // o CRM é complemento: se falhar, o cadastro manual continua possível
      const l = r2.error ? null : (((r2.data ?? []) as LeadCrm[])[0] ?? null);
      if (r2.error) console.warn("busca no CRM falhou:", r2.error.message);
      setLead(l);
      if (!achados.length) {
        setForm({
          nome: l?.nome ?? "",
          email: l?.email ?? "",
          cpf: l?.cpf ? mascaraDocumento(l.cpf) : "",
        });
      }
    } catch (e: any) {
      toast.error(`Não foi possível buscar: ${e.message ?? e}`);
    } finally {
      setBuscando(false); setBuscou(true);
    }
  };

  const cadastrar = async () => {
    const nome = form.nome.trim();
    if (!nome) { toast.error("Informe o nome do cliente."); return; }
    if (form.cpf.trim() && !documentoValido(form.cpf)) { toast.error("CPF inválido — confira ou apague."); return; }
    setSalvando(true);
    try {
      const { data, error } = await supabase.from("erp_pessoas").insert({
        tipo: "fisica",
        nome_razao: nome,
        celular: mascaraCelular(celular),
        email: form.email.trim() || null,
        cpf_cnpj: soDigitos(form.cpf) || null,
        ativo: true, eh_cliente: true, eh_fornecedor: false,
        loja_cadastro_id: lojaId ?? null,
      }).select("id, nome_razao").single();
      if (error) {
        if (/duplicate|unique/i.test(error.message)) throw new Error("Já existe um cadastro com este CPF — procure pelo nome no campo Cliente.");
        throw error;
      }
      void qc.invalidateQueries({ queryKey: ["erp_clientes"] });
      void qc.invalidateQueries({ queryKey: ["erp_clientes_compras"] });
      toast.success(`${data.nome_razao} cadastrado(a)${lead ? " a partir do CRM" : ""}.`);
      onCliente(data.id, data.nome_razao);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Cliente pelo celular</DialogTitle>
          <DialogClose />
        </DialogHeader>

        {!online && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs dark:bg-amber-950/20">
            Sem internet: a busca no cadastro e no CRM não funciona agora. Use o CPF na nota e cadastre depois.
          </p>
        )}

        <div>
          <Label>Celular (com DDD)</Label>
          <div className="mt-1 flex gap-2">
            <Input inputMode="tel" autoFocus placeholder="(87) 99999-9999" value={celular}
              onChange={(e) => { setCelular(mascaraCelular(e.target.value)); setBuscou(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") void buscar(); }} />
            <Button variant="outline" onClick={() => void buscar()} disabled={buscando || !online}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {buscou && locais.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Já cadastrado no ERP</p>
            {locais.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.nome_razao}</p>
                  <p className="text-xs text-muted-foreground">{[c.cpf_cnpj, c.celular ?? c.telefone, c.email].filter(Boolean).join(" · ")}</p>
                </div>
                <Button size="sm" onClick={() => { onCliente(c.id, c.nome_razao); onOpenChange(false); }}>
                  <Check className="h-4 w-4 mr-1" /> Usar
                </Button>
              </div>
            ))}
          </div>
        )}

        {buscou && locais.length === 0 && (
          <div className="space-y-3">
            {lead ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs dark:border-blue-900 dark:bg-blue-950/20">
                <p className="flex items-center gap-1 font-medium"><MessageSquare className="h-3.5 w-3.5" /> Encontrado no CRM</p>
                <p className="text-muted-foreground">
                  {lead.nome ?? "sem nome"} · {lead.workspace ?? "—"}
                  {lead.etapa && <> · <Badge variant="outline" className="text-[10px]">{lead.etapa}</Badge></>}
                  {lead.status === "won" && <Badge className="ml-1 text-[10px]">ganho</Badge>}
                </p>
                <p className="mt-1 text-muted-foreground">Os dados abaixo vieram do lead — confira e cadastre. A venda vai marcar o lead como ganho no CRM.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum cadastro no ERP nem lead no CRM com este celular. Cadastre agora:</p>
            )}
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF <span className="text-muted-foreground">(opcional)</span></Label>
                <Input inputMode="numeric" value={form.cpf} placeholder="000.000.000-00"
                  onChange={(e) => setForm({ ...form, cpf: mascaraDocumento(e.target.value) })}
                  className={form.cpf.trim() && !documentoValido(form.cpf) ? "border-red-500" : ""} />
              </div>
              <div>
                <Label>E-mail <span className="text-muted-foreground">(opcional)</span></Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {buscou && locais.length === 0 && (
            <Button onClick={() => void cadastrar()} disabled={salvando || !form.nome.trim()}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Cadastrar e usar na venda
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
