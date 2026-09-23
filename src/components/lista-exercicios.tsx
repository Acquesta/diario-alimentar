import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, Chip, useTema } from '@/components/ui';
import { buscarExercicios, type ExercicioCatalogo, type ItemTreino } from '@/lib/exercicios';

/**
 * Montagem de um treino de musculação: a lista do que foi feito e o campo de
 * adicionar. Serve tanto para o treino do dia quanto para a rotina da semana,
 * por isso mora aqui e não dentro de uma tela.
 */
export function ListaExercicios({
  itens,
  onMudar,
  vazio,
}: {
  itens: ItemTreino[];
  onMudar: (itens: ItemTreino[]) => void;
  /** Texto de quando ainda não há exercício nenhum. */
  vazio?: string;
}) {
  const { cores, estilos } = useTema();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<ExercicioCatalogo | null>(null);
  const [series, setSeries] = useState('3');
  const [repeticoes, setRepeticoes] = useState('10');
  const [carga, setCarga] = useState('');

  const sugestoes = buscarExercicios(busca);
  const nomeLivre = busca.trim();
  const nome = escolhido?.nome ?? nomeLivre;

  const adicionar = () => {
    const s = inteiro(series);
    const r = inteiro(repeticoes);
    if (!nome || s <= 0 || r <= 0) return;
    onMudar([
      ...itens,
      { catalogo: escolhido?.id ?? null, nome, series: s, repeticoes: r, cargaKg: decimal(carga) },
    ]);
    setBusca('');
    setEscolhido(null);
    setCarga('');
  };

  const trocar = (i: number, mudanca: Partial<ItemTreino>) =>
    onMudar(itens.map((item, j) => (j === i ? { ...item, ...mudanca } : item)));

  return (
    <>
      {itens.length > 0 ? (
        itens.map((item, i) => (
          <Cartao key={`${item.nome}-${i}`} style={{ padding: 12, gap: 8 }}>
            <View style={estilos.linhaEntre}>
              <Text style={[estilos.texto, { flex: 1 }]}>{item.nome}</Text>
              <Pressable
                onPress={() => onMudar(itens.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Tirar ${item.nome} do treino`}
                hitSlop={8}
              >
                <Text style={{ fontSize: 20, color: cores.suave }}>×</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Campo
                rotulo="Séries"
                acessivel={`Séries de ${item.nome}`}
                valor={item.series ? String(item.series) : ''}
                onMudar={(t) => trocar(i, { series: inteiro(t) })}
              />
              <Campo
                rotulo="Repetições"
                acessivel={`Repetições de ${item.nome}`}
                valor={item.repeticoes ? String(item.repeticoes) : ''}
                onMudar={(t) => trocar(i, { repeticoes: inteiro(t) })}
              />
              <Campo
                rotulo="Carga (kg)"
                acessivel={`Carga de ${item.nome}`}
                valor={item.cargaKg ? String(item.cargaKg).replace('.', ',') : ''}
                onMudar={(t) => trocar(i, { cargaKg: decimal(t) })}
                decimal
                vazio="—"
              />
            </View>
          </Cartao>
        ))
      ) : (
        <Text style={estilos.suave}>{vazio ?? 'Nenhum exercício ainda.'}</Text>
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
        <Campo rotulo="Séries" acessivel="Número de séries" valor={series} onMudar={setSeries} />
        <Campo rotulo="Repetições" acessivel="Repetições por série" valor={repeticoes} onMudar={setRepeticoes} />
        <Campo rotulo="Carga (kg)" acessivel="Carga em quilos" valor={carga} onMudar={setCarga} decimal vazio="—" />
      </View>

      <Botao titulo="Adicionar exercício" tipo="secundario" desabilitado={!nome} onPress={adicionar} />
    </>
  );
}

/** Campo numérico pequeno, dos três que descrevem um exercício. */
function Campo({
  rotulo,
  acessivel,
  valor,
  onMudar,
  decimal: comVirgula,
  vazio,
}: {
  rotulo: string;
  acessivel: string;
  valor: string;
  onMudar: (texto: string) => void;
  decimal?: boolean;
  vazio?: string;
}) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ flex: 1 }}>
      <Text style={estilos.suave}>{rotulo}</Text>
      <TextInput
        style={estilos.input}
        value={valor}
        onChangeText={onMudar}
        keyboardType={comVirgula ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        placeholder={vazio}
        placeholderTextColor={cores.suave}
        accessibilityLabel={acessivel}
      />
    </View>
  );
}

const inteiro = (t: string) => Math.max(0, Math.round(Number(t.replace(',', '.')) || 0));

const decimal = (t: string) => (t.trim() ? Number(t.replace(',', '.')) || null : null);
