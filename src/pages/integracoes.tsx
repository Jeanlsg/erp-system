import { ShoppingCart, MessageSquare, CreditCard } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export function IFoodPage() { return <PlaceholderPage title="iFood" description="Pedidos via iFood" icon={ShoppingCart} />; }
export function ExAppPedidosPage() { return <PlaceholderPage title="ExApp Pedidos" description="Pedidos via WhatsApp" icon={MessageSquare} />; }
export function TEFPage() { return <PlaceholderPage title="TEF / SITEF" description="Integração TEF" icon={CreditCard} />; }