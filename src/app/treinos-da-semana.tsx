import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ajuda, Botao, Cartao, useTema } from '@/components/ui';
import { ListaExercicios } from '@/components/lista-exercicios';
import { useBanco } from '@/lib/banco';
import { nomeDiaDaSemana } from '@/lib/dates';
import { apagarRotina, lerRotina, salvarRotina } from '@/lib/db';
import { itensValidos, type ItemTreino } from '@/lib/exercicios';

/** A semana começa na segunda, como quem monta treino costuma pensar. */
const DIAS = [1, 2, 3, 4, 5, 6, 0];

type Rascunho = { itens: ItemTreino[]; minutos: string };

const VAZIO: Rascunho = { itens: [], minutos: '45' };

/**
 * Cadastro dos treinos da semana, separado do registro do dia.
 * Aqui ele monta segunda, terça e quarta de uma vez; na aba Exercícios, o treino
 * do dia é só carregar o que está guardado aqui e conferir.
 */
export default function TelaTreinosDaSemana() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const [rascunhos, setRascunhos] = useState<Record<number, Rascunho>>({});
  const [aberto, setAberto] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const lidos: Record<number, Rascunho> = {};
    for (const dia of DIAS) {
      const rotina = await lerRotina(db, dia);
      lidos[dia] = rotina
        ? { itens: rotina.itens, minutos: rotina.minutos ? String(rotina.minutos) : '' }
        : { ...VAZIO };
    }
    setRascunhos(lidos);
  }, [db]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const trocar = (dia: number, mudanca: Partial<Rascunho>) =>
    setRascunhos((atual) => ({ ...atual, [dia]: { ...(atual[dia] ?? VAZIO), ...mudanca } }));

  const salvar = async (dia: number) => {
    const rascunho = rascunhos[dia] ?? VAZIO;
    await salvarRotina(db, dia, Number(rascunho.minutos.replace(',', '.')) || null, rascunho.itens);
    setAviso(`Treino de ${nomeDiaDaSemana(dia)} salvo.`);
    setAberto(null);
  };

  const apagar = async (dia: number) => {
    await apagarRotina(db, dia);
    trocar(dia, { ...VAZIO });
    setAviso(`Treino de ${nomeDiaDaSemana(dia)} apagado.`);
    setAberto(null);
  };

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Cartao>
        <Ajuda
          titulo="Seus treinos fixos"
          texto={
            'Monte aqui o treino de cada dia da semana, uma vez só. Depois, na aba Exercícios, ' +
            'toque no dia para trazer a lista pronta, confira o que mudou e registre. ' +
            'Nada nesta tela conta caloria: é só o cadastro. Dia sem treino fica vazio.'
          }
        />
      </Cartao>

      {DIAS.map((dia) => {
        const rascunho = rascunhos[dia] ?? VAZIO;
        const expandido = aberto === dia;
        const series = rascunho.itens.reduce((total, i) => total + i.series, 0);

        return (
          <Cartao key={dia}>
            <Pressable
              onPress={() => {
                setAviso(null);
                setAberto(expandido ? null : dia);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: expandido }}
              accessibilityLabel={`Treino de ${nomeDiaDaSemana(dia)}`}
              style={estilos.linhaEntre}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={estilos.titulo}>{maiuscula(nomeDiaDaSemana(dia))}</Text>
                <Text style={estilos.suave}>
                  {rascunho.itens.length === 0
                    ? 'Sem treino'
                    : `${rascunho.itens.length} ${rascunho.itens.length === 1 ? 'exercício' : 'exercícios'} · ` +
                      `${series} ${series === 1 ? 'série' : 'séries'}`}
                </Text>
              </View>
              <Text style={{ fontSize: 20, color: cores.primaria }}>{expandido ? '−' : '+'}</Text>
            </Pressable>

            {expandido ? (
              <>
                <ListaExercicios
                  itens={rascunho.itens}
                  onMudar={(itens) => trocar(dia, { itens })}
                  vazio={`Nada em ${nomeDiaDaSemana(dia)} ainda. Adicione os exercícios abaixo.`}
                />

                <Text style={estilos.suave}>Duração média em minutos</Text>
                <TextInput
                  style={estilos.input}
                  value={rascunho.minutos}
                  onChangeText={(minutos) => trocar(dia, { minutos })}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  accessibilityLabel={`Duração do treino de ${nomeDiaDaSemana(dia)}`}
                />

                {!itensValidos(rascunho.itens) ? (
                  <Text style={estilos.suave}>Complete as séries e as repetições de cada exercício.</Text>
                ) : null}
                <Botao
                  titulo={`Salvar treino de ${nomeDiaDaSemana(dia)}`}
                  desabilitado={rascunho.itens.length === 0 || !itensValidos(rascunho.itens)}
                  onPress={() => salvar(dia)}
                />
                {rascunho.itens.length > 0 ? (
                  <Botao titulo="Apagar este treino" tipo="contorno" onPress={() => apagar(dia)} />
                ) : null}
              </>
            ) : null}
          </Cartao>
        );
      })}

      {aviso ? (
        <Text style={estilos.suave} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
