// ============================================================
// Equipamentos homologados — o sucessor da tela "Downloads" do
// sistema antigo, com o que muda no ERP web:
//
//   · Leitores USB: plug and play — o PDV reconhece o bipe em
//     qualquer lugar da tela (modo teclado, padrão de fábrica).
//   · Impressoras de cupom: instalar o driver do fabricante no
//     Windows; o DANFE já sai no formato 80mm.
//   · Etiquetadora: driver + bobina 79×40; a tela de etiquetas
//     tem o formato exato.
//
// Links apontam para a central de downloads do FABRICANTE (link
// profundo de driver quebra a cada reorganização de site).
// ============================================================

import { Monitor, Printer, ScanBarcode, Tag, CheckCircle2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Equipamento {
  modelo: string;
  obs?: string;
  driverUrl?: string;
  driverRotulo?: string;
}

const LEITORES: Equipamento[] = [
  { modelo: "Bematech BR-310" },
  { modelo: "Bematech BR-400" },
  { modelo: "Bematech S-500" },
  { modelo: "Elgin BS-313" },
  { modelo: "Kaiomy HBS-310" },
];

const IMPRESSORAS: Equipamento[] = [
  { modelo: "Bematech MP-4200 TH", driverUrl: "https://www.bematech.com.br/suporte", driverRotulo: "Suporte Bematech" },
  { modelo: "Epson TM-T20", driverUrl: "https://epson.com.br/Suporte/sl/s", driverRotulo: "Suporte Epson" },
  { modelo: "Daruma DR800", driverUrl: "https://www.daruma.com.br", driverRotulo: "Site Daruma" },
  { modelo: "Daruma DR700", driverUrl: "https://www.daruma.com.br", driverRotulo: "Site Daruma" },
  { modelo: "Elgin i9", driverUrl: "https://www.elgin.com.br/automacao/produtos", driverRotulo: "Suporte Elgin" },
  { modelo: "Elgin i7", obs: "Descontinuada — usar o mesmo driver e parâmetros da Elgin i9." },
];

export function EquipamentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Monitor className="h-6 w-6" /> Equipamentos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Leitores, impressoras e etiquetadoras homologados e como instalá-los.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" /> Leitores de código de barras
            <Badge>plug and play</Badge>
          </CardTitle>
          <CardDescription>
            Conecte no USB e pronto — nenhum driver ou configuração. No PDV, bipar em qualquer
            lugar da tela adiciona o item ao carrinho; no Inventário, cada bipe soma +1 na
            contagem. O leitor deve estar no modo padrão de fábrica (emulação de teclado).
            Qualquer leitor USB nesse modo funciona, não apenas os da lista.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {LEITORES.map((e) => (
              <li key={e.modelo} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-none" /> {e.modelo}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            Alternativa sem leitor: o botão de câmera no PDV e no Inventário lê o código pela
            câmera do celular ou notebook.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" /> Impressoras de cupom (térmicas 80&nbsp;mm)
            <Badge variant="outline">instalar driver</Badge>
          </CardTitle>
          <CardDescription>
            O DANFE da NFC-e já sai no formato de cupom 80&nbsp;mm. Instale o driver do
            fabricante no computador do caixa, defina a impressora como padrão do Windows, e a
            impressão do navegador sai direto na térmica — vale para nota, promissória e
            relatórios. Bobina térmica: 80&nbsp;mm (a mesma 79/80 branca ou amarela).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Modelo</th>
                <th className="text-left p-3">Driver / observação</th>
              </tr>
            </thead>
            <tbody>
              {IMPRESSORAS.map((e) => (
                <tr key={e.modelo} className="border-b last:border-0">
                  <td className="p-3 font-medium">{e.modelo}</td>
                  <td className="p-3">
                    {e.obs ? (
                      <span className="text-muted-foreground italic">{e.obs}</span>
                    ) : e.driverUrl ? (
                      <a href={e.driverUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
                        {e.driverRotulo} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" /> Etiquetadora
            <Badge variant="outline">instalar driver</Badge>
          </CardTitle>
          <CardDescription>
            Bematech LB-1000 (ou similar) com bobina de etiqueta <b>79×40&nbsp;mm</b>, branca ou
            amarela. Instale o driver do fabricante e configure o tamanho do papel como 79×40. Em
            Produtos → Gerar Etiquetas, escolha o formato <b>Bobina 79×40</b> — sai uma etiqueta
            por página, no tamanho exato do corte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Sem etiquetadora, o formato <b>Folha A4</b> imprime as etiquetas em grade numa
            impressora comum, para recortar.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Impressão totalmente silenciosa (sem o diálogo do navegador) exige um utilitário local no
        caixa — fora do escopo atual; o fluxo com driver atende a operação normal.
      </p>
    </div>
  );
}
