import { router, useLocalSearchParams } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ajuda, Botao, Cartao, formatar, useTema } from '@/components/ui';
import { useBanco } from '@/lib/banco';
import { useConta } from '@/lib/conta';
import { criarPersonalizado, registrar } from '@/lib/db';
import {
  comGramas,
  lerEstimativa,
  por100g,
  rotuloConfianca,
  totalKcal,
  type ItemEstimado,
} from '@/lib/estimativa';
import { nomeRefeicao, REFEICOES, type Refeicao } from '@/lib/foods';
import { voltar } from '@/lib/navegacao';
import { supabase } from '@/lib/supabase';
import { hoje } from '@/lib/dates';

/** Lado maior da foto enviada. Mais que isso não melhora a estimativa e pesa. */
const LADO_MAXIMO = 1024;
/**
 * Teto de espera pela função. Ela já se corta antes disso; este aqui é a rede
 * de segurança para a tela não ficar girando sem fim quando o servidor trava.
 */
const ESPERA_MAXIMA_MS = 140_000;

export default function TelaEstimarFoto() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const conta = useConta();
  const params = useLocalSearchParams<{ data?: string; refeicao?: string }>();
  const data = params.data ?? hoje();
  const refeicao = (REFEICOES.find((r) => r.id === params.refeicao)?.id ?? 'almoco') as Refeicao;

  const [foto, setFoto] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemEstimado[] | null>(null);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!conta.usuario) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Text style={estilos.titulo}>Entre na sua conta</Text>
          <Text style={estilos.texto}>
            A estimativa por foto roda num servidor, então precisa da conta do app. É o mesmo login por e-mail do
            backup.
          </Text>
          <Botao titulo="Ir para o Perfil" onPress={() => router.replace('/perfil')} />
        </Cartao>
      </ScrollView>
    );
  }

  /** Reduz a foto e manda para a Edge Function, que fala com o Gemini. */
  const estimar = async (uri: string) => {
    setPensando(true);
    setErro(null);
    setItens(null);
    try {
      const menor = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: LADO_MAXIMO } }], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      const { data: resposta, error } = await supabase!.functions.invoke('estimar-foto', {
        body: { imagem: menor.base64, tipo: 'image/jpeg' },
        timeout: ESPERA_MAXIMA_MS,
      });
      if (error) {
        const detalhe = await lerErro(error);
        setErro(detalhe ?? (abortou(error)
          ? 'A IA demorou demais para responder. Tente de novo.'
          : 'Não consegui falar com o servidor agora.'));
        return;
      }
      const lista = lerEstimativa(resposta);
      if (lista.length === 0) {
        setErro('Não achei comida nesta foto. Tente de novo, com o prato inteiro e boa luz.');
        return;
      }
      setItens(lista);
    } catch {
      setErro('Não consegui preparar a foto neste aparelho.');
    } finally {
      setPensando(false);
    }
  };

  const escolher = async (origem: 'camera' | 'galeria') => {
    setErro(null);
    const permissao =
      origem === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      setErro(
        origem === 'camera'
          ? 'Sem permissão da câmera. Libere o acesso ou escolha uma foto da galeria.'
          : 'Sem permissão para abrir suas fotos.',
      );
      return;
    }
    const r =
      origem === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (r.canceled || !r.assets[0]) return;
    setFoto(r.assets[0].uri);
    await estimar(r.assets[0].uri);
  };

  const registrarTudo = async () => {
    if (!itens) return;
    setSalvando(true);
    try {
      for (const item of itens) {
        const alimento = await criarPersonalizado(db, { ...por100g(item), codigoBarras: null });
        await registrar(db, data, refeicao, alimento, item.gramas);
      }
      voltar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {!itens && (
        <Cartao>
          <Ajuda
            titulo="Foto do prato"
            texto={
              'A IA olha a foto e estima o que tem no prato e quanto. Você confere e corrige tudo antes de ' +
              'registrar. A foto vai para o servidor só para essa estimativa e não fica guardada em lugar ' +
              'nenhum. São até 30 fotos por dia.' +
              (Platform.OS === 'web'
                ? ' No iPhone, "Tirar foto" abre a câmera e pede permissão a cada vez; se der errado, use uma foto salva.'
                : '')
            }
          />
          <Botao titulo="Tirar foto" desabilitado={pensando} onPress={() => escolher('camera')} />
          <Botao
            titulo="Escolher foto salva"
            tipo="secundario"
            desabilitado={pensando}
            onPress={() => escolher('galeria')}
          />
        </Cartao>
      )}

      {foto ? (
        <Image
          source={{ uri: foto }}
          accessibilityLabel="Foto do prato"
          style={{ width: '100%', height: 200, borderRadius: 14, backgroundColor: cores.borda }}
          resizeMode="cover"
        />
      ) : null}

      {pensando && (
        <Cartao>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={cores.primaria} />
            <Text style={estilos.texto}>Olhando a foto…</Text>
          </View>
        </Cartao>
      )}

      {erro ? (
        <Cartao>
          <Text style={estilos.texto}>{erro}</Text>
          <Botao titulo="Tentar outra foto" tipo="secundario" onPress={() => escolher('camera')} />
        </Cartao>
      ) : null}

      {itens ? (
        <>
          <Cartao>
            <View style={estilos.linhaEntre}>
              <Text style={estilos.titulo}>O que eu vi no prato</Text>
              <Text style={[estilos.suave, { fontVariant: ['tabular-nums'] }]}>{totalKcal(itens)} kcal</Text>
            </View>
            <Text style={estilos.suave}>
              Tudo aqui é estimativa. Confira as quantidades e corrija o que estiver errado antes de registrar.
            </Text>
          </Cartao>

          {itens.map((item, i) => (
            <Cartao key={`${item.nome}-${i}`}>
              <View style={estilos.linhaEntre}>
                <Text style={[estilos.texto, { flex: 1 }]}>{item.nome}</Text>
                <Pressable
                  onPress={() => setItens(itens.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={`Tirar ${item.nome} da lista`}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 20, color: cores.suave }}>×</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[estilos.input, { width: 110 }]}
                  value={String(item.gramas)}
                  onChangeText={(t) => {
                    const gramas = Number(t.replace(/\D/g, ''));
                    setItens(itens.map((x, j) => (j === i ? comGramas(x, gramas) : x)));
                  }}
                  keyboardType="number-pad"
                  accessibilityLabel={`Quantidade de ${item.nome} em gramas`}
                />
                <Text style={estilos.suave}>g</Text>
                <Text style={[estilos.texto, { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>
                  {item.kcal} kcal
                </Text>
              </View>
              <Text style={estilos.suave}>
                P {formatar(item.proteina)} · C {formatar(item.carboidrato)} · G {formatar(item.gordura)} ·{' '}
                {rotuloConfianca(item.confianca)}
              </Text>
            </Cartao>
          ))}

          <Botao
            titulo={salvando ? 'Registrando…' : `Registrar no ${nomeRefeicao(refeicao).toLowerCase()}`}
            desabilitado={salvando || itens.length === 0}
            onPress={registrarTudo}
          />
          <Botao titulo="Tirar outra foto" tipo="secundario" onPress={() => escolher('camera')} />
        </>
      ) : null}

    </ScrollView>
  );
}

/** O timeout do invoke chega como AbortError, sem corpo para ler. */
function abortou(error: unknown): boolean {
  const e = error as { name?: string; message?: string };
  return e?.name === 'AbortError' || /abort/i.test(e?.message ?? '');
}

/** A função devolve o motivo em JSON; o supabase-js embrulha isso num erro genérico. */
async function lerErro(error: unknown): Promise<string | null> {
  const contexto = (error as { context?: Response })?.context;
  if (!contexto || typeof contexto.json !== 'function') return null;
  try {
    const corpo = await contexto.json();
    return typeof corpo?.erro === 'string' ? corpo.erro : null;
  } catch {
    return null;
  }
}
