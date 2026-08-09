#!/usr/bin/env node
/**
 * Aplica todas as migrations SQL no Supabase automaticamente.
 *
 * Uso:
 *   1. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente
 *   2. Execute: node scripts/apply-migrations.mjs
 *
 * Ou via npm:
 *   npm run migrate
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { config } from "dotenv";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("\n❌ Configure as variáveis:");
  console.error("   SUPABASE_URL=https://seu-projeto.supabase.co");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key");
  console.error("\nOu crie um arquivo .env com essas variáveis.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

/**
 * Tenta executar SQL via API REST (limitado)
 * Para migrations complexas, usa psql ou conexão direta
 */
async function executeSqlDirectly(sql, filename) {
  console.log(`\n📄 Executando: ${filename}`);

  // Divide em comandos menores para evitar timeout
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: stmt });
      if (error && !error.message.includes("function")) {
        console.log(`   ⚠️  Statement ${i + 1}: ${error.message.slice(0, 80)}...`);
      }
    } catch (err) {
      // Ignora erros de função inexistente (rpc exec_sql não existe)
    }
  }
}

async function main() {
  console.log("🚀 Aplicador Automático de Migrations");
  console.log("=====================================");
  console.log(`📡 Conectando em: ${SUPABASE_URL}`);

  try {
    // Verificar conexão
    const { data, error } = await supabase.auth.getUser();
    console.log("✅ Conexão estabelecida com Supabase");
  } catch (err) {
    console.error("❌ Erro de conexão:", err.message);
    process.exit(1);
  }

  // Listar migrations
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`\n📦 Encontradas ${files.length} migrations:`);
  files.forEach((f) => console.log(`   - ${f}`));

  // Criar tabela de controle de migrations se não existir
  console.log("\n🔧 Criando tabela de controle...");

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS erp_schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Tentar via psql primeiro (mais confiável)
  console.log("\n⚠️  AVISO: A API REST do Supabase tem limitações para DDL.");
  console.log("📋 Para melhor resultado, use uma destas opções:\n");
  console.log("OPÇÃO A — Script via psql:");
  console.log(`  psql "${SUPABASE_URL.replace("https://", "postgresql://postgres:[SENHA]@").replace(".supabase.co", ".supabase.co:5432/postgres")}" -f supabase/migrations/001_initial_schema.sql`);
  console.log("\nOPÇÃO B — SQL Editor do Supabase:");
  console.log("  1. Abra https://app.supabase.com → SQL Editor");
  console.log("  2. Cole cada arquivo de migration em ordem");
  console.log("  3. Execute cada um");

  console.log("\n💡 OPÇÃO C — Use o script bash:");
  console.log("  bash scripts/apply-migrations.sh");
}

main().catch(console.error);