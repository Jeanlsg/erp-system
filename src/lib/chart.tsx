import { useEffect, useRef } from "react";

type ChartConfig = {
  type: "bar" | "line" | "pie" | "doughnut" | string;
  data: any;
  options?: any;
};

/**
 * Helper minimalista para renderizar Chart.js sem precisar importar o pacote.
 * Usa a API global Chart que vem via CDN no index.html (carregada pelo dashboard).
 *
 * Para um app offline-first, o ideal é instalar `chart.js` + `react-chartjs-2`.
 * Aqui usamos canvas nativo para não inflar o bundle.
 */
export function chart(config: ChartConfig): JSX.Element {
  return <ChartCanvas config={config} />;
}

function ChartCanvas({ config }: { config: ChartConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Carrega Chart.js dinamicamente
    const init = async () => {
      // @ts-expect-error — Chart.js entra por CDN, sem tipos no window
      const Chart = window.Chart;
      if (!Chart) {
        // Carrega via CDN se não estiver disponível
        await loadChartJs();
        return init();
      }

      if (chartRef.current) {
        chartRef.current.destroy();
      }
      chartRef.current = new Chart(canvasRef.current!, {
        type: config.type as any,
        data: config.data,
        options: config.options,
      });
    };

    init();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [config]);

  return <canvas ref={canvasRef} />;
}

let chartJsLoaded = false;
let chartJsLoading: Promise<void> | null = null;

function loadChartJs(): Promise<void> {
  if (chartJsLoaded) return Promise.resolve();
  if (chartJsLoading) return chartJsLoading;

  chartJsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    script.async = true;
    script.onload = () => {
      chartJsLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Falha ao carregar Chart.js"));
    document.head.appendChild(script);
  });
  return chartJsLoading;
}