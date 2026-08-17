// ============================================================
// Armazenamento local do PDV (IndexedDB)
//
// localStorage não serve aqui: é síncrono (trava a UI do caixa), tem ~5 MB
// e guarda só string. O catálogo de produtos de uma loja passa disso com
// facilidade, e a fila de vendas precisa sobreviver a um fechamento abrupto
// do navegador — que é justamente o cenário em que ela existe.
// ============================================================

const DB_NOME = "xlife-pdv";
const DB_VERSAO = 1;

export const LOJA_FILA = "fila_vendas";
export const LOJA_CACHE = "cache";

export interface VendaEnfileirada {
  uuid_local: string;
  loja_id: string;
  criado_em: string;
  payload: any;
  tentativas: number;
  ultimo_erro?: string | null;
  /** 'pendente' volta a ser tentada sozinha; 'bloqueada' espera decisão humana. */
  status: "pendente" | "bloqueada";
}

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (conexao) return conexao;
  conexao = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste navegador"));
      return;
    }
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA_FILA)) {
        const s = db.createObjectStore(LOJA_FILA, { keyPath: "uuid_local" });
        s.createIndex("por_loja", "loja_id");
        s.createIndex("por_data", "criado_em");
      }
      if (!db.objectStoreNames.contains(LOJA_CACHE)) {
        db.createObjectStore(LOJA_CACHE, { keyPath: "chave" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("falha ao abrir o banco local"));
  });
  return conexao;
}

function executar<T>(
  loja: string,
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(loja, modo);
        const req = fn(tx.objectStore(loja));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("falha no banco local"));
      }),
  );
}

// ---------- fila de vendas ----------
export const enfileirar = (v: VendaEnfileirada) =>
  executar(LOJA_FILA, "readwrite", (s) => s.put(v));

export const lerFila = () =>
  executar<VendaEnfileirada[]>(LOJA_FILA, "readonly", (s) => s.getAll() as any);

export const removerDaFila = (uuid: string) =>
  executar(LOJA_FILA, "readwrite", (s) => s.delete(uuid));

export const lerDaFila = (uuid: string) =>
  executar<VendaEnfileirada | undefined>(LOJA_FILA, "readonly", (s) => s.get(uuid) as any);

// ---------- cache genérico (catálogo, config do caixa) ----------
export async function salvarCache(chave: string, dados: unknown) {
  await executar(LOJA_CACHE, "readwrite", (s) =>
    s.put({ chave, dados, atualizado_em: new Date().toISOString() }),
  );
}

export async function lerCache<T>(chave: string): Promise<{ dados: T; atualizado_em: string } | null> {
  const r = await executar<any>(LOJA_CACHE, "readonly", (s) => s.get(chave) as any);
  return r ? { dados: r.dados as T, atualizado_em: r.atualizado_em } : null;
}

/** O suporte pode faltar em navegador antigo ou em aba anônima com storage bloqueado. */
export async function offlineDisponivel(): Promise<boolean> {
  try {
    await abrir();
    return true;
  } catch {
    return false;
  }
}
