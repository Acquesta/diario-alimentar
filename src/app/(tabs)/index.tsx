import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAoAlterar, useBanco } from '@/lib/banco';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AvisoDesfazer, Barra, Botao, Cartao, formatar, useTema } from '@/components/ui';
import { hoje, rotulo, somarDias } from '@/lib/dates';
import {
  lerPerfil,
  listarExercicios,
  listarRegistros,
  removerRegistro,
  repetirRefeicao,
  restaurarRegistro,
  ultimaDataDaRefeicao,
  type Registro,
} from '@/lib/db';
import { gastoDoDia } from '@/lib/exercicios';
import { REFEICOES, type Refeicao } from '@/lib/foods';
import { metaDiaria, somar, type Macros, type Perfil } from '@/lib/nutrition';

/** Tempo para desfazer uma remoção. */
const JANELA_DESFAZER_MS = 6000;

export default function Diario() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const params = useLocalSearchParams<{ data?: string }>();
  const [data, setData] = useState(params.data ?? hoje());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [anteriores, setAnteriores] = useState<Partial<Record<Refeicao, string>>>({});
  const [removido, setRemovido] = useState<Registro | null>(null);
  const [kcalExercicio, setKcalExercicio] = useState(0);

  const carregar = useCallback(async () => {
    const [regs, p, treinos] = await Promise.all([
      listarRegistros(db, data),
      lerPerfil(db),
      listarExercicios(db, data),
    ]);
    const ultimas = await Promise.all(REFEICOES.map((r) => ultimaDataDaRefeicao(db, data, r.id)));
    setRegistros(regs);
    setPerfil(p);
    setKcalExercicio(gastoDoDia(treinos));
    setAnteriores(Object.fromEntries(REFEICOES.map((r, i) => [r.id, ultimas[i] ?? undefined])));
  }, [db, data]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  // As abas ficam montadas ao mesmo tempo: recarrega quando outra aba grava algo.
  const aoAlterar = useAoAlterar();
  useEffect(() => aoAlterar(() => carregar()), [aoAlterar, carregar]);

  useEffect(() => {
    if (!removido) return;
    const t = setTimeout(() => setRemovido(null), JANELA_DESFAZER_MS);
    return () => clearTimeout(t);
  }, [removido]);

  const total = somar(registros);
  // A meta do dia é a base mais o gasto líquido dos treinos de hoje.
  const meta = perfil ? metaDiaria(perfil, kcalExercicio) : null;
  const metaBase = perfil ? metaDiaria(perfil).kcal : null;

  return (
    <View style={estilos.tela}>
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={estilos.linhaEntre}>
          <Seta texto="‹" rotuloAcessivel="Dia anterior" onPress={() => setData(somarDias(data, -1))} />
          <Pressable onPress={() => setData(hoje())} accessibilityRole="button" accessibilityLabel="Voltar para hoje">
            <Text style={[estilos.titulo, { fontSize: 20 }]}>{rotulo(data)}</Text>
          </Pressable>
          <Seta texto="›" rotuloAcessivel="Próximo dia" onPress={() => setData(somarDias(data, 1))} />
        </View>

        {!perfil && (
          <Cartao>
            <Text style={estilos.titulo}>Defina sua meta</Text>
            <Text style={estilos.suave}>
              Preencha peso, altura, idade e objetivo na aba Perfil para o app calcular sua meta diária.
            </Text>
            <Botao titulo="Ir para o Perfil" tipo="secundario" onPress={() => router.push('/perfil')} />
          </Cartao>
        )}

        <Resumo total={total} meta={meta} metaBase={metaBase} kcalExercicio={kcalExercicio} />

        {REFEICOES.map((r) => (
          <SecaoRefeicao
            key={r.id}
            nome={r.nome}
            itens={registros.filter((x) => x.refeicao === r.id)}
            anterior={anteriores[r.id]}
            onAdicionar={() => router.push({ pathname: '/adicionar', params: { data, refeicao: r.id } })}
            onSalvarPrato={() => router.push({ pathname: '/prato', params: { data, refeicao: r.id } })}
            onRepetir={async (de) => {
              await repetirRefeicao(db, de, data, r.id);
              carregar();
            }}
            onRemover={async (registro) => {
              await removerRegistro(db, registro.id);
              setRemovido(registro);
              carregar();
            }}
          />
        ))}
      </ScrollView>

      {removido ? (
        <AvisoDesfazer
          texto={`${removido.nome} removido`}
          onDesfazer={async () => {
            await restaurarRegistro(db, removido);
            setRemovido(null);
            carregar();
          }}
        />
      ) : null}
    </View>
  );
}

function Seta({ texto, rotuloAcessivel, onPress }: { texto: string; rotuloAcessivel: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      style={{ paddingHorizontal: 16, paddingVertical: 4 }}
    >
      <Text style={{ fontSize: 28, color: cores.primaria }}>{texto}</Text>
    </Pressable>
  );
}

function Resumo({
  total,
  meta,
  metaBase,
  kcalExercicio,
}: {
  total: Macros;
  meta: Macros | null;
  metaBase: number | null;
  kcalExercicio: number;
}) {
  const { cores, estilos } = useTema();
  if (!meta) {
    return (
      <Cartao>
        <Text style={estilos.numero}>{total.kcal} kcal</Text>
        <Text style={estilos.suave}>
          Proteína {formatar(total.proteina)} g · Carboidrato {formatar(total.carboidrato)} g · Gordura{' '}
          {formatar(total.gordura)} g
        </Text>
      </Cartao>
    );
  }

  const restante = meta.kcal - total.kcal;
  return (
    <Cartao>
      <View style={estilos.linhaEntre}>
        <View>
          <Text style={estilos.numero}>{total.kcal}</Text>
          <Text style={estilos.suave}>de {meta.kcal} kcal</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[estilos.numeroMedio, { color: restante < 0 ? cores.excesso : cores.primaria }]}>
            {Math.abs(restante)}
          </Text>
          <Text style={estilos.suave}>{restante < 0 ? 'kcal acima da meta' : 'kcal restantes'}</Text>
        </View>
      </View>
      {kcalExercicio > 0 && metaBase !== null ? (
        <Text style={estilos.suave}>
          Meta de hoje: base {metaBase} + exercício {kcalExercicio} = {meta.kcal} kcal
        </Text>
      ) : null}
      <Barra rotulo="Calorias" valor={total.kcal} meta={meta.kcal} cor={cores.primaria} unidade="kcal" />
      <Barra rotulo="Proteína" valor={total.proteina} meta={meta.proteina} cor={cores.proteina} />
      <Barra rotulo="Carboidrato" valor={total.carboidrato} meta={meta.carboidrato} cor={cores.carboidrato} />
      <Barra rotulo="Gordura" valor={total.gordura} meta={meta.gordura} cor={cores.gordura} />
    </Cartao>
  );
}

function SecaoRefeicao({
  nome,
  itens,
  anterior,
  onAdicionar,
  onSalvarPrato,
  onRepetir,
  onRemover,
}: {
  nome: string;
  itens: Registro[];
  anterior?: string;
  onAdicionar: () => void;
  onSalvarPrato: () => void;
  onRepetir: (de: string) => void;
  onRemover: (registro: Registro) => void;
}) {
  const { cores, estilos } = useTema();
  const kcal = somar(itens).kcal;
  return (
    <Cartao>
      <View style={estilos.linhaEntre}>
        <Text style={estilos.titulo}>{nome}</Text>
        <Text style={[estilos.suave, { fontVariant: ['tabular-nums'] }]}>{kcal} kcal</Text>
      </View>

      {itens.map((i) => (
        <View key={i.id} style={[estilos.linhaEntre, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={estilos.texto}>{i.nome}</Text>
            <Text style={estilos.suave}>
              {formatar(i.gramas)} g · {Math.round(i.kcal)} kcal · P {formatar(i.proteina)} · C {formatar(i.carboidrato)} · G{' '}
              {formatar(i.gordura)}
            </Text>
          </View>
          <Pressable
            onPress={() => onRemover(i)}
            accessibilityRole="button"
            accessibilityLabel={`Remover ${i.nome}`}
            hitSlop={8}
            style={{ paddingHorizontal: 6 }}
          >
            <Text style={{ fontSize: 20, color: cores.suave }}>×</Text>
          </Pressable>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1 }}>
          <Botao titulo="+ Adicionar" tipo="contorno" onPress={onAdicionar} />
        </View>
        {itens.length === 0 && anterior ? (
          <View style={{ flexGrow: 1 }}>
            <Botao titulo={`Repetir de ${rotulo(anterior).toLowerCase()}`} tipo="secundario" onPress={() => onRepetir(anterior)} />
          </View>
        ) : null}
        {itens.length > 1 ? (
          <View style={{ flexGrow: 1 }}>
            <Botao titulo="Salvar como prato" tipo="secundario" onPress={onSalvarPrato} />
          </View>
        ) : null}
      </View>
    </Cartao>
  );
}
