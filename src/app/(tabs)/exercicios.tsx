import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AvisoDesfazer, Botao, Cartao, Chip, formatar, useTema } from '@/components/ui';
import { useAoAlterar, useBanco } from '@/lib/banco';
import { diaDaSemana, hoje, nomeDiaDaSemana, rotulo, somarDias } from '@/lib/dates';
import {
  lerPeso,
  lerRotina,
  listarDiasComRotina,
  listarExercicios,
  registrarExercicio,
  removerExercicio,
  restaurarExercicio,
  salvarRotina,
  type RegistroExercicio,
} from '@/lib/db';
import {
  buscarExercicios,
  descrever,
  descreverItem,
  FOCOS,
  gastoDoDia,
  gastoTreino,
  INTENSIDADES,
  medidaDoTipo,
  TIPOS,
  volumeCarga,
  type ExercicioCatalogo,
  type Foco,
  type Intensidade,
  type ItemTreino,
  type TipoExercicio,
  type Treino,
} from '@/lib/exercicios';

/** Tempo para desfazer uma remoção. */
const JANELA_DESFAZER_MS = 6000;

const MINUTOS = [20, 30, 45, 60, 90];

export default function TelaExercicios() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const [data, setData] = useState(hoje());
  const [registros, setRegistros] = useState<RegistroExercicio[]>([]);
  const [pesoKg, setPesoKg] = useState<number | null>(null);
  const [removido, setRemovido] = useState<RegistroExercicio | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(async () => {
    const [regs, p] = await Promise.all([listarExercicios(db, data), lerPeso(db)]);
    setRegistros(regs);
    setPesoKg(p);
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

  const total = gastoDoDia(registros);

  return (
    <View style={estilos.tela}>
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={estilos.linhaEntre}>
          <Seta texto="‹" rotuloAcessivel="Dia anterior" onPress={() => setData(somarDias(data, -1))} />
          <Pressable onPress={() => setData(hoje())} accessibilityRole="button" accessibilityLabel="Voltar para hoje">
            <Text style={[estilos.titulo, { fontSize: 20 }]}>{rotulo(data)}</Text>
          </Pressable>
          <Seta texto="›" rotuloAcessivel="Próximo dia" onPress={() => setData(somarDias(data, 1))} />
        </View>

        <Cartao>
          <Text style={estilos.numero}>{total} kcal</Text>
          <Text style={estilos.suave}>
            {total > 0
              ? 'Gasto dos treinos de hoje. Isso soma na sua meta de calorias.'
              : 'Nenhum treino registrado hoje.'}
          </Text>
        </Cartao>

        {!pesoKg ? (
          <Cartao>
            <Text style={estilos.titulo}>Falta seu peso</Text>
            <Text style={estilos.suave}>
              O cálculo do treino usa o seu peso. Preencha o perfil primeiro.
            </Text>
            <Botao titulo="Ir para o Perfil" tipo="secundario" onPress={() => router.push('/perfil')} />
          </Cartao>
        ) : registrando ? (
          <Formulario
            data={data}
            pesoKg={pesoKg}
            onCancelar={() => setRegistrando(false)}
            onSalvar={async (treino, kcal) => {
              await registrarExercicio(db, data, {
                tipo: treino.tipo,
                intensidade: treino.intensidade,
                foco: treino.foco ?? null,
                minutos: treino.minutos,
                distanciaKm: treino.distanciaKm,
                kcal,
                itens: treino.itens,
              });
              setRegistrando(false);
              carregar();
            }}
          />
        ) : (
          <Botao titulo="Registrar treino" onPress={() => setRegistrando(true)} />
        )}

        {registros.length > 0 ? (
          <Cartao>
            <Text style={estilos.titulo}>Treinos do dia</Text>
            {registros.map((r) => (
              <View key={r.id} style={estilos.linhaEntre}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={estilos.texto}>
                    {descrever({
                      tipo: r.tipo,
                      intensidade: r.intensidade,
                      foco: r.foco,
                      minutos: r.minutos,
                      distanciaKm: r.distancia_km,
                      kcal: r.kcal,
                      itens: r.itens,
                    })}
                  </Text>
                  <Text style={estilos.suave}>{Math.round(r.kcal)} kcal</Text>
                  {r.itens?.map((i, n) => (
                    <Text key={`${r.id}-${n}`} style={estilos.suave}>
                      {descreverItem(i)}
                    </Text>
                  ))}
                </View>
                <Pressable
                  onPress={async () => {
                    await removerExercicio(db, r.id);
                    setRemovido(r);
                    carregar();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Remover treino"
                  hitSlop={8}
                  style={{ paddingHorizontal: 6 }}
                >
                  <Text style={{ fontSize: 20, color: cores.suave }}>×</Text>
                </Pressable>
              </View>
            ))}
          </Cartao>
        ) : null}
      </ScrollView>

      {removido ? (
        <AvisoDesfazer
          texto={`Treino removido`}
          onDesfazer={async () => {
            await restaurarExercicio(db, removido);
            setRemovido(null);
            carregar();
          }}
        />
      ) : null}
    </View>
  );
}

function Formulario({
  data,
  pesoKg,
  onSalvar,
  onCancelar,
}: {
  data: string;
  pesoKg: number;
  onSalvar: (treino: Treino, kcal: number) => void;
  onCancelar: () => void;
}) {
  const { cores, estilos } = useTema();
  const [tipo, setTipo] = useState<TipoExercicio>('musculacao');
  const [intensidade, setIntensidade] = useState<Intensidade>('moderado');
  const [foco, setFoco] = useState<Foco>('composto');
  const [minutos, setMinutos] = useState('45');
  const [distancia, setDistancia] = useState('5');
  const [kcalTexto, setKcalTexto] = useState('');
  const [detalhado, setDetalhado] = useState(true);
  const [itens, setItens] = useState<ItemTreino[]>([]);
  const [diasComRotina, setDiasComRotina] = useState<number[]>([]);
  const [avisoRotina, setAvisoRotina] = useState<string | null>(null);

  const db = useBanco();
  const diaDaData = diaDaSemana(data);
  const nomeDoDia = nomeDiaDaSemana(diaDaData);

  const carregarDias = useCallback(async () => setDiasComRotina(await listarDiasComRotina(db)), [db]);
  useEffect(() => {
    carregarDias();
  }, [carregarDias]);

  /** Sobe a rotina daquele dia da semana para a lista, para ele só conferir. */
  const usarRotina = async (dia: number) => {
    const rotina = await lerRotina(db, dia);
    if (!rotina) return;
    setItens(rotina.itens);
    if (rotina.minutos) setMinutos(String(rotina.minutos));
    setAvisoRotina(`Treino de ${nomeDiaDaSemana(dia)} carregado. Confira antes de salvar.`);
  };

  /** Guarda a lista de agora como o treino daquele dia da semana. */
  const guardarRotina = async () => {
    await salvarRotina(db, diaDaData, Number(minutos.replace(',', '.')) || null, itens);
    await carregarDias();
    setAvisoRotina(`Este virou o seu treino de ${nomeDoDia}.`);
  };

  const medida = medidaDoTipo(tipo);
  const n = (t: string) => Number(t.replace(',', '.'));
  const comLista = tipo === 'musculacao' && detalhado;
  const treino: Treino = {
    tipo,
    intensidade: medida === 'tempo' ? intensidade : null,
    foco: tipo === 'musculacao' && !comLista ? foco : null,
    minutos: medida === 'tempo' ? n(minutos) : null,
    distanciaKm: medida === 'distancia' ? n(distancia) : null,
    kcal: medida === 'kcal' ? n(kcalTexto) : null,
    itens: comLista ? itens : undefined,
  };
  // Lista aberta e vazia não vale o palpite do modo rápido: seria número sem base.
  const faltaExercicio = comLista && itens.length === 0;
  const kcal = faltaExercicio ? 0 : gastoTreino(treino, pesoKg);
  const volume = comLista ? volumeCarga(itens) : 0;

  return (
    <Cartao>
      <Text style={estilos.titulo}>Registrar treino</Text>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {TIPOS.map((t) => (
          <Chip key={t.id} texto={t.nome} ativo={tipo === t.id} onPress={() => setTipo(t.id)} />
        ))}
      </View>

      {tipo === 'musculacao' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Chip texto="Exercício a exercício" ativo={detalhado} onPress={() => setDetalhado(true)} />
            <Chip texto="Só o tempo" ativo={!detalhado} onPress={() => setDetalhado(false)} />
          </View>
          {detalhado ? (
            <>
              {diasComRotina.length > 0 ? (
                <>
                  <Text style={estilos.suave}>Repetir um treino salvo</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {diasComRotina.map((d) => (
                      <Chip
                        key={d}
                        texto={d === diaDaData ? `${maiuscula(nomeDoDia)} (hoje)` : maiuscula(nomeDiaDaSemana(d))}
                        ativo={false}
                        onPress={() => usarRotina(d)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <ListaExercicios itens={itens} onMudar={setItens} />

              {itens.length > 0 ? (
                <Botao
                  titulo={
                    diasComRotina.includes(diaDaData)
                      ? `Atualizar treino de ${nomeDoDia}`
                      : `Salvar como treino de ${nomeDoDia}`
                  }
                  tipo="secundario"
                  onPress={guardarRotina}
                />
              ) : null}
              {avisoRotina ? <Text style={estilos.suave}>{avisoRotina}</Text> : null}
            </>
          ) : (
            <>
              <Text style={estilos.suave}>O que o treino puxou mais</Text>
              {FOCOS.map((f) => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Chip texto={f.nome} ativo={foco === f.id} onPress={() => setFoco(f.id)} />
                  <Text style={[estilos.suave, { flex: 1 }]}>{f.dica}</Text>
                </View>
              ))}
            </>
          )}
        </>
      ) : null}

      {medida === 'tempo' ? (
        <>
          {/* Com a lista de exercícios a intensidade não muda nada: quem manda são
              as séries e o descanso. Só aparece no modo rápido, para não enganar. */}
          {!comLista ? (
            <>
              <Text style={estilos.suave}>Intensidade</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {INTENSIDADES.map((i) => (
                  <Chip key={i.id} texto={i.nome} ativo={intensidade === i.id} onPress={() => setIntensidade(i.id)} />
                ))}
              </View>
            </>
          ) : null}
          <Text style={estilos.suave}>Duração em minutos</Text>
          <TextInput
            style={estilos.input}
            value={minutos}
            onChangeText={setMinutos}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel="Duração em minutos"
          />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {MINUTOS.map((m) => (
              <Chip key={m} texto={`${m} min`} ativo={n(minutos) === m} onPress={() => setMinutos(String(m))} />
            ))}
          </View>
        </>
      ) : null}

      {medida === 'distancia' ? (
        <>
          <Text style={estilos.suave}>Distância em km</Text>
          <TextInput
            style={estilos.input}
            value={distancia}
            onChangeText={setDistancia}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Distância em km"
          />
        </>
      ) : null}

      {medida === 'kcal' ? (
        <>
          <Text style={estilos.suave}>Calorias gastas, se você souber</Text>
          <TextInput
            style={estilos.input}
            value={kcalTexto}
            onChangeText={setKcalTexto}
            keyboardType="number-pad"
            placeholder="ex.: 250…"
            placeholderTextColor={cores.suave}
            accessibilityLabel="Calorias gastas"
          />
        </>
      ) : null}

      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={[estilos.titulo, { fontSize: 32 }]}>{kcal} kcal</Text>
        <Text style={[estilos.suave, { textAlign: 'center' }]}>
          {faltaExercicio
            ? 'Adicione os exercícios do treino para o app calcular.'
            : tipo === 'outro'
              ? 'Valor informado por você.'
              : `Gasto a mais do que seu corpo gastaria parado, com ${formatar(pesoKg)} kg.`}
        </Text>
        {comLista && itens.length > 0 ? (
          <Text style={[estilos.suave, { textAlign: 'center' }]}>
            Cada série conta pelo exercício que você fez; o resto do tempo conta como descanso.
            {volume > 0 ? ` Você levantou ${volume.toLocaleString('pt-BR')} kg no total.` : ''}
          </Text>
        ) : null}
      </View>

      <Botao titulo="Salvar treino" desabilitado={kcal <= 0} onPress={() => onSalvar(treino, kcal)} />
      <Botao titulo="Cancelar" tipo="secundario" onPress={onCancelar} />
    </Cartao>
  );
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Lista de exercícios do treino: o que foi feito, com séries, repetições e carga. */
function ListaExercicios({ itens, onMudar }: { itens: ItemTreino[]; onMudar: (itens: ItemTreino[]) => void }) {
  const { cores, estilos } = useTema();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<ExercicioCatalogo | null>(null);
  const [series, setSeries] = useState('3');
  const [repeticoes, setRepeticoes] = useState('10');
  const [carga, setCarga] = useState('');

  const sugestoes = buscarExercicios(busca);
  const nomeLivre = busca.trim();
  const nome = escolhido?.nome ?? nomeLivre;
  const numero = (t: string) => Math.round(Number(t.replace(',', '.')) || 0);

  const adicionar = () => {
    const s = numero(series);
    const r = numero(repeticoes);
    if (!nome || s <= 0 || r <= 0) return;
    onMudar([
      ...itens,
      {
        catalogo: escolhido?.id ?? null,
        nome,
        series: s,
        repeticoes: r,
        cargaKg: carga.trim() ? Number(carga.replace(',', '.')) : null,
      },
    ]);
    setBusca('');
    setEscolhido(null);
    setCarga('');
  };

  return (
    <>
      {itens.length > 0 ? (
        <View style={{ gap: 4 }}>
          {itens.map((i, n) => (
            <View key={`${i.nome}-${n}`} style={estilos.linhaEntre}>
              <Text style={[estilos.texto, { flex: 1 }]}>{descreverItem(i)}</Text>
              <Pressable
                onPress={() => onMudar(itens.filter((_, j) => j !== n))}
                accessibilityRole="button"
                accessibilityLabel={`Tirar ${i.nome} do treino`}
                hitSlop={8}
              >
                <Text style={{ fontSize: 20, color: cores.suave }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={estilos.suave}>
          Registre os exercícios que você fez. Agachamento e supino gastam bem mais que rosca direta, então a lista
          deixa a conta mais perto da verdade.
        </Text>
      )}

      <TextInput
        style={estilos.input}
        value={escolhido ? escolhido.nome : busca}
        onChangeText={(t) => {
          setEscolhido(null);
          setBusca(t);
        }}
        placeholder="Qual exercício?"
        placeholderTextColor={cores.suave}
        accessibilityLabel="Nome do exercício"
      />

      {!escolhido ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {sugestoes.map((e) => (
            <Chip key={e.id} texto={e.nome} ativo={false} onPress={() => setEscolhido(e)} />
          ))}
          {sugestoes.length === 0 && nomeLivre ? (
            <Text style={estilos.suave}>Não está na lista. Dá para adicionar assim mesmo.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.suave}>Séries</Text>
          <TextInput
            style={estilos.input}
            value={series}
            onChangeText={setSeries}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel="Número de séries"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.suave}>Repetições</Text>
          <TextInput
            style={estilos.input}
            value={repeticoes}
            onChangeText={setRepeticoes}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel="Repetições por série"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.suave}>Carga (kg)</Text>
          <TextInput
            style={estilos.input}
            value={carga}
            onChangeText={setCarga}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={cores.suave}
            accessibilityLabel="Carga em quilos"
          />
        </View>
      </View>

      <Botao titulo="Adicionar exercício" tipo="secundario" desabilitado={!nome} onPress={adicionar} />
    </>
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
