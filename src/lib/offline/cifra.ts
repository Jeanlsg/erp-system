// ============================================================
// Cifra da fila offline (AES-GCM, WebCrypto)
//
// A venda retida no navegador contém nome do cliente e valores. A chave é
// gerada UMA vez por dispositivo, marcada como não-extraível (o navegador
// usa a chave mas nunca entrega os bytes dela) e guardada no próprio
// IndexedDB — não há senha em código nem em localStorage.
//
// Honestidade sobre o modelo: isto protege o dado em repouso contra leitura
// casual do disco/backup do navegador. Quem executa código NO dispositivo
// com o perfil aberto consegue decifrar — esse atacante já teria a sessão.
// ============================================================

const NOME_CHAVE = "fila-aes";

async function obterChave(pegar: (k: string) => Promise<CryptoKey | undefined>,
                          guardar: (k: string, v: CryptoKey) => Promise<unknown>): Promise<CryptoKey> {
  const existente = await pegar(NOME_CHAVE);
  if (existente) return existente;
  const nova = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,                      // não-extraível: o navegador nunca expõe os bytes
    ["encrypt", "decrypt"],
  );
  await guardar(NOME_CHAVE, nova);
  return nova;
}

export interface Cifrado {
  __cifrado: true;
  iv: number[];
  dados: number[];
}

export function ehCifrado(v: unknown): v is Cifrado {
  return !!v && typeof v === "object" && (v as Cifrado).__cifrado === true;
}

export async function cifrar(
  valor: unknown,
  pegar: (k: string) => Promise<CryptoKey | undefined>,
  guardar: (k: string, v: CryptoKey) => Promise<unknown>,
): Promise<Cifrado> {
  const chave = await obterChave(pegar, guardar);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const claro = new TextEncoder().encode(JSON.stringify(valor));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, claro);
  return { __cifrado: true, iv: [...iv], dados: [...new Uint8Array(buf)] };
}

export async function decifrar<T>(
  c: Cifrado,
  pegar: (k: string) => Promise<CryptoKey | undefined>,
  guardar: (k: string, v: CryptoKey) => Promise<unknown>,
): Promise<T> {
  const chave = await obterChave(pegar, guardar);
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(c.iv) },
    chave,
    new Uint8Array(c.dados),
  );
  return JSON.parse(new TextDecoder().decode(buf)) as T;
}
