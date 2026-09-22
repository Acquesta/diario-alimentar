import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { voltar } from '@/lib/navegacao';
import { useBanco } from '@/lib/banco';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, Chip, formatar, useTema } from '@/components/ui';
import { hoje } from '@/lib/dates';
import {
  desfavoritar,
  favoritar,
  listarFavoritos,
  listarPersonalizados,
  listarPratos,
  maisUsados,
  registrar,
  registrarPrato,
  type Favorito,
  type Prato,
} from '@/lib/db';
import { ALIMENTOS_TACO, chave, nomeRefeicao, REFEICOES, type Alimento, type Refeicao } from '@/lib/foods';
import { porcao, somar } from '@/lib/nutrition';
import { buscar } from '@/lib/search';

const PORCOES = [50, 100, 150, 200, 300];

type Sugestao = { alimento: Alimento; gramas: number };

export default function Adicionar() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const params = useLocalSearchParams<{ data?: string; refeicao?: string }>();
  const data = params.data ?? hoje();
  const refeicaoInicial = (REFEICOES.find((r) => r.id === params.refeicao)?.id ?? 'almoco') as Refeicao;

  const [refeicao, setRefeicao] = useState<Refeicao>(refeicaoInicial);
  const [consulta, setConsulta] = useState('');
  const [personalizados, setPersonalizados] = useState<Alimento[]>([]);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [recentes, setRecentes] = useState<Favorito[]>([]);
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [selecionado, setSelecionado] = useState<Sugestao | null>(null);

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

  const todos = useMemo(() => [...personalizados, ...ALIMENTOS_TACO], [personalizados]);
  const porChave = useMemo(() => new Map(todos.map((a) => [chave(a), a])), [todos]);
  const favoritosSet = useMemo(() => new Set(favoritos.map((f) => `${f.origem}:${f.alimentoId}`)), [favoritos]);

  const resolver = (lista: Favorito[]): Sugestao[] =>
    lista.flatMap((f) => {
      const alimento = porChave.get(`${f.origem}:${f.alimentoId}`);
      return alimento ? [{ alimento, gramas: f.gramas }] : [];
    });

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
          onChangeText={setConsulta}
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
                  Busque pelo nome. A base tem {ALIMENTOS_TACO.length} alimentos da tabela brasileira TACO.
                </Text>
              ) : null}
            </View>
          )
        }
        ListEmptyComponent={
          consulta.trim() ? <Text style={estilos.suave}>Nada encontrado para “{consulta}”.</Text> : null
        }
        ListFooterComponent={
          <View style={{ marginTop: 8 }}>
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
        <Text style={estilos.suave}>
          Monte uma vez o que você come sempre (ex.: arroz + feijão + frango) e registre tudo em um toque.
        </Text>
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
        {formatar(gramas)} g · {m.kcal} kcal · {alimento.categoria}
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
