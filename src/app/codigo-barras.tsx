import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Ajuda, Botao, Cartao, formatar, useTema } from '@/components/ui';
import { useBanco } from '@/lib/banco';
import { criarPersonalizado, personalizadoPorCodigo } from '@/lib/db';
import { abrirCamera, cameraDisponivel, lerCodigo, mensagemDaCamera, type Camera } from '@/lib/leitor-codigo';
import { buscarPorCodigo, codigoValido, type Produto } from '@/lib/openfoodfacts';
import { chave, type Alimento } from '@/lib/foods';

type Estado =
  | { fase: 'parado' }
  | { fase: 'lendo' }
  | { fase: 'buscando'; codigo: string }
  | { fase: 'achado'; produto: Produto }
  | { fase: 'erro'; mensagem: string; codigo?: string };

/** Leitura do código de barras de produtos de embalagem. */
export default function TelaCodigoBarras() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const params = useLocalSearchParams<{ data?: string; refeicao?: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: 'parado' });
  const [digitado, setDigitado] = useState('');
  const video = useRef<HTMLVideoElement | null>(null);
  const camera = useRef<Camera | null>(null);
  const parar = useRef<AbortController | null>(null);

  const fecharCamera = useCallback(() => {
    parar.current?.abort();
    parar.current = null;
    camera.current?.parar();
    camera.current = null;
  }, []);

  useEffect(() => fecharCamera, [fecharCamera]);

  /** Alimento pronto: volta para a tela de adicionar já com ele escolhido. */
  const usarAlimento = useCallback(
    (alimento: Alimento) => {
      fecharCamera();
      router.replace({
        pathname: '/adicionar',
        params: { data: params.data, refeicao: params.refeicao, escolher: chave(alimento) },
      });
    },
    [fecharCamera, params.data, params.refeicao],
  );

  const tratarCodigo = useCallback(
    async (codigo: string) => {
      fecharCamera();
      setEstado({ fase: 'buscando', codigo });

      // Produto que ele já cadastrou antes funciona offline.
      const salvo = await personalizadoPorCodigo(db, codigo);
      if (salvo) {
        usarAlimento(salvo);
        return;
      }

      const r = await buscarPorCodigo(codigo);
      if (r.tipo === 'achado') setEstado({ fase: 'achado', produto: r.produto });
      else if (r.tipo === 'sem-internet') {
        setEstado({ fase: 'erro', mensagem: 'Sem conexão com a internet para consultar o produto.', codigo });
      } else {
        setEstado({
          fase: 'erro',
          mensagem:
            r.tipo === 'sem-dados'
              ? 'Este produto existe na base, mas está sem as calorias. Digite os valores do rótulo.'
              : 'Produto não encontrado na base. Digite os valores do rótulo.',
          codigo,
        });
      }
    },
    [db, fecharCamera, usarAlimento],
  );

  const comecar = useCallback(async () => {
    setEstado({ fase: 'lendo' });
    // Espera o elemento de vídeo aparecer na tela.
    await new Promise((r) => setTimeout(r, 0));
    const el = video.current;
    if (!el) return;
    try {
      camera.current = await abrirCamera(el);
    } catch (e) {
      setEstado({ fase: 'erro', mensagem: mensagemDaCamera(e) });
      return;
    }
    const controle = new AbortController();
    parar.current = controle;
    try {
      const codigo = await lerCodigo(el, controle.signal);
      if (codigo) await tratarCodigo(codigo);
    } catch {
      setEstado({ fase: 'erro', mensagem: 'A leitura falhou neste aparelho. Digite o código ou os valores do rótulo.' });
      fecharCamera();
    }
  }, [fecharCamera, tratarCodigo]);

  const cadastrarNaMao = (codigo?: string) => {
    fecharCamera();
    router.replace({ pathname: '/novo-alimento', params: { codigo } });
  };

  if (Platform.OS !== 'web' || !cameraDisponivel()) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Text style={estilos.titulo}>Câmera indisponível</Text>
          <Text style={estilos.texto}>Este aparelho ou navegador não deixa o app usar a câmera.</Text>
          <Botao titulo="Digitar os valores do rótulo" onPress={() => cadastrarNaMao()} />
        </Cartao>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {estado.fase === 'parado' && (
        <Cartao>
          <Text style={estilos.titulo}>Ler código de barras</Text>
          <Text style={estilos.texto}>Aponte a câmera para o código de barras da embalagem.</Text>
          <Ajuda
            texto={
              'O produto vem do Open Food Facts, uma base aberta e colaborativa. O iPhone pede permissão da ' +
              'câmera a cada vez; se falhar, dá para digitar o código ou os valores do rótulo.'
            }
          />
          <Botao titulo="Abrir câmera" onPress={comecar} />
        </Cartao>
      )}

      {estado.fase === 'lendo' && (
        <Cartao>
          <Text style={estilos.titulo}>Procurando o código…</Text>
          <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', aspectRatio: 4 / 3 }}>
            {/* Vídeo do navegador: a web do Expo desenha com o React DOM. */}
            <video
              ref={video}
              muted
              playsInline
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </View>
          <Text style={estilos.suave}>Mantenha o código reto e bem iluminado, a uns 15 cm da câmera.</Text>
          <Botao
            titulo="Cancelar"
            tipo="secundario"
            onPress={() => {
              fecharCamera();
              setEstado({ fase: 'parado' });
            }}
          />
        </Cartao>
      )}

      {estado.fase === 'buscando' && (
        <Cartao>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={cores.primaria} />
            <Text style={estilos.texto}>Procurando o produto {estado.codigo}…</Text>
          </View>
        </Cartao>
      )}

      {estado.fase === 'achado' && (
        <Cartao>
          <Text style={estilos.titulo}>{estado.produto.nome}</Text>
          {estado.produto.marca ? <Text style={estilos.suave}>{estado.produto.marca}</Text> : null}
          <Text style={estilos.texto}>
            Por 100 g: {estado.produto.kcal} kcal · P {formatar(estado.produto.proteina)} · C{' '}
            {formatar(estado.produto.carboidrato)} · G {formatar(estado.produto.gordura)}
          </Text>
          <Ajuda
            texto={
              'Confira com o rótulo, porque a base é aberta e às vezes tem valor errado. Ao usar, o produto ' +
              'entra em "Meus alimentos" e passa a funcionar sem internet.'
            }
          />
          <Botao
            titulo="Usar este produto"
            onPress={async () => {
              const p = estado.produto;
              const alimento = await criarPersonalizado(db, {
                nome: p.marca ? `${p.nome} (${p.marca})` : p.nome,
                kcal: p.kcal,
                proteina: p.proteina,
                carboidrato: p.carboidrato,
                gordura: p.gordura,
                codigoBarras: p.codigo,
              });
              usarAlimento(alimento);
            }}
          />
          <Botao titulo="Corrigir os valores à mão" tipo="secundario" onPress={() => cadastrarNaMao(estado.produto.codigo)} />
          <Botao titulo="Ler outro código" tipo="secundario" onPress={comecar} />
        </Cartao>
      )}

      {estado.fase === 'erro' && (
        <Cartao>
          <Text style={estilos.titulo}>Não deu certo</Text>
          <Text style={estilos.texto}>{estado.mensagem}</Text>
          <Botao titulo="Digitar os valores do rótulo" onPress={() => cadastrarNaMao(estado.codigo)} />
          <Botao titulo="Tentar a câmera de novo" tipo="secundario" onPress={comecar} />
        </Cartao>
      )}

      <Cartao>
        <Text style={estilos.titulo}>Digitar o código</Text>
        <Text style={estilos.suave}>Os números embaixo do código de barras, 8 ou 13 dígitos.</Text>
        <TextInput
          style={estilos.input}
          value={digitado}
          onChangeText={(t) => setDigitado(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={13}
          placeholder="ex.: 7891000100103…"
          placeholderTextColor={cores.suave}
          accessibilityLabel="Código de barras"
        />
        <Botao
          titulo="Procurar produto"
          desabilitado={!codigoValido(digitado) || estado.fase === 'buscando'}
          onPress={() => tratarCodigo(digitado)}
        />
      </Cartao>
    </ScrollView>
  );
}
