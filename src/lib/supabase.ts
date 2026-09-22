// No celular, o expo-sqlite fornece um localStorage para guardar a sessão. Na web já existe.
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Sem as variáveis, o app funciona como antes, só sem conta e backup. */
export const supabaseConfigurado = Boolean(url && chave);

export const supabase = supabaseConfigurado
  ? createClient(url!, chave!, {
      auth: {
        storage: globalThis.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Chave-valor simples no mesmo armazenamento da sessão. */
export const kv = {
  ler: (chave: string): string | null => {
    try {
      return globalThis.localStorage?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  },
  gravar: (chave: string, valor: string | null) => {
    try {
      if (valor === null) globalThis.localStorage?.removeItem(chave);
      else globalThis.localStorage?.setItem(chave, valor);
    } catch {
      // Sem armazenamento (ex.: navegação privada): segue sem lembrar.
    }
  },
};
