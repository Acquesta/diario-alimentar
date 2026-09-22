import { router, Stack, useLocalSearchParams } from 'expo-router';
import { voltar } from '@/lib/navegacao';
import { useBanco } from '@/lib/banco';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, formatar, useTema } from '@/components/ui';
import { itensDaRefeicao, listarPersonalizados, listarPratos, removerPrato, salvarPrato, type ItemPrato } from '@/lib/db';
import { ALIMENTOS_TACO, chave, nomeRefeicao, REFEICOES, type Alimento, type Refeicao } from '@/lib/foods';
import { porcao, somar } from '@/lib/nutrition';
import { buscar } from '@/lib/search';

/**
 * Criar ou editar um prato pronto.
 * Params: `id` edita um prato existente; `data` + `refeicao` começa com os itens já registrados nessa refeição.
 */
export default function TelaPrato() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const params = useLocalSearchParams<{ id?: string; data?: string; refeicao?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [nome, setNome] = useState('');
  const [itens, setItens] = useState<(ItemPrato & { texto: string })[]>([]);
  const [consulta, setConsulta] = useState('');
  const [personalizados, setPersonalizados] = useState<Alimento[]>([]);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    (async () => {
      setPersonalizados(await listarPersonalizados(db));
      if (id) {
        const prato = (await listarPratos(db)).find((p) => p.id === id);
        if (prato) {
          setNome(prato.nome);
          setItens(prato.itens.map((i) => ({ ...i, texto: String(i.gramas) })));
        }
      } else if (params.data && params.refeicao) {
        const refeicao = REFEICOES.find((r) => r.id === params.refeicao)?.id as Refeicao | undefined;
        if (refeicao) {
          const doDia = await itensDaRefeicao(db, params.data, refeicao);
          setItens(doDia.map((i) => ({ ...i, texto: String(i.gramas) })));
          setNome(`Meu ${nomeRefeicao(refeicao).toLowerCase()}`);
        }
      }
    })();
  }, [db, id, params.data, params.refeicao]);

  const todos = useMemo(() => [...personalizados, ...ALIMENTOS_TACO], [personalizados]);
  const resultados = consulta.trim() ? buscar(todos, consulta, 8) : [];

  const gramasDe = (t: string) => Number(t.replace(',', '.'));
  const itensValidos = itens.every((i) => gramasDe(i.texto) > 0 && gramasDe(i.texto) <= 5000);
  const total = somar(itens.map((i) => porcao(i.alimento, itensValidos ? gramasDe(i.texto) : 0)));
  const valido = nome.trim().length > 0 && itens.length > 0 && itensValidos;

  const atualizarTexto = (indice: number, texto: string) =>
    setItens((lista) => lista.map((i, k) => (k === indice ? { ...i, texto } : i)));

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: id ? 'Editar prato' : 'Novo prato' }} />

      <Cartao>
        <Text style={estilos.suave}>Nome do prato</Text>
        <TextInput
          style={estilos.input}
          value={nome}
          onChangeText={setNome}
          placeholder="ex.: Almoço de sempre…"
          placeholderTextColor={cores.suave}
          accessibilityLabel="Nome do prato"
        />
      </Cartao>

      <Cartao>
        <View style={estilos.linhaEntre}>
          <Text style={estilos.titulo}>Ingredientes</Text>
          <Text style={estilos.suave}>{total.kcal} kcal</Text>
        </View>

        {itens.length === 0 ? <Text style={estilos.suave}>Busque abaixo e toque para adicionar. Ex.: arroz, feijão, frango.</Text> : null}

        {itens.map((item, k) => {
          const g = gramasDe(item.texto);
          const m = porcao(item.alimento, g > 0 ? g : 0);
          return (
            <View key={`${chave(item.alimento)}-${k}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.texto}>{item.alimento.nome}</Text>
                <Text style={estilos.suave}>{m.kcal} kcal</Text>
              </View>
              <TextInput
                style={[estilos.input, { width: 72, textAlign: 'right' }]}
                value={item.texto}
                onChangeText={(t) => atualizarTexto(k, t)}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel={`Gramas de ${item.alimento.nome}`}
              />
              <Text style={estilos.suave}>g</Text>
              <Pressable
                onPress={() => setItens((lista) => lista.filter((_, j) => j !== k))}
                accessibilityRole="button"
                accessibilityLabel={`Tirar ${item.alimento.nome}`}
                hitSlop={8}
              >
                <Text style={{ fontSize: 20, color: cores.suave, paddingHorizontal: 4 }}>×</Text>
              </Pressable>
            </View>
          );
        })}

        <TextInput
          style={[estilos.input, { marginTop: 4 }]}
          value={consulta}
          onChangeText={setConsulta}
          placeholder="+ Buscar ingrediente, ex.: feijão…"
          placeholderTextColor={cores.suave}
          autoCorrect={false}
          accessibilityLabel="Buscar ingrediente"
        />
        {resultados.map((a) => (
          <Pressable
            key={chave(a)}
            onPress={() => {
              setItens((lista) => [...lista, { alimento: a, gramas: 100, texto: '100' }]);
              setConsulta('');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Adicionar ${a.nome}`}
            style={({ pressed }) => [{ paddingVertical: 8 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={estilos.texto}>{a.nome}</Text>
            <Text style={estilos.suave}>{a.kcal} kcal por 100 g</Text>
          </Pressable>
        ))}
        {consulta.trim() !== '' && resultados.length === 0 ? (
          <Text style={estilos.suave}>Nada encontrado para “{consulta}”.</Text>
        ) : null}
      </Cartao>

      {itens.length > 0 ? (
        <Cartao>
          <Text style={estilos.titulo}>Total do prato</Text>
          <Text style={[estilos.numero, { color: cores.primaria }]}>{total.kcal} kcal</Text>
          <Text style={estilos.suave}>
            Proteína {formatar(total.proteina)} g · Carboidrato {formatar(total.carboidrato)} g · Gordura {formatar(total.gordura)} g
          </Text>
        </Cartao>
      ) : null}

      <Botao
        titulo="Salvar prato"
        desabilitado={!valido}
        onPress={async () => {
          await salvarPrato(db, {
            id,
            nome: nome.trim(),
            itens: itens.map((i) => ({ alimento: i.alimento, gramas: gramasDe(i.texto) })),
          });
          voltar();
        }}
      />

      {id !== undefined &&
        (confirmarExclusao ? (
          <View style={{ gap: 8 }}>
            <Text style={[estilos.suave, { textAlign: 'center' }]}>Excluir “{nome}”? O que já foi registrado no diário continua.</Text>
            <Botao
              titulo="Sim, excluir prato"
              tipo="secundario"
              onPress={async () => {
                await removerPrato(db, id);
                voltar();
              }}
            />
            <Botao titulo="Cancelar" tipo="secundario" onPress={() => setConfirmarExclusao(false)} />
          </View>
        ) : (
          <Botao titulo="Excluir prato" tipo="secundario" onPress={() => setConfirmarExclusao(true)} />
        ))}
    </ScrollView>
  );
}
