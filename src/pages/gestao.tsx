import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, Truck, Building2, Package, Calendar, FileText, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const links = [
  { title: "Clientes", url: "/gestao/clientes", icon: Users, desc: "Cadastro de clientes PF/PJ" },
  { title: "Fornecedores", url: "/gestao/fornecedores", icon: Truck, desc: "Cadastro de fornecedores" },
  { title: "Funcionários", url: "/gestao/funcionarios", icon: Building2, desc: "RH da empresa" },
  { title: "Transportadoras", url: "/gestao/transportadoras", icon: Truck, desc: "Transportes e fretes" },
  { title: "Estoque", url: "/gestao/estoque", icon: Package, desc: "Gestão de estoque por loja" },
  { title: "Agenda de Compromissos", url: "/gestao/agenda-compromissos", icon: Calendar, desc: "Tarefas e reuniões" },
  { title: "Documentos", url: "/gestao/documentos", icon: FileText, desc: "Arquivos e contratos" },
  { title: "E-mail Inteligente", url: "/gestao/email-inteligente", icon: Mail, desc: "Automações de marketing" },
  { title: "Regiões de Entrega", url: "/gestao/regioes-entrega", icon: Truck, desc: "Zonas de frete" },
];

export function GestaoHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="h-6 w-6" /> Gestão Empresarial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Hub central de cadastros e operações</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link to={l.url} key={l.url}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{l.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{l.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}