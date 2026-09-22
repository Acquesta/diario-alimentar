import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import type { Banco, TipoArmazenamento } from './banco-tipos';
import { migrar, NOME_BANCO } from './db';

type Estado = { banco: Banco; tipo: TipoArmazenamento; aoAlterar: (fn: () => void) => () => void };

const BancoContexto = createContext<Estado | null>(null);

/** Tempo máximo para o expo-sqlite abrir antes de cair no plano B. */
const LIMITE_ABERTURA_MS = 8000;

/**
 * Abre o banco e o entrega às telas.
 * Celular: expo-sqlite. Web: expo-sqlite (OPFS) quando o navegador permite;
 * senão, plano B com sql.js salvo no IndexedDB.
 */
export function BancoProvider({ children, carregando }: { children: ReactNode; carregando: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    abrirBanco()
      .then(({ banco, tipo }) => setEstado({ tipo, ...comAvisos(banco) }))
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);

  if (erro) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>Não foi possível abrir seus dados</Text>
        <Text style={{ textAlign: 'center' }}>Feche e abra o app de novo. Se continuar, mande esta mensagem para quem fez o app:</Text>
        <Text style={{ textAlign: 'center', opacity: 0.7 }}>{erro}</Text>
      </View>
    );
  }
  if (!estado) return <>{carregando}</>;
  return <BancoContexto.Provider value={estado}>{children}</BancoContexto.Provider>;
}

export function useBanco(): Banco {
  return usarEstado().banco;
}

export function useTipoArmazenamento(): TipoArmazenamento {
  return usarEstado().tipo;
}

/** Assina alterações no banco (para o backup automático). Retorna a função que cancela. */
export function useAoAlterar(): Estado['aoAlterar'] {
  return usarEstado().aoAlterar;
}

function usarEstado(): Estado {
  const estado = useContext(BancoContexto);
  if (!estado) throw new Error('useBanco precisa estar dentro de BancoProvider');
  return estado;
}

/** Envolve o banco para avisar quem assinou sempre que algo for gravado. */
function comAvisos(original: Banco): Pick<Estado, 'banco' | 'aoAlterar'> {
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((fn) => fn());
  const banco: Banco = {
    execAsync: (sql) => original.execAsync(sql).finally(avisar),
    runAsync: (sql, ...params) => original.runAsync(sql, ...params).finally(avisar),
    getFirstAsync: (sql, ...params) => original.getFirstAsync(sql, ...params),
    getAllAsync: (sql, ...params) => original.getAllAsync(sql, ...params),
    withTransactionAsync: (fn) => original.withTransactionAsync(fn),
  };
  return {
    banco,
    aoAlterar: (fn) => {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
  };
}

async function abrirBanco(): Promise<Omit<Estado, 'aoAlterar'>> {
  if (Platform.OS !== 'web') {
    const banco = await openDatabaseAsync(NOME_BANCO);
    await migrar(banco);
    return { banco, tipo: 'sqlite' };
  }

  if (podeUsarSqliteNaWeb()) {
    try {
      const banco = await comLimite(openDatabaseAsync(NOME_BANCO), LIMITE_ABERTURA_MS);
      await comLimite(migrar(banco), LIMITE_ABERTURA_MS);
      return { banco, tipo: 'sqlite' };
    } catch (e) {
      console.warn('expo-sqlite não abriu na web; usando o plano B (IndexedDB).', e);
    }
  }

  const { abrirBancoIndexedDb } = await import('./banco-web');
  const banco = await abrirBancoIndexedDb(NOME_BANCO);
  await migrar(banco);
  return { banco, tipo: 'indexeddb' };
}

/** O expo-sqlite na web exige SharedArrayBuffer (isolamento de origem) e OPFS. */
function podeUsarSqliteNaWeb(): boolean {
  // Para testar o plano B em qualquer navegador: abrir com ?armazenamento=indexeddb
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('armazenamento') === 'indexeddb') {
    return false;
  }
  return (
    typeof SharedArrayBuffer !== 'undefined' &&
    globalThis.crossOriginIsolated === true &&
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  );
}

function comLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Tempo esgotado (${ms} ms)`)), ms);
    promessa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
