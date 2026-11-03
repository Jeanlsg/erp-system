/**
 * Janela de impressão: escreve o HTML e manda imprimir a partir daqui.
 *
 * Antes cada documento trazia um <script>window.print()</script>. A janela
 * vazia (window.open("")) herda a CSP do ERP, que não roda script embutido
 * (varredura de segurança de 03/11/2026): o documento abriria sem imprimir.
 * Agora quem chama o print é o ERP, quando a janela termina de carregar.
 */
export function escreverEImprimir(w: Window, html: string, opcoes: { fechar?: boolean } = {}) {
  w.document.open();
  w.document.write(html);
  w.document.close();
  let feito = false;
  const imprimir = () => {
    if (feito || w.closed) return;
    feito = true;
    w.focus();
    w.print();
    if (opcoes.fechar) w.close();
  };
  if (w.document.readyState === "complete") {
    setTimeout(imprimir, 250);
    return;
  }
  w.addEventListener("load", () => setTimeout(imprimir, 50), { once: true });
  // imagem que não carrega não pode prender a impressão
  setTimeout(imprimir, 3000);
}

/**
 * Texto do banco dentro do HTML da impressão. Nome de produto e de
 * fornecedor vêm do cadastro e do XML da NF-e do fornecedor: sem escapar, um
 * `<img onerror>` no nome rodava na janela, que é da mesma origem do ERP e lê
 * a sessão (varredura de 03/11/2026).
 */
export function escaparHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
