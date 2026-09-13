import { chromium } from "playwright";
const nav = await chromium.launch();
const page = await (await nav.newContext()).newPage();
await page.goto(`file://${process.argv[2]}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.pdf({ path: process.argv[3], format: "A4", printBackground: true,
  displayHeaderFooter: true, headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:8pt;color:#71717a;padding:0 14mm;
    font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;justify-content:space-between;">
    <span>ERP X-Life — Primeiros passos</span><span class="pageNumber"></span></div>`,
  margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" } });
await nav.close(); console.log("PDF gerado");
