// ============================================================
// Configuração do ESLint (flat config, exigida pelo ESLint 9)
//
// O script `npm run lint` existia e as dependências estavam instaladas, mas
// sem este arquivo o ESLint 9 não roda — ou seja, nada era verificado.
//
// O conjunto de regras é deliberadamente enxuto: a base recomendada mais as
// regras de hooks. Ligar tudo de uma vez num código que nunca passou pelo
// lint produz centenas de avisos e o time aprende a ignorar a saída — o que
// é pior do que não ter lint. As regras que hoje pegariam erro real ficam em
// "error"; as de estilo ficam em "warn" ou desligadas.
// ============================================================

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "supabase/functions/**", "services/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Dependência faltando em useEffect é fonte real de bug (tela que não
      // atualiza, request que não refaz), então é erro — não aviso.
      "react-hooks/exhaustive-deps": "error",

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // `any` é onipresente nas respostas do Supabase, que não têm tipos
      // gerados por schema. Marcar cada uma afogaria o sinal.
      "@typescript-eslint/no-explicit-any": "off",

      // Catch vazio é intencional no cabeçalho de notificações: um widget
      // que falha não pode derrubar os outros cinco. O que NÃO se aceita é
      // bloco vazio fora de catch, que é quase sempre código pela metade.
      "no-empty": ["error", { allowEmptyCatch: true }],

      // Variável não usada aponta código morto de verdade; prefixo _ é a
      // convenção para "recebi mas não uso".
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    // Arquivos de configuração rodam em Node e usam require() por convenção
    // (plugins do Tailwind, por exemplo). A regra existe para o código do app.
    files: ["*.config.{ts,js}", "vite.config.ts", "tailwind.config.ts"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
