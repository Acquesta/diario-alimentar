import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { voltar } from '@/lib/navegacao';
import { useBanco } from '@/lib/banco';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Ajuda, Botao, Cartao, Chip, formatar, useTema } from '@/components/ui';
import { hoje } from '@/lib/dates';
import {
  criarPersonalizado,
  desfavoritar,
  favoritar,
  listarFavoritos,
  listarPersonalizados,
  listarPratos,
  maisUsados,
  personalizadoPorCodigo,
  registrar,
  registrarPrato,
  type Favorito,
  type Prato,
} from '@/lib/db';
import { ALIMENTOS_BASE, chave, nomeRefeicao, NOME_ORIGEM, REFEICOES, type Alimento, type Refeicao } from '@/lib/foods';
import { alimentoDoProduto, buscarPorNome, type Produto } from '@/lib/openfoodfacts';
import { porcao, somar } from '@/lib/nutrition';
import { buscar } from '@/lib/search';

const PORCOES = [50, 100, 150, 200, 300];

type Sugestao = { alimento: Alimento; gramas: number };

export default function Adicionar() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const params = useLocalSearchParams<{ data?: string; refeicao?: string; escolher?: string }>();
  const data = params.data ?? hoje();
  const refeicaoInicial = (REFEICOES.find((r) => r.id === params.refeicao)?.id ?? 'almoco') as Refeicao;

  const [refeicao, setRefeicao] = useState<Refeicao>(refeicaoInicial);
  const [consulta, setConsulta] = useState('');
  const [personalizados, setPersonalizados] = useState<Alimento[]>([]);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [recentes, setRecentes] = useState<Favorito[]>([]);
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [selecionado, setSelecionado] = useState<Sugestao | null>(null);
  const [online, setOnline] = useState<{ termo: string; produtos: Produto[] } | null>(null);
  const [procurandoOnline, setProcurandoOnline] = useState(false);
  const [erroOnline, setErroOnline] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [p, f, r, pr] = await Promise.all([
          listarPersonalizados(db),
          listarFavoritos(db),
          maisUsados(db),
          listarPratos(db),
        ]);
        setPersonalizados(p);
        setFavoritos(f);
        setRecentes(r);
        setPratos(pr);
      })();
    }, [db]),
  );

  // Volta do leitor de código de barras já com o alimento escolhido.
  const jaEscolheu = useRef(false);
  useEffect(() => {
    if (!params.escolher || jaEscolheu.current) return;
    const alimento = [...personalizados, ...ALIMENTOS_BASE].find((a) => chave(a) === params.escolher);
    if (!alimento) return;
    jaEscolheu.current = true;
    setSelecionado({ alimento, gramas: 100 });
  }, [params.escolher, personalizados]);

  const todos = useMemo(() => [...personalizados, ...ALIMENTOS_BASE], [personalizados]);
  const porChave = useMemo(() => new Map(todos.map((a) => [chave(a), a])), [todos]);
  const favoritosSet = useMemo(() => new Set(favoritos.map((f) => `${f.origem}:${f.alimentoId}`)), [favoritos]);

  const resolver = (lista: Favorito[]): Sugestao[] =>
    lista.flatMap((f) => {
      const alimento = porChave.get(`${f.origem}:${f.alimentoId}`);
      return alimento ? [{ alimento, gramas: f.gramas }] : [];
    });

  /** Produto de marca encontrado na internet vira alimento salvo no aparelho. */
  const usarProduto = async (produto: Produto) => {
    const salvo = await personalizadoPorCodigo(db, produto.codigo);
    const alimento =
      salvo ??
      (await criarPersonalizado(db, {
        nome: alimentoDoProduto(produto, 0).nome,
        kcal: produto.kcal,
        proteina: produto.proteina,
        carboidrato: produto.carboidrato,
        gordura: produto.gordura,
        codigoBarras: produto.codigo,
      }));
    setPersonalizados(await listarPersonalizados(db));
    setSelecionado({ alimento, gramas: 100 });
  };

  const procurarOnline = async () => {
    const termo = consulta.trim();
    setProcurandoOnline(true);
    setErroOnline(null);
    const r = await buscarPorNome(termo);
    setProcurandoOnline(false);
    if (r.tipo === 'achados') setOnline({ termo, produtos: r.produtos });
    else if (r.tipo === 'vazio') setErroOnline(`Nenhum produto de marca para “${termo}”.`);
    else setErroOnline('Sem conexão com a internet para procurar produtos de marca.');
  };

  const resultados: Sugestao[] = consulta.trim()
    ? buscar(todos, consulta).map((alimento) => ({ alimento, gramas: 100 }))
    : [];
  const sugestoesFavoritos = resolver(favoritos);
  const sugestoesRecentes = resolver(recentes).filter((s) => !favoritosSet.has(chave(s.alimento)));

  if (selecionado) {
    return (
      <Porcao
        sugestao={selecionado}
        refeicao={refeicao}
        favorito={favoritosSet.has(chave(selecionado.alimento))}
        onVoltar={() => setSelecionado(null)}
        onFavoritar={async (gramas, ligar) => {
          if (ligar) await favoritar(db, selecionado.alimento, gramas);
          else await desfavoritar(db, selecionado.alimento);
          setFavoritos(await listarFavoritos(db));
        }}
        onConfirmar={async (gramas) => {
          await registrar(db, data, refeicao, selecionado.alimento, gramas);
          voltar();
        }}
      />
    );
  }

  return (
    <View style={estilos.tela}>
      <View style={[estilos.conteudo, { paddingBottom: 8 }]}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {REFEICOES.map((r) => (
            <Chip key={r.id} texto={r.nome} ativo={r.id === refeicao} onPress={() => setRefeicao(r.id)} />
          ))}
        </View>
        <TextInput
          style={estilos.input}
          placeholder="Buscar alimento, ex.: arroz, frango…"
          placeholderTextColor={cores.suave}
          value={consulta}
          onChangeText={(t) => {
            setConsulta(t);
            setOnline(null);
            setErroOnline(null);
          }}
          autoCorrect={false}
          accessibilityLabel="Buscar alimento"
        />
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={[estilos.conteudo, { paddingTop: 4 }]}
        keyboardShouldPersistTaps="handled"
        data={consulta.trim() ? resultados : []}
        keyExtractor={(s) => chave(s.alimento)}
        renderItem={({ item }) => <Linha sugestao={item} onPress={() => setSelecionado(item)} />}
        ListHeaderComponent={
          consulta.trim() ? null : (
            <View style={{ gap: 12 }}>
              <MeusPratos
                pratos={pratos}
                refeicao={refeicao}
                onRegistrar={async (prato) => {
                  await registrarPrato(db, data, refeicao, prato);
                  voltar();
                }}
              />
              <Lista titulo="Favoritos" itens={sugestoesFavoritos} onEscolher={setSelecionado} />
              <Lista titulo="Usados recentemente" itens={sugestoesRecentes} onEscolher={setSelecionado} />
              {sugestoesFavoritos.length === 0 && sugestoesRecentes.length === 0 ? (
                <Text style={estilos.suave}>
                  Busque pelo nome. São {ALIMENTOS_BASE.length} alimentos: pratos prontos da tabela do IBGE e
                  ingredientes da TACO.
                </Text>
              ) : null}
            </View>
          )
        }
        ListEmptyComponent={
          consulta.trim() ? <Text style={estilos.suave}>Nada encontrado para “{consulta}”.</Text> : null
        }
        ListFooterComponent={
          <View style={{ marginTop: 8, gap: 8 }}>
            {consulta.trim().length >= 3 ? (
              <ProdutosDeMarca
                produtos={online?.termo === consulta.trim() ? online.produtos : null}
                procurando={procurandoOnline}
                erro={erroOnline}
                onProcurar={procurarOnline}
                onEscolher={usarProduto}
              />
            ) : null}
            <Botao
              titulo="Estimar por foto"
              tipo="secundario"
              onPress={() => router.push({ pathname: '/estimar-foto', params: { data, refeicao } })}
            />
            <Botao
              titulo="Ler código de barras"
              tipo="secundario"
              onPress={() => router.push({ pathname: '/codigo-barras', params: { data, refeicao } })}
            />
            <Botao
              titulo="Cadastrar alimento pelo rótulo"
              tipo="secundario"
              onPress={() => router.push({ pathname: '/novo-alimento', params: { nome: consulta } })}
            />
          </View>
        }
      />
    </View>
  );
}

/** Busca no Open Food Facts, para quando a base local não tem o produto. */
function ProdutosDeMarca({
  produtos,
  procurando,
  erro,
  onProcurar,
  onEscolher,
}: {
  produtos: Produto[] | null;
  procurando: boolean;
  erro: string | null;
  onProcurar: () => void;
  onEscolher: (p: Produto) => void;
}) {
  const { cores, estilos } = useTema();

  if (procurando) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <ActivityIndicator color={cores.primaria} />
        <Text style={estilos.suave}>Procurando produtos de marca…</Text>
      </View>
    );
  }

  if (produtos) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={[estilos.suave, { fontWeight: '600' }]}>Produtos de marca</Text>
        {produtos.map((p) => (
          <Pressable
            key={p.codigo}
            onPress={() => onEscolher(p)}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.cartao, { paddingVertical: 12, gap: 2 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={estilos.texto}>{p.marca ? `${p.nome} (${p.marca})` : p.nome}</Text>
            <Text style={estilos.suave}>
              100 g · {p.kcal} kcal · Open Food Facts
            </Text>
          </Pressable>
        ))}
        <Ajuda
          texto={
            'Confira com o rótulo: a base é aberta e às vezes tem valor errado. O escolhido fica salvo no aparelho.'
          }
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {erro ? <Text style={estilos.suave}>{erro}</Text> : null}
      <Botao titulo="Procurar em produtos de marca" tipo="secundario" onPress={onProcurar} />
    </View>
  );
}

function MeusPratos({
  pratos,
  refeicao,
  onRegistrar,
}: {
  pratos: Prato[];
  refeicao: Refeicao;
  onRegistrar: (p: Prato) => void;
}) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ gap: 8 }}>
      <View style={estilos.linhaEntre}>
        <Text style={[estilos.suave, { fontWeight: '600' }]}>Meus pratos</Text>
        <Pressable
          onPress={() => router.push('/prato')}
          accessibilityRole="button"
          accessibilityLabel="Criar prato"
          hitSlop={8}
        >
          <Text style={{ color: cores.primaria, fontWeight: '600' }}>+ Criar prato</Text>
        </Pressable>
      </View>
      {pratos.length === 0 ? (
        <Ajuda
          texto={'Monte uma vez o que você come sempre (ex.: arroz + feijão + frango) e registre tudo em um toque.'}
        />
      ) : null}
      {pratos.map((p) => {
        const total = somar(p.itens.map((i) => porcao(i.alimento, i.gramas)));
        return (
          <View key={p.id} style={[estilos.cartao, { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <Pressable
              onPress={() => onRegistrar(p)}
              accessibilityRole="button"
              accessibilityLabel={`Adicionar ${p.nome} ao ${nomeRefeicao(refeicao).toLowerCase()}`}
              style={({ pressed }) => [{ flex: 1, minWidth: 0, gap: 2 }, pressed && { opacity: 0.6 }]}
            >
              <Text style={estilos.texto}>{p.nome}</Text>
              <Text style={estilos.suave} numberOfLines={1}>
                {total.kcal} kcal · {p.itens.map((i) => i.alimento.nome.split(',')[0]).join(' + ')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/prato', params: { id: String(p.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${p.nome}`}
              hitSlop={8}
            >
              <Text style={{ color: cores.primaria }}>Editar</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function Lista({ titulo, itens, onEscolher }: { titulo: string; itens: Sugestao[]; onEscolher: (s: Sugestao) => void }) {
  const { cores, estilos } = useTema();
  if (itens.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[estilos.suave, { fontWeight: '600' }]}>{titulo}</Text>
      {itens.map((s) => (
        <Linha key={chave(s.alimento)} sugestao={s} onPress={() => onEscolher(s)} />
      ))}
    </View>
  );
}

function Linha({ sugestao, onPress }: { sugestao: Sugestao; onPress: () => void }) {
  const { cores, estilos } = useTema();
  const { alimento, gramas } = sugestao;
  const m = porcao(alimento, gramas);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.cartao, { paddingVertical: 12, gap: 2 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={estilos.texto}>{alimento.nome}</Text>
      <Text style={estilos.suave}>
        {formatar(gramas)} g · {m.kcal} kcal · {alimento.categoria} · {NOME_ORIGEM[alimento.origem]}
      </Text>
    </Pressable>
  );
}

function Porcao({
  sugestao,
  refeicao,
  favorito,
  onVoltar,
  onFavoritar,
  onConfirmar,
}: {
  sugestao: Sugestao;
  refeicao: Refeicao;
  favorito: boolean;
  onVoltar: () => void;
  onFavoritar: (gramas: number, ligar: boolean) => void;
  onConfirmar: (gramas: number) => void;
}) {
  const { cores, estilos } = useTema();
  const [texto, setTexto] = useState(String(sugestao.gramas));
  const gramas = Number(texto.replace(',', '.'));
  const valido = Number.isFinite(gramas) && gramas > 0 && gramas <= 5000;
  const m = porcao(sugestao.alimento, valido ? gramas : 0);

  return (
    <View style={estilos.tela}>
      <View style={estilos.conteudo}>
        <Cartao>
          <Text style={estilos.titulo}>{sugestao.alimento.nome}</Text>
          <Text style={estilos.suave}>
            Por 100 g: {sugestao.alimento.kcal} kcal · P {formatar(sugestao.alimento.proteina)} · C{' '}
            {formatar(sugestao.alimento.carboidrato)} · G {formatar(sugestao.alimento.gordura)}
          </Text>

          <Text style={[estilos.suave, { marginTop: 8 }]}>Quantidade em gramas</Text>
          <TextInput
            style={estilos.input}
            value={texto}
            onChangeText={setTexto}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Quantidade em gramas"
          />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {PORCOES.map((g) => (
              <Chip key={g} texto={`${g} g`} ativo={gramas === g} onPress={() => setTexto(String(g))} />
            ))}
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={[estilos.titulo, { fontSize: 32 }]}>{m.kcal} kcal</Text>
            <Text style={estilos.suave}>
              Proteína {formatar(m.proteina)} g · Carboidrato {formatar(m.carboidrato)} g · Gordura {formatar(m.gordura)} g
            </Text>
          </View>

          <Botao
            titulo={`Adicionar ao ${nomeRefeicao(refeicao).toLowerCase()}`}
            desabilitado={!valido}
            onPress={() => onConfirmar(gramas)}
          />
          <Botao
            titulo={favorito ? '★ Tirar dos favoritos' : `☆ Favoritar com ${valido ? formatar(gramas) : '?'} g`}
            tipo="secundario"
            desabilitado={!valido && !favorito}
            onPress={() => onFavoritar(gramas, !favorito)}
          />
          <Botao titulo="Escolher outro alimento" tipo="secundario" onPress={onVoltar} />
        </Cartao>
      </View>
    </View>
  );
}
