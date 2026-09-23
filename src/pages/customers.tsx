import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus, Search, Loader2, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useClientesCompras, useCreatePessoa, useUpdatePessoa, useInativarPessoa, chaveTelefone, isSupabaseConfigured, usePessoaLojas, useDefinirLojasDaPessoa } from "@/lib/supabase-queries";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { brl, date } from "@/lib/format";
import { toast } from "sonner";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { ImportarPessoasDialog } from "@/components/importar-pessoas";
import type { Pessoa } from "@/types/database";

const FORM_VAZIO = {
  tipo: "fisica" as "fisica" | "juridica",
  nome_razao: "", cpf_cnpj: "", email: "", telefone: "", celular: "",
  // Opcional. Alimenta a automação de aniversário do CRM: a data viaja
  // junto com o cliente na sincronização, e lá vira a régua de contato.
  data_nascimento: "",
};

export function CustomersPage() {
  // Clientes da filial do topo (migration 096). O cadastro é um só na
  // empresa; a filial vem do vínculo, que nasce no cadastro e em cada venda.
  const { lojaId, lojas } = useAutoSelectLoja();
  const { data: clientes = [], isLoading } = useClientesCompras(lojaId ?? null);
  const create = useCreatePessoa();
  const update = useUpdatePessoa();
  const inativar = useInativarPessoa();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Pessoa | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [importando, setImportando] = useState(false);
  // filiais do cliente em edição — só para quem trabalha em mais de uma
  const { data: filiaisSalvas = [] } = usePessoaLojas(editando?.id ?? null);
  const definirFiliais = useDefinirLojasDaPessoa();
  const [filiaisMarcadas, setFiliaisMarcadas] = useState<string[]>([]);
  useEffect(() => { setFiliaisMarcadas(filiaisSalvas); }, [editando?.id, filiaisSalvas.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Clientes" />;
  }

  const filtrados = clientes.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.nome_razao.toLowerCase().includes(s) ||
      (c.cpf_cnpj ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.telefone ?? "").includes(s) ||
      (c.celular ?? "").includes(s)
    );
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  };

  const abrirEdicao = (c: Pessoa) => {
    setEditando(c);
    setForm({
      tipo: c.tipo,
      nome_razao: c.nome_razao,
      cpf_cnpj: c.cpf_cnpj ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      celular: c.celular ?? "",
      data_nascimento: (c as any).data_nascimento ?? "",
    });
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome_razao) return;

    // Cadastro repetido do mesmo telefone é o que quebra a contagem de
    // compras e duplica o lead no CRM (lá o telefone É a identidade).
    // Avisa antes de criar mais um, mostrando quem já usa o número.
    const chave = chaveTelefone(form.celular || form.telefone);
    // Na outra filial: a lista desta tela não enxerga, então procura na
    // empresa inteira. Achou lá? Traz o cadastro existente para esta filial
    // em vez de criar um segundo para a mesma pessoa.
    if (chave && !editando && lojaId) {
      const tel = form.celular || form.telefone;
      const { data: achados } = await supabase.schema("erp")
        .rpc("buscar_cliente_por_telefone", { p_telefone: tel });
      const deOutraFilial = ((achados ?? []) as any[]).find((a) => !clientes.some((c) => c.id === a.id));
      if (deOutraFilial) {
        const trazer = confirm(
          `Este telefone já é de "${deOutraFilial.nome_razao}", cadastrado em outra filial.` +
          "\n\nOK: trazer esse cadastro para esta filial (recomendado)." +
          "\nCancelar: criar um cadastro novo mesmo assim.");
        if (trazer) {
          const { error } = await supabase.from("erp_pessoa_lojas")
            .insert({ pessoa_id: deOutraFilial.id, loja_id: lojaId });
          if (error && !/duplicate/i.test(error.message)) {
            toast.error(`Não foi possível trazer: ${error.message}`);
            return;
          }
          void qc.invalidateQueries({ queryKey: ["erp_clientes_compras"] });
          void qc.invalidateQueries({ queryKey: ["erp_clientes"] });
          toast.success(`${deOutraFilial.nome_razao} agora também é cliente desta filial.`);
          setModalAberto(false);
          return;
        }
      }
    }
    if (chave) {
      const jaExiste = clientes.find(
        (c) => c.chave_telefone === chave && c.id !== editando?.id,
      );
      if (jaExiste) {
        const ok = confirm(
          `Este telefone já é de "${jaExiste.nome_razao}"` +
          (jaExiste.compras > 0 ? ` (${jaExiste.compras} compra(s) no histórico).` : ".") +
          "\n\nCadastrar assim mesmo cria um segundo cadastro para a mesma pessoa." +
          "\nO histórico continua somado pelo telefone, mas o cadastro fica repetido." +
          "\n\nContinuar?"
        );
        if (!ok) return;
      }
    }

    const payload = {
      tipo: form.tipo,
      nome_razao: form.nome_razao,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      celular: form.celular || null,
      data_nascimento: form.data_nascimento || null,
    };
    try {
      if (editando) {
        await update.mutateAsync({ id: editando.id, ...payload } as any);
        if (lojas.length > 1) {
          await definirFiliais.mutateAsync({
            pessoaId: editando.id, marcadas: filiaisMarcadas,
            podeMexer: (lojas as any[]).map((l) => l.id),
          });
        }
        toast.success("Cliente atualizado.");
      } else {
        // cadastrado nesta tela é cliente; o papel de fornecedor se ganha na
        // tela de Fornecedores, e uma pessoa pode ser os dois
        // a filial do cadastro liga o cliente a ela (migration 096)
        await create.mutateAsync({ ...payload, ativo: true, eh_cliente: true, loja_cadastro_id: lojaId } as any);
        toast.success("Cliente cadastrado.");
      }
      setModalAberto(false);
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message ?? e}`);
    }
  };

  const handleInativar = async (c: any) => {
    const ok = confirm(
      `Inativar o cliente "${c.nome_razao}"?\n\n` +
      "Ele sai das listas e do PDV, mas o cadastro e o histórico de compras " +
      "continuam no sistema — a nota fiscal emitida tem guarda obrigatória de 5 anos.\n\n" +
      "Para apagar os dados pessoais de verdade, use Exclusão LGPD: lá o pedido " +
      "fica registrado com prazo e o titular é anonimizado sem perder a nota."
    );
    if (!ok) return;
    try {
      await inativar.mutateAsync(c.id);
      toast.success("Cliente inativado.");
    } catch (e: any) {
      toast.error(`Não foi possível inativar: ${e.message ?? e}`);
    }
  };

  const salvando = create.isPending || update.isPending;

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportando(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Importar planilha
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo Cliente
          </Button>
        </div>
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
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">Total gasto</TableHead>
                  <TableHead>Última compra</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Badge variant="outline" className="text-xs uppercase">{c.tipo === "fisica" ? "PF" : "PJ"}</Badge></TableCell>
                      <TableCell className="font-medium">{c.nome_razao}</TableCell>
                      <TableCell className="font-mono text-xs">{c.cpf_cnpj ?? "—"}</TableCell>
                      <TableCell>{c.email ?? "—"}</TableCell>
                      <TableCell>{c.telefone ?? c.celular ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.compras > 0
                          ? <Badge variant={c.compras >= 5 ? "default" : "outline"}>{c.compras}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.compras > 0 ? brl(c.total_gasto) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.ultima_compra ? date(c.ultima_compra) : "—"}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => abrirEdicao(c)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Inativar"
                          onClick={() => void handleInativar(c)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant={form.tipo === "fisica" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, tipo: "fisica" })}>Pessoa Física</Button>
              <Button type="button" variant={form.tipo === "juridica" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, tipo: "juridica" })}>Pessoa Jurídica</Button>
            </div>
            <div><Label>{form.tipo === "fisica" ? "Nome *" : "Razão Social *"}</Label><Input value={form.nome_razao} onChange={(e) => setForm({ ...form, nome_razao: e.target.value })} /></div>
            <div><Label>{form.tipo === "fisica" ? "CPF" : "CNPJ"}</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder={form.tipo === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Celular</Label><Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Opcional. Preenchida, o cliente entra na régua de aniversário do CRM.
              </p>
            </div>
            {editando && lojas.length > 1 && (
              <div>
                <Label>Filiais deste cliente</Label>
                <div className="mt-1 flex flex-wrap gap-3">
                  {(lojas as any[]).map((l) => (
                    <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4"
                        checked={filiaisMarcadas.includes(l.id)}
                        onChange={(e) => setFiliaisMarcadas((f) =>
                          e.target.checked ? [...f, l.id] : f.filter((x) => x !== l.id))} />
                      {l.apelido || l.nome}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  O cliente aparece na lista das filiais marcadas. Uma venda numa filial
                  desmarcada liga ele a ela de novo.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando || !form.nome_razao}>
              {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportarPessoasDialog open={importando} onOpenChange={setImportando} papel="cliente" />
    </div>
  );
}
