// ============================================================
// Leitor de código de barras pela câmera (BarcodeDetector)
//
// Usa a API nativa do navegador — zero dependência. Chrome/Edge (inclusive
// Android) suportam; Safari/Firefox ainda não, e aí o componente diz isso
// com todas as letras em vez de abrir uma câmera que nunca lê. O leitor
// físico USB (modo teclado) continua funcionando no campo de busca — a
// câmera é o caminho para celular/tablet sem periférico.
//
// A cada leitura o mesmo código fica 1,5s em quarentena: a câmera "vê" o
// código dezenas de vezes por segundo, e sem isso um produto entraria no
// carrinho vinte vezes num piscar.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoLer: (codigo: string) => void;
  titulo?: string;
  /** true = fecha após a primeira leitura; false = segue lendo (vários itens) */
  unico?: boolean;
}

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

export function LeitorCodigoBarras({ aberto, aoFechar, aoLer, titulo, unico = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const quarentena = useRef<Map<string, number>>(new Map());
  const [estado, setEstado] = useState<"iniciando" | "lendo" | "sem_suporte" | "sem_camera">("iniciando");
  const [ultimo, setUltimo] = useState<string | null>(null);

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!aberto) { parar(); return; }
    let vivo = true;
    let timer: number | undefined;

    (async () => {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) { setEstado("sem_suporte"); return; }
      let detector: any;
      try {
        const suportados: string[] = await Detector.getSupportedFormats();
        detector = new Detector({ formats: FORMATOS.filter((f) => suportados.includes(f)) });
      } catch { setEstado("sem_suporte"); return; }

      try {
        // câmera traseira quando houver (tablet/celular no balcão)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, audio: false,
        });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setEstado("lendo");
      } catch { setEstado("sem_camera"); return; }

      const varrer = async () => {
        if (!vivo || !videoRef.current) return;
        try {
          const codigos = await detector.detect(videoRef.current);
          for (const c of codigos) {
            const v = String(c.rawValue ?? "").trim();
            if (!v) continue;
            const agora = Date.now();
            const antes = quarentena.current.get(v) ?? 0;
            if (agora - antes < 1500) continue;   // mesmo código: quarentena
            quarentena.current.set(v, agora);
            setUltimo(v);
            aoLer(v);
            if (unico) { aoFechar(); return; }
          }
        } catch { /* frame ruim: tenta o próximo */ }
        timer = window.setTimeout(varrer, 120);
      };
      void varrer();
    })();

    return () => { vivo = false; if (timer) window.clearTimeout(timer); parar(); };
  }, [aberto, aoLer, aoFechar, unico, parar]);

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> {titulo ?? "Ler código de barras"}
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o código. O leitor físico USB continua funcionando
            no campo de busca, sem esta janela.
          </DialogDescription>
        </DialogHeader>

        {estado === "sem_suporte" && (
          <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Este navegador não tem o leitor de câmera (Safari e Firefox ainda não
              suportam). Use <b>Chrome ou Edge</b>, o leitor físico, ou digite o código
              no campo de busca.
            </p>
          </div>
        )}
        {estado === "sem_camera" && (
          <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>Câmera indisponível ou permissão negada. Libere a câmera para o site e tente de novo.</p>
          </div>
        )}
        {(estado === "iniciando" || estado === "lendo") && (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-md bg-black">
              {/* playsinline: iOS abre fullscreen sem isso */}
              <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
              {estado === "iniciando" && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/70" />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {ultimo ? `último lido: ${ultimo}` : "aguardando leitura…"}
            </p>
          </div>
        )}

        <Button variant="outline" onClick={aoFechar}>Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}
