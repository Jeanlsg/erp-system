import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  title?: string;
}

export function SupabaseNotConfigured({ title }: Props) {
  return (
    <div className="space-y-6">
      {title && (
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      )}
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">
            Configure as variáveis do Supabase no arquivo <code className="text-xs">.env</code>
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <div><code>VITE_SUPABASE_URL</code></div>
            <div><code>VITE_SUPABASE_ANON_KEY</code></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}