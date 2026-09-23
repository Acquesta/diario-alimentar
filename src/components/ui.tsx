import { useBanco } from '@/lib/banco';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';
import { lerConfig, salvarConfig } from '@/lib/db';

/**
 * Direção visual "Ferro": vocabulário de academia — grafite, aço e o amarelo
 * das anilhas. O amarelo aparece só na barra de calorias e nos números que
 * importam; o resto fica cinza e quieto, para o olho cair sempre no mesmo lugar.
 */
const claro = {
  fundo: '#EDEFF1',
  cartao: '#FFFFFF',
  texto: '#15181B',
  suave: '#5B656D',
  borda: '#D6DCE1',
  primaria: '#15181B',
  sobrePrimaria: '#F7F9FA',
  primariaSuave: '#DEE3E8',
  acento: '#F2C230',
  sobreAcento: '#15181B',
  perigo: '#B84A39',
  proteina: '#6B7780',
  carboidrato: '#8A949C',
  gordura: '#A8B1B8',
  excesso: '#B84A39',
};

export type Cores = typeof claro;

const escuro: Cores = {
  fundo: '#15181B',
  cartao: '#1F2429',
  texto: '#E8EBEE',
  suave: '#8A949C',
  borda: '#2C333A',
  primaria: '#E8EBEE',
  sobrePrimaria: '#15181B',
  primariaSuave: '#272E35',
  acento: '#F2C230',
  sobreAcento: '#15181B',
  perigo: '#E0735F',
  proteina: '#AAB4BC',
  carboidrato: '#828C94',
  gordura: '#5F6970',
  excesso: '#E0735F',
};

/** Números e títulos em Archivo Narrow; o resto em Public Sans. */
export const FONTES = {
  display: 'ArchivoNarrow_700Bold',
  texto: 'PublicSans_400Regular',
  textoMedio: 'PublicSans_500Medium',
  textoForte: 'PublicSans_600SemiBold',
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
  tipo?: 'primario' | 'secundario';
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
        primario ? estilos.botaoPrimario : estilos.botaoSecundario,
        (pressed || desabilitado) && { opacity: desabilitado ? 0.4 : 0.8 },
      ]}
    >
      <Text style={[estilos.botaoTexto, { color: primario ? cores.sobrePrimaria : cores.primaria }]}>{titulo}</Text>
    </Pressable>
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
          {numeroDaBarra(valor)} / {numeroDaBarra(meta)} {unidade}
        </Text>
      </View>
      <View style={estilos.trilho}>
        <View style={[estilos.preenchido, { width: `${fracao * 100}%`, backgroundColor: passou ? cores.excesso : cor }]} />
      </View>
    </View>
  );
}

// Criados uma vez só: Intl.NumberFormat é caro de instanciar.
const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, useGrouping: false });
const NUMERO_GRANDE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Número no formato brasileiro, com no máximo uma casa decimal (ex.: 42,2). */
export function formatar(n: number): string {
  return NUMERO.format(n);
}

/** Números grandes com separador de milhar (ex.: 2.292), para leitura rápida. */
export function formatarGrande(n: number): string {
  return NUMERO_GRANDE.format(n);
}

/** Acima de mil, separador de milhar; abaixo, uma casa decimal. */
function numeroDaBarra(n: number): string {
  return n >= 1000 ? formatarGrande(n) : formatar(n);
}

function criarEstilos(cores: Cores) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: 16, gap: 12, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
    /** Bloco comum de conteúdo. Raio maior que o do painel, para ficar abaixo dele na hierarquia. */
    cartao: {
      backgroundColor: cores.cartao,
      borderRadius: 14,
      borderCurve: 'continuous',
      padding: 16,
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cores.borda,
    },
    /** O bloco principal da tela: chapa de aço, cantos quase retos, sem borda. */
    painel: { backgroundColor: cores.cartao, borderRadius: 6, padding: 20, gap: 14 },
    titulo: { fontSize: 18, fontFamily: FONTES.textoForte, color: cores.texto },
    /** Número que manda na tela. Condensado, apertado e com dígitos de largura fixa. */
    numeroGrande: {
      fontSize: 68,
      lineHeight: 72,
      fontFamily: FONTES.display,
      color: cores.texto,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    numero: { fontSize: 40, lineHeight: 44, fontFamily: FONTES.display, color: cores.texto, fontVariant: ['tabular-nums'] },
    texto: { fontSize: 15, lineHeight: 21, fontFamily: FONTES.texto, color: cores.texto },
    suave: { fontSize: 13, lineHeight: 18, fontFamily: FONTES.texto, color: cores.suave },
    linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    botao: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 8, borderCurve: 'continuous', alignItems: 'center' },
    botaoPrimario: { backgroundColor: cores.primaria },
    botaoSecundario: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cores.borda,
    },
    botaoTexto: { fontSize: 15, fontFamily: FONTES.textoForte },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: cores.cartao,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
    chipTexto: { fontSize: 14, fontFamily: FONTES.textoMedio, color: cores.texto },
    input: {
      backgroundColor: cores.cartao,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: 8,
      borderCurve: 'continuous',
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 16,
      fontFamily: FONTES.texto,
      color: cores.texto,
    },
    rotuloBarra: { fontSize: 13, fontFamily: FONTES.texto, color: cores.suave },
    valorBarra: { fontSize: 13, fontFamily: FONTES.textoMedio, color: cores.texto, fontVariant: ['tabular-nums'] },
    trilho: { height: 6, borderRadius: 3, backgroundColor: cores.borda, overflow: 'hidden' },
    preenchido: { height: 6, borderRadius: 3 },
  });
}

