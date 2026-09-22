import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { decidir, exportar, importar, vazio, type Instantaneo } from './backup';
import { useAoAlterar, useBanco } from './banco';
import { VERSAO } from './db';
import { kv, supabase, supabaseConfigurado } from './supabase';

/**
 * Conta (login por código no e-mail) e backup do diário no Supabase.
 * Tudo é opcional: sem entrar, o app funciona só com os dados do aparelho.
 */

const ESPERA_BACKUP_MS = 30_000;
const DIAS_SEM_USO_PARA_SAIR = 30;
const CHAVE_ULTIMO_USO = 'conta:ultimo-uso';
const chaveSincronizado = (id: string) => `backup:sincronizado:${id}`;
const chaveUltimoBackup = (id: string) => `backup:ultimo:${id}`;

type Usuario = { id: string; email: string };
type LinhaNuvem = { dados: Instantaneo; atualizado_em: string; aparelho: string | null };
/** Nuvem tem dados e o app precisa perguntar o que fazer. */
export type Pendencia = { atualizadoEm: string; aparelho: string | null; aparelhoTemDados: boolean };

type Conta = {
  disponivel: boolean;
  usuario: Usuario | null;
  ultimoBackup: string | null;
  ocupado: boolean;
  erro: string | null;
  pendencia: Pendencia | null;
  podeDesfazer: boolean;
  pedirCodigo: (email: string) => Promise<void>;
  confirmarCodigo: (email: string, codigo: string) => Promise<void>;
  sair: () => Promise<void>;
  fazerBackupAgora: () => Promise<void>;
  restaurar: () => Promise<void>;
  manterDoAparelho: () => Promise<void>;
  desfazerRestauracao: () => Promise<void>;
  apagarConta: (apagarDoAparelho: boolean) => Promise<void>;
};

const ContaContexto = createContext<Conta | null>(null);

export function ContaProvider({ children }: { children: ReactNode }) {
  const db = useBanco();
  const aoAlterar = useAoAlterar();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendencia, setPendencia] = useState<Pendencia | null>(null);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usuarioRef = useRef<Usuario | null>(null);
  usuarioRef.current = usuario;

  const lerNuvem = useCallback(async (id: string): Promise<LinhaNuvem | null> => {
    const { data, error } = await supabase!
      .from('backups')
      .select('dados, atualizado_em, aparelho')
      .eq('user_id', id)
      .maybeSingle();
    if (error) throw error;
    return data as LinhaNuvem | null;
  }, []);

  const gravarNuvem = useCallback(
    async (id: string, dados: Instantaneo, anterior?: Instantaneo | null) => {
      const linha: Record<string, unknown> = {
        user_id: id,
        dados,
        versao_esquema: VERSAO,
        aparelho: nomeAparelho(),
      };
      if (anterior !== undefined) linha.dados_anterior = anterior;
      const { data, error } = await supabase!.from('backups').upsert(linha).select('atualizado_em').single();
      if (error) throw error;
      marcarSincronizado(id, data.atualizado_em);
    },
    [],
  );

  const marcarSincronizado = (id: string, quando: string) => {
    kv.gravar(chaveSincronizado(id), '1');
    kv.gravar(chaveUltimoBackup(id), quando);
    setUltimoBackup(quando);
  };

  /**
   * Envia o diário para a nuvem sem nunca apagar dados sem querer (regra em `decidir`).
   * `automatico`: chamado pelo timer ou ao sair do app; não consulta a nuvem se não precisar.
   */
  const sincronizar = useCallback(
    async (automatico: boolean) => {
      const u = usuarioRef.current;
      if (!u || !supabase) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      try {
        const local = await exportar(db);
        const localVazio = vazio(local);
        const jaSincronizou = kv.ler(chaveSincronizado(u.id)) === '1';
        if (automatico && localVazio) return;
        if (jaSincronizou && !localVazio) {
          await gravarNuvem(u.id, local);
          setErro(null);
          return;
        }
        const nuvem = await lerNuvem(u.id);
        const acao = decidir({ localVazio, nuvemVazia: vazio(nuvem?.dados), jaSincronizou });
        if (acao === 'enviar') await gravarNuvem(u.id, local);
        else if (acao === 'perguntar' && nuvem) {
          setPendencia({ atualizadoEm: nuvem.atualizado_em, aparelho: nuvem.aparelho, aparelhoTemDados: !localVazio });
        } else kv.gravar(chaveSincronizado(u.id), '1');
        setErro(null);
      } catch (e) {
        setErro(mensagem(e));
      }
    },
    [db, gravarNuvem, lerNuvem],
  );

  // Sessão salva: carrega, e sai sozinho depois de 30 dias sem abrir o app.
  useEffect(() => {
    if (!supabase) return;
    const ultimoUso = Number(kv.ler(CHAVE_ULTIMO_USO) ?? 0);
    const expirou = ultimoUso > 0 && Date.now() - ultimoUso > DIAS_SEM_USO_PARA_SAIR * 86_400_000;
    kv.gravar(CHAVE_ULTIMO_USO, String(Date.now()));

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && expirou) supabase!.auth.signOut({ scope: 'local' });
    });

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      const u = sessao?.user;
      const novo = u ? { id: u.id, email: u.email ?? '' } : null;
      setUsuario((antes) => (antes?.id === novo?.id ? antes : novo));
      setUltimoBackup(novo ? kv.ler(chaveUltimoBackup(novo.id)) : null);
      if (!novo) setPendencia(null);
      // Não chamar o Supabase dentro deste callback (trava a sessão); agenda para depois.
      if (evento === 'SIGNED_IN' && novo) setTimeout(() => sincronizar(false), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [sincronizar]);

  // Backup automático 30 s depois da última alteração.
  useEffect(
    () =>
      aoAlterar(() => {
        if (!usuarioRef.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => sincronizar(true), ESPERA_BACKUP_MS);
      }),
    [aoAlterar, sincronizar],
  );

  // Ao mandar o app para segundo plano, envia o que estiver esperando.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') kv.gravar(CHAVE_ULTIMO_USO, String(Date.now()));
      else if (timer.current) sincronizar(true);
    });
    return () => sub.remove();
  }, [sincronizar]);

  const comOcupado = useCallback(async (fn: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro(mensagem(e));
      throw e;
    } finally {
      setOcupado(false);
    }
  }, []);

  const conta = useMemo<Conta>(
    () => ({
      disponivel: supabaseConfigurado,
      usuario,
      ultimoBackup,
      ocupado,
      erro,
      pendencia,
      podeDesfazer,
      pedirCodigo: (email) =>
        comOcupado(async () => {
          const { error } = await supabase!.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
          if (error) throw error;
        }),
      confirmarCodigo: (email, codigo) =>
        comOcupado(async () => {
          const { error } = await supabase!.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.trim(), type: 'email' });
          if (error) throw error;
          kv.gravar(CHAVE_ULTIMO_USO, String(Date.now()));
        }),
      sair: () =>
        comOcupado(async () => {
          await sincronizar(true);
          await supabase!.auth.signOut({ scope: 'local' });
        }),
      fazerBackupAgora: () => comOcupado(() => sincronizar(false)),
      restaurar: () =>
        comOcupado(async () => {
          const u = usuarioRef.current!;
          const nuvem = await lerNuvem(u.id);
          if (!nuvem || vazio(nuvem.dados)) throw new Error('Não há backup na nuvem para restaurar.');
          const local = await exportar(db);
          // Guarda o que estava no aparelho, para poder desfazer.
          if (!vazio(local)) {
            const { error } = await supabase!.from('backups').update({ dados_anterior: local }).eq('user_id', u.id);
            if (error) throw error;
          }
          await importar(db, nuvem.dados);
          marcarSincronizado(u.id, nuvem.atualizado_em);
          setPendencia(null);
          setPodeDesfazer(!vazio(local));
        }),
      manterDoAparelho: () =>
        comOcupado(async () => {
          const u = usuarioRef.current!;
          const nuvem = await lerNuvem(u.id);
          // O que estava na nuvem vira a cópia anterior.
          await gravarNuvem(u.id, await exportar(db), nuvem?.dados ?? null);
          setPendencia(null);
        }),
      desfazerRestauracao: () =>
        comOcupado(async () => {
          const u = usuarioRef.current!;
          const { data, error } = await supabase!.from('backups').select('dados_anterior').eq('user_id', u.id).single();
          if (error) throw error;
          if (!data?.dados_anterior) throw new Error('Não há cópia anterior guardada.');
          await importar(db, data.dados_anterior as Instantaneo);
          await gravarNuvem(u.id, await exportar(db));
          setPodeDesfazer(false);
        }),
      apagarConta: (apagarDoAparelho) =>
        comOcupado(async () => {
          const u = usuarioRef.current!;
          if (timer.current) clearTimeout(timer.current);
          timer.current = null;
          const { error } = await supabase!.functions.invoke('apagar-conta', { method: 'POST' });
          if (error) throw error;
          kv.gravar(chaveSincronizado(u.id), null);
          kv.gravar(chaveUltimoBackup(u.id), null);
          await supabase!.auth.signOut({ scope: 'local' });
          if (apagarDoAparelho) await importar(db, { versaoEsquema: VERSAO, tabelas: {} });
        }),
    }),
    [usuario, ultimoBackup, ocupado, erro, pendencia, podeDesfazer, comOcupado, sincronizar, lerNuvem, gravarNuvem, db],
  );

  return <ContaContexto.Provider value={conta}>{children}</ContaContexto.Provider>;
}

export function useConta(): Conta {
  const conta = useContext(ContaContexto);
  if (!conta) throw new Error('useConta precisa estar dentro de ContaProvider');
  return conta;
}

function nomeAparelho(): string {
  if (Platform.OS !== 'web') return Platform.OS === 'ios' ? 'iPhone' : 'Android';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'Computador';
}

/** Mensagens do Supabase em português, para mostrar na tela. */
function mensagem(e: unknown): string {
  const texto = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  if (/expired|invalid/i.test(texto) && /token|otp/i.test(texto)) return 'Código errado ou vencido. Peça um novo.';
  if (/rate limit|security purposes/i.test(texto)) return 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.';
  if (/fetch|network|Failed to/i.test(texto)) return 'Sem conexão com a internet. Tente de novo mais tarde.';
  return texto;
}
