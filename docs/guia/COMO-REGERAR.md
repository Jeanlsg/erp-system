# Guia "Primeiros passos" — fonte

`primeiros-passos.html` é a fonte do PDF entregue ao cliente. As imagens não ficam
aqui: o HTML usa marcadores `IMG:nome`, trocados por data-URI na hora de gerar.

## Regerar o PDF

1. Sistema limpo + `scripts/dados-demonstracao.sql` aplicado, e uma conta temporária
   com o nome **"Operador da Loja"** — o nome aparece na barra lateral de toda captura.
2. Capturar as telas em 1440×900, `deviceScaleFactor: 2`, com estes nomes:

   | arquivo | tela |
   |---|---|
   | `02-login-preenchido` | /login com e-mail genérico, sem enviar |
   | `03-dashboard` | / |
   | `04-produtos-lista` | /produtos-estoque-lotes |
   | `05-importar-planilha` | idem, com a janela Importar Planilha aberta |
   | `23-importar-nfe` | /compras/importar-nfe |
   | `06-clientes` | /gestao/clientes |
   | `08-abrir-caixa` | /pdv com caixa fechado, CAIXA 001 escolhido e troco 200 |
   | `11-pdv-carrinho` | /pdv com 2 itens, Dinheiro e valor recebido |
   | `12-confirmar-venda` | idem, após Finalizar |
   | `14-vendas` | /vendas |
   | `15-caixa` | /caixa |
   | `16-contas-receber` | /financeiro?aba=areceber |
   | `22-fechar-caixa` | /pdv com a janela Fechamento de Caixa aberta |
   | `21-sped-contabilista` | /fiscal/escrituracao |
   | `18-config-sefaz` | /gestao/configuracoes-sefaz |

3. Embutir e gerar:

```bash
python3 - <<'PY'
import base64, pathlib, re
imgs = {f.stem: "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()
        for f in pathlib.Path("prints").glob("*.png")}
html = pathlib.Path("primeiros-passos.html").read_text()
pathlib.Path("final.html").write_text(re.sub(r'IMG:([\w-]+)', lambda m: imgs[m.group(1)], html))
PY
node gerar-pdf.mjs "$PWD/final.html" "$PWD/ERP-XLife-Primeiros-Passos.pdf"
```

4. **Apagar os dados de demonstração** (`scripts/virada-producao.sql`) e a conta temporária.

## Por que a fonte está versionada

A primeira versão viveu só num diretório temporário e se perdeu entre sessões;
recuperar o texto exigiu extrair as imagens do PDF já gerado com `pdfimages`.
O PDF em si fica fora do git (`.gitignore` ignora `*.pdf`).
