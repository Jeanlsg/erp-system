import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchX, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center p-8">
      <SearchX className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-3xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-md">
        O endereço <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{window.location.pathname}</code> não
        existe neste sistema. Verifique o link ou volte ao início.
      </p>
      <Button asChild>
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
        </Link>
      </Button>
    </div>
  );
}
