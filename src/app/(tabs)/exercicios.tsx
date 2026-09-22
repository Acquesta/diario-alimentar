import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, Chip, formatar, useTema } from '@/components/ui';
import { useAoAlterar, useBanco } from '@/lib/banco';
import { hoje, rotulo, somarDias } from '@/lib/dates';
import {
  lerPerfil,
  listarExercicios,
  registrarExercicio,
  removerExercicio,
  restaurarExercicio,
  type RegistroExercicio,
} from '@/lib/db';
import {
  descrever,
  gastoDoDia,
  gastoTreino,
  INTENSIDADES,
  medidaDoTipo,
  TIPOS,
  type Intensidade,
  type TipoExercicio,
  type Treino,
} from '@/lib/exercicios';
import type { Perfil } from '@/lib/nutrition';

/** Tempo para desfazer uma remoção. */
const JANELA_DESFAZER_MS = 6000;

const MINUTOS = [20, 30, 45, 60, 90];

export default function TelaExercicios() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const [data, setData] = useState(hoje());
  const [registros, setRegistros] = useState<RegistroExercicio[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [removido, setRemovido] = useState<RegistroExercicio | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(async () => {
    const [regs, p] = await Promise.all([listarExercicios(db, data), lerPerfil(db)]);
    setRegistros(regs);
    setPerfil(p);
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
              ? 'Gasto dos treinos de hoje. Esse valor soma na sua meta de calorias do dia.'
              : 'Nenhum treino registrado hoje.'}
          </Text>
        </Cartao>

        {!perfil ? (
          <Cartao>
            <Text style={estilos.titulo}>Falta seu peso</Text>
            <Text style={estilos.suave}>
              O gasto do treino depende do seu peso. Preencha o perfil para o app calcular.
            </Text>
            <Botao titulo="Ir para o Perfil" tipo="secundario" onPress={() => router.push('/perfil')} />
          </Cartao>
        ) : registrando ? (
          <Formulario
            pesoKg={perfil.pesoKg}
            onCancelar={() => setRegistrando(false)}
            onSalvar={async (treino, kcal) => {
              await registrarExercicio(db, data, {
                tipo: treino.tipo,
                intensidade: treino.intensidade,
                minutos: treino.minutos,
                distanciaKm: treino.distanciaKm,
                kcal,
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
                      minutos: r.minutos,
                      distanciaKm: r.distancia_km,
                      kcal: r.kcal,
                    })}
                  </Text>
                  <Text style={estilos.suave}>{Math.round(r.kcal)} kcal</Text>
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
        <View
          accessibilityLiveRegion="polite"
          style={[
            estilos.cartao,
            {
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 24,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: cores.texto,
              borderColor: cores.texto,
            },
          ]}
        >
          <Text style={{ flex: 1, color: cores.fundo }} numberOfLines={1}>
            Treino removido
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Desfazer remoção"
            hitSlop={8}
            onPress={async () => {
              await restaurarExercicio(db, removido);
              setRemovido(null);
              carregar();
            }}
          >
            <Text style={{ color: cores.fundo, fontWeight: '700', textDecorationLine: 'underline' }}>Desfazer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Formulario({
  pesoKg,
  onSalvar,
  onCancelar,
}: {
  pesoKg: number;
  onSalvar: (treino: Treino, kcal: number) => void;
  onCancelar: () => void;
}) {
  const { cores, estilos } = useTema();
  const [tipo, setTipo] = useState<TipoExercicio>('musculacao');
  const [intensidade, setIntensidade] = useState<Intensidade>('moderado');
  const [minutos, setMinutos] = useState('45');
  const [distancia, setDistancia] = useState('5');
  const [kcalTexto, setKcalTexto] = useState('');

  const medida = medidaDoTipo(tipo);
  const n = (t: string) => Number(t.replace(',', '.'));
  const treino: Treino = {
    tipo,
    intensidade: medida === 'tempo' ? intensidade : null,
    minutos: medida === 'tempo' ? n(minutos) : null,
    distanciaKm: medida === 'distancia' ? n(distancia) : null,
    kcal: medida === 'kcal' ? n(kcalTexto) : null,
  };
  const kcal = gastoTreino(treino, pesoKg);

  return (
    <Cartao>
      <Text style={estilos.titulo}>Registrar treino</Text>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {TIPOS.map((t) => (
          <Chip key={t.id} texto={t.nome} ativo={tipo === t.id} onPress={() => setTipo(t.id)} />
        ))}
      </View>

      {medida === 'tempo' ? (
        <>
          <Text style={estilos.suave}>Intensidade</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {INTENSIDADES.map((i) => (
              <Chip key={i.id} texto={i.nome} ativo={intensidade === i.id} onPress={() => setIntensidade(i.id)} />
            ))}
          </View>
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
          {tipo === 'outro'
            ? 'Valor informado por você.'
            : `Gasto além do que seu corpo gastaria parado, com ${formatar(pesoKg)} kg.`}
        </Text>
      </View>

      <Botao titulo="Salvar treino" desabilitado={kcal <= 0} onPress={() => onSalvar(treino, kcal)} />
      <Botao titulo="Cancelar" tipo="secundario" onPress={onCancelar} />
    </Cartao>
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
