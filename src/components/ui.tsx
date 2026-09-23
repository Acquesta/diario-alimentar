import { useBanco } from '@/lib/banco';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';
import { lerConfig, salvarConfig } from '@/lib/db';

const claro = {
  fundo: '#F6F7F4',
  cartao: '#FFFFFF',
  texto: '#1D2320',
  suave: '#66706B',
  borda: '#E3E6E1',
  primaria: '#2F7D5B',
  sobrePrimaria: '#FFFFFF',
  primariaSuave: '#E3F1EA',
  perigo: '#B3261E',
  proteina: '#3D6FD9',
  carboidrato: '#D98A1F',
  gordura: '#A34FC2',
  excesso: '#C9472B',
};

export type Cores = typeof claro;

const escuro: Cores = {
  fundo: '#0F1412',
  cartao: '#1A211E',
  texto: '#E8ECEA',
  suave: '#9AA5A0',
  borda: '#2A332F',
  primaria: '#5CC08F',
  sobrePrimaria: '#0F1412',
  primariaSuave: '#1F3A2E',
  perigo: '#F2B8B5',
  proteina: '#7FA3F0',
  carboidrato: '#F0B35A',
  gordura: '#CB8BE0',
  excesso: '#F08A6E',
};

/** Manrope em tudo: os pesos fazem a hierarquia, sem trocar de família. */
const FONTE = {
  normal: 'Manrope_400Regular',
  medio: 'Manrope_500Medium',
  forte: 'Manrope_600SemiBold',
  numero: 'Manrope_700Bold',
};

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';

type Tema = {
  cores: Cores;
  estilos: ReturnType<typeof criarEstilos>;
  escuro: boolean;
  preferencia: PreferenciaTema;
  setPreferencia: (p: PreferenciaTema) => void;
};

const TemaContexto = createContext<Tema | null>(null);

const ESTILOS_CLARO = criarEstilos(claro);
const ESTILOS_ESCURO = criarEstilos(escuro);

/** Tema do app: segue o sistema do aparelho, ou a escolha salva no perfil. */
export function TemaProvider({ children }: { children: ReactNode }) {
  const db = useBanco();
  const sistema = useColorScheme();
  const [preferencia, setPreferenciaEstado] = useState<PreferenciaTema>('sistema');

  useEffect(() => {
    lerConfig(db, 'tema').then((v) => {
      if (v === 'claro' || v === 'escuro' || v === 'sistema') setPreferenciaEstado(v);
    });
  }, [db]);

  const ehEscuro = preferencia === 'sistema' ? sistema === 'dark' : preferencia === 'escuro';

  const tema = useMemo<Tema>(
    () => ({
      cores: ehEscuro ? escuro : claro,
      estilos: ehEscuro ? ESTILOS_ESCURO : ESTILOS_CLARO,
      escuro: ehEscuro,
      preferencia,
      setPreferencia: (p) => {
        setPreferenciaEstado(p);
        salvarConfig(db, 'tema', p);
      },
    }),
    [ehEscuro, preferencia, db],
  );

  return <TemaContexto.Provider value={tema}>{children}</TemaContexto.Provider>;
}

export function useTema(): Tema {
  const tema = useContext(TemaContexto);
  if (!tema) throw new Error('useTema precisa estar dentro de TemaProvider');
  return tema;
}

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { estilos } = useTema();
  return <View style={[estilos.cartao, style]}>{children}</View>;
}

export function Botao({
  titulo,
  onPress,
  tipo = 'primario',
  desabilitado,
}: {
  titulo: string;
  onPress: () => void;
  tipo?: 'primario' | 'secundario' | 'contorno';
  desabilitado?: boolean;
}) {
  const { cores, estilos } = useTema();
  const primario = tipo === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      disabled={desabilitado}
      style={({ pressed }) => [
        estilos.botao,
        primario ? estilos.botaoPrimario : tipo === 'contorno' ? estilos.botaoContorno : estilos.botaoSecundario,
        (pressed || desabilitado) && { opacity: desabilitado ? 0.4 : 0.8 },
      ]}
    >
      <Text style={[estilos.botaoTexto, { color: primario ? cores.sobrePrimaria : cores.primaria }]}>{titulo}</Text>
    </Pressable>
  );
}

/**
 * Barra flutuante de desfazer, usada depois de remover algo.
 * Translúcida, para não tapar o que está embaixo enquanto some sozinha.
 */
export function AvisoDesfazer({ texto, onDesfazer }: { texto: string; onDesfazer: () => void }) {
  const { cores, escuro, estilos } = useTema();
  return (
    <BlurView
      intensity={40}
      tint={escuro ? 'light' : 'dark'}
      accessibilityLiveRegion="polite"
      style={[estilos.aviso, { backgroundColor: cores.texto + 'E0' }]}
    >
      <Text style={{ flex: 1, color: cores.fundo, fontSize: 15, fontFamily: FONTE.normal }} numberOfLines={1}>
        {texto}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Desfazer remoção" hitSlop={8} onPress={onDesfazer}>
        <Text style={{ color: cores.fundo, fontFamily: FONTE.forte, textDecorationLine: 'underline' }}>Desfazer</Text>
      </Pressable>
    </BlurView>
  );
}

export function Chip({ texto, ativo, onPress }: { texto: string; ativo?: boolean; onPress: () => void }) {
  const { cores, estilos } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ selected: ativo }}
      onPress={onPress}
      style={[estilos.chip, ativo && estilos.chipAtivo]}
    >
      <Text style={[estilos.chipTexto, ativo && { color: cores.sobrePrimaria }]}>{texto}</Text>
    </Pressable>
  );
}

/** Barra de progresso de um nutriente contra a meta. */
export function Barra({
  rotulo,
  valor,
  meta,
  cor,
  unidade = 'g',
}: {
  rotulo: string;
  valor: number;
  meta: number;
  cor: string;
  unidade?: string;
}) {
  const { cores, estilos } = useTema();
  const fracao = meta > 0 ? Math.min(valor / meta, 1) : 0;
  const passou = meta > 0 && valor > meta;
  return (
    <View style={{ gap: 4 }}>
      <View style={estilos.linhaEntre}>
        <Text style={estilos.rotuloBarra}>{rotulo}</Text>
        <Text style={[estilos.valorBarra, passou && { color: cores.excesso }]}>
          {formatar(valor)} / {formatar(meta)} {unidade}
        </Text>
      </View>
      <View style={estilos.trilho}>
        <View style={[estilos.preenchido, { width: `${fracao * 100}%`, backgroundColor: passou ? cores.excesso : cor }]} />
      </View>
    </View>
  );
}

// Criado uma vez só: Intl.NumberFormat é caro de instanciar.
const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, useGrouping: false });

/** Número no formato brasileiro, com no máximo uma casa decimal (ex.: 42,2). */
export function formatar(n: number): string {
  return NUMERO.format(n);
}

function criarEstilos(cores: Cores) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    // O fim da lista respira acima da barra de abas, que é translúcida e flutua por cima.
    conteudo: { padding: 16, gap: 12, paddingBottom: 110, maxWidth: 560, width: '100%', alignSelf: 'center' },
    cartao: {
      backgroundColor: cores.cartao,
      borderRadius: 14,
      borderCurve: 'continuous',
      padding: 16,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cores.borda,
    },
    titulo: { fontSize: 17, fontFamily: FONTE.forte, color: cores.texto },
    /** Números grandes (kcal) com largura fixa, para não "pular" quando mudam. */
    numero: { fontSize: 44, lineHeight: 50, fontFamily: FONTE.numero, letterSpacing: -0.8, color: cores.texto, fontVariant: ['tabular-nums'] },
    /** Número de apoio, menor que o principal mas maior que o texto. */
    numeroMedio: { fontSize: 22, lineHeight: 28, fontFamily: FONTE.numero, color: cores.texto, fontVariant: ['tabular-nums'] },
    texto: { fontSize: 15, lineHeight: 21, fontFamily: FONTE.normal, color: cores.texto },
    suave: { fontSize: 13, lineHeight: 18, fontFamily: FONTE.normal, color: cores.suave },
    linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    botao: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center' },
    botaoPrimario: { backgroundColor: cores.primaria },
    botaoSecundario: { backgroundColor: cores.primariaSuave },
    /** Ação repetida dentro de um cartão: contorno, para não competir com os dados. */
    botaoContorno: { backgroundColor: 'transparent', borderWidth: 1, borderColor: cores.borda },
    botaoTexto: { fontSize: 15, fontFamily: FONTE.forte },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: cores.cartao,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
    chipTexto: { fontSize: 14, fontFamily: FONTE.medio, color: cores.texto },
    input: {
      backgroundColor: cores.cartao,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: 10,
      borderCurve: 'continuous',
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      fontFamily: FONTE.normal,
      color: cores.texto,
    },
    aviso: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 96,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderCurve: 'continuous',
      overflow: 'hidden',
    },
    rotuloBarra: { fontSize: 13, fontFamily: FONTE.normal, color: cores.suave },
    valorBarra: { fontSize: 13, fontFamily: FONTE.medio, color: cores.texto, fontVariant: ['tabular-nums'] },
    trilho: { height: 8, borderRadius: 4, backgroundColor: cores.borda, overflow: 'hidden' },
    preenchido: { height: 8, borderRadius: 4 },
  });
}
