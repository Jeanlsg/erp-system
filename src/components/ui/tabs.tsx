import { createContext, useContext } from "react";

type TabsCtx = { value: string; onChange: (v: string) => void };

const TabsContext = createContext<TabsCtx | null>(null);

export function Tabs({
  value, onValueChange, children, className = "",
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex h-9 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground overflow-x-auto w-full ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.onChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium transition-all flex-1 ${
        active ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return <div className={`mt-4 ${className}`}>{children}</div>;
}