import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 mt-1">Acompanhe todos os pedidos</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
        Nenhum pedido registrado ainda.
      </div>
    </div>
  );
}
