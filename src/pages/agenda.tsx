import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, CheckCircle, Trash2, Bell } from "lucide-react";
import { useAuth } from "@/lib/store/auth-store";
import { useAutoSelectLoja } from "@/lib/store/use-auto-select-loja";
import { useAgendaCompromissos, useCreateAgendaItem, useToggleAgendaItem, useDeleteAgendaItem, isSupabaseConfigured } from "@/lib/supabase-queries";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";

export function AgendaPage() {
  const { user } = useAuth();
  const { lojaId } = useAutoSelectLoja();
  const { data: itens = [], isLoading } = useAgendaCompromissos(user?.id);
  const createItem = useCreateAgendaItem();
  const toggleItem = useToggleAgendaItem();
  const deleteItem = useDeleteAgendaItem();

  const [novo, setNovo] = useState({
    titulo: "",
    descricao: "",
    data_inicio: "",
    tipo: "tarefa",
    prioridade: "media",
  });

  // === MELHORIAS IDENTIFICADAS ===
  // TODO: Visualização mensal/semanal em calendário
  // TODO: Recorrência (diário, semanal, mensal)
  // TODO: Lembretes por email/push
  // TODO: Compartilhamento de eventos com equipe
  // TODO: Vincular a clientes, vendas, pedidos
  // TODO: Cores por tipo/categoria
  // TODO: Drag-and-drop para reagendar

  if (!isSupabaseConfigured()) {
    return <SupabaseNotConfigured title="Agenda de Compromissos" />;
  }

  if (!user) {
    return null;
  }

  const hoje = new Date();
  const proximos7Dias = itens.filter((i) => new Date(i.data_inicio) >= new Date(hoje.setHours(0, 0, 0, 0)));
  const atrasados = itens.filter((i) => new Date(i.data_inicio) < new Date(hoje.setHours(0, 0, 0, 0)) && i.status !== "concluido");
  const concluidos = itens.filter((i) => i.status === "concluido");

  const PRIORIDADE_VARIANT: Record<string, "default" | "destructive" | "outline"> = {
    alta: "destructive", media: "default", baixa: "outline",
  };

  const TIPO_ICONS: Record<string, any> = {
    reuniao: "👥", tarefa: "✓", lembrete: "🔔", evento: "📅",
  };

  const handleCriar = async () => {
    if (!user || !novo.titulo || !novo.data_inicio) return;
    await createItem.mutateAsync({
      usuario_id: user.id,
      loja_id: lojaId,
      titulo: novo.titulo,
      descricao: novo.descricao || null,
      data_inicio: novo.data_inicio,
      tipo: novo.tipo,
      prioridade: novo.prioridade,
      status: "pendente",
    });
    setNovo({ titulo: "", descricao: "", data_inicio: "", tipo: "tarefa", prioridade: "media" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Agenda de Compromissos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {itens.length} compromissos · {proximos7Dias.length} próximos
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-semibold">{itens.filter((i) => i.status === "pendente").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Atrasados</p>
            <p className="text-2xl font-semibold text-red-600">{atrasados.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-semibold text-green-600">{concluidos.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo Compromisso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Título</Label>
              <Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Reunião com fornecedor" />
            </div>
            <div>
              <Label>Data/Hora</Label>
              <Input type="datetime-local" value={novo.data_inicio} onChange={(e) => setNovo({ ...novo, data_inicio: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} placeholder="Detalhes..." />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={novo.tipo}
                onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
              >
                <option value="tarefa">Tarefa</option>
                <option value="reuniao">Reunião</option>
                <option value="lembrete">Lembrete</option>
                <option value="evento">Evento</option>
              </select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={novo.prioridade}
                onChange={(e) => setNovo({ ...novo, prioridade: e.target.value })}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <Button onClick={handleCriar} disabled={createItem.isPending || !novo.titulo || !novo.data_inicio} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compromissos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum compromisso</div>
          ) : (
            <div className="divide-y">
              {itens.map((item) => {
                const isAtrasado = new Date(item.data_inicio) < new Date() && item.status !== "concluido";
                return (
                  <div key={item.id} className="flex items-start gap-3 p-4">
                    <button
                      onClick={() => toggleItem.mutate({ id: item.id, status: item.status === "concluido" ? "pendente" : "concluido" })}
                      className="mt-1"
                    >
                      <CheckCircle
                        className={`h-5 w-5 ${
                          item.status === "concluido" ? "text-green-600 fill-green-100" : "text-gray-300"
                        }`}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{TIPO_ICONS[item.tipo] ?? "•"}</span>
                        <p className={`font-medium ${item.status === "concluido" ? "line-through text-muted-foreground" : ""}`}>
                          {item.titulo}
                        </p>
                        <Badge variant={PRIORIDADE_VARIANT[item.prioridade] || "outline"} className="text-xs">
                          {item.prioridade}
                        </Badge>
                        {isAtrasado && (
                          <Badge variant="destructive" className="text-xs">
                            <Bell className="mr-1 h-3 w-3" /> Atrasado
                          </Badge>
                        )}
                      </div>
                      {item.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">{item.descricao}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.data_inicio).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem.mutate(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}