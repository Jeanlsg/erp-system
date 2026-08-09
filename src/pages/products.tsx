import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 mt-1">Gerencie seu catálogo de produtos</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
        Nenhum produto cadastrado ainda.
      </div>
    </div>
  );
}
