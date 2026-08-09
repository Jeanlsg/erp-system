import { ShoppingCart, Wrench } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export function PedidoPage() { return <PlaceholderPage title="Pedido/Pré-venda" description="Pedidos e pré-vendas" icon={ShoppingCart} />; }
export function OrcamentoPage() { return <PlaceholderPage title="Orçamento" description="Orçamentos rápidos" icon={ShoppingCart} />; }
export function OrdemServicoPage() { return <PlaceholderPage title="Ordem de Serviço" description="Gestão de OS" icon={Wrench} />; }
export function ConsignacaoPage() { return <PlaceholderPage title="Venda Consignada" description="Vendas consignadas" icon={ShoppingCart} />; }
export function LocacaoPage() { return <PlaceholderPage title="Locação" description="Controle de locações" icon={ShoppingCart} />; }