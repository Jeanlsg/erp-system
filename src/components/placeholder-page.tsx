import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function PlaceholderPage({ title, description, icon: Icon }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          {Icon && <Icon className="h-6 w-6" />}
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Este módulo está em desenvolvimento.
        </CardContent>
      </Card>
    </div>
  );
}