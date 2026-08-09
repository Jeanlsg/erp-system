import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1">Gerencie sua base de clientes</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
        Nenhum cliente cadastrado ainda.
      </div>
    </div>
  );
}
