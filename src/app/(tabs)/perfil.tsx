import { useFocusEffect } from 'expo-router';
import { useBanco, useTipoArmazenamento } from '@/lib/banco';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Cartao, Chip, useTema, type PreferenciaTema } from '@/components/ui';
import { CartaoConta } from '@/components/conta';
import { lerPerfil, salvarPeso, salvarPerfil } from '@/lib/db';
import { metaCalculada, metaDiaria, type Atividade, type Objetivo, type Perfil, type Sexo } from '@/lib/nutrition';

const ATIVIDADES: { id: Atividade; nome: string; dica: string }[] = [
  { id: 'sedentario', nome: 'Sedentário', dica: 'pouco ou nenhum exercício' },
  { id: 'leve', nome: 'Leve', dica: 'exercício 1 a 3 vezes por semana' },
  { id: 'moderado', nome: 'Moderado', dica: 'exercício 3 a 5 vezes por semana' },
  { id: 'intenso', nome: 'Intenso', dica: 'exercício 6 a 7 vezes por semana' },
  { id: 'muito_intenso', nome: 'Muito intenso', dica: 'treino pesado diário ou trabalho físico' },
];

const OBJETIVOS: { id: Objetivo; nome: string }[] = [
  { id: 'emagrecer', nome: 'Emagrecer' },
  { id: 'manter', nome: 'Manter peso' },
  { id: 'ganhar', nome: 'Ganhar massa' },
];

/** Tempo de espera depois da última tecla antes de gravar o perfil. */
const ESPERA_SALVAR_MS = 800;

const TEMAS: { id: PreferenciaTema; nome: string }[] = [
  { id: 'sistema', nome: 'Automático' },
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
];

export default function TelaPerfil() {
  const { cores, estilos, preferencia, setPreferencia } = useTema();
  const db = useBanco();
  const armazenamento = useTipoArmazenamento();
  const [sexo, setSexo] = useState<Sexo>('masculino');
  const [idade, setIdade] = useState('');
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [atividade, setAtividade] = useState<Atividade>('leve');
  const [objetivo, setObjetivo] = useState<Objetivo>('manter');
  const [metaManual, setMetaManual] = useState('');
  const [salvo, setSalvo] = useState(false);
  /** Último perfil que já está no banco, para não gravar duas vezes a mesma coisa. */
  const gravado = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      lerPerfil(db).then((p) => {
        if (!p) return;
        gravado.current = JSON.stringify(p);
        setSexo(p.sexo);
        setIdade(String(p.idade));
        setAltura(String(p.alturaCm));
        setPeso(String(p.pesoKg).replace('.', ','));
        setAtividade(p.atividade);
        setObjetivo(p.objetivo);
        setMetaManual(p.metaManual ? String(p.metaManual) : '');
      });
    }, [db]),
  );

  // O aviso de salvo some sozinho, para não ficar preso na tela.
  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 4000);
    return () => clearTimeout(t);
  }, [salvo]);

  const numero = (t: string) => Number(t.replace(',', '.'));
  const perfil: Perfil = {
    sexo,
    idade: Math.round(numero(idade)),
    alturaCm: numero(altura),
    pesoKg: numero(peso),
    atividade,
    objetivo,
    metaManual: metaManual.trim() ? Math.round(numero(metaManual)) : null,
  };

  const erros = [
    !(perfil.idade >= 12 && perfil.idade <= 100) && 'idade entre 12 e 100 anos',
    !(perfil.alturaCm >= 100 && perfil.alturaCm <= 250) && 'altura em cm, entre 100 e 250',
    !(perfil.pesoKg >= 30 && perfil.pesoKg <= 300) && 'peso em kg, entre 30 e 300',
    perfil.metaManual !== null && !(perfil.metaManual >= 800 && perfil.metaManual <= 6000) && 'meta manual entre 800 e 6000 kcal',
  ].filter(Boolean) as string[];

  const valido = erros.length === 0;
  const meta = valido ? metaDiaria(perfil) : null;

  // O peso sozinho já serve para a água e os exercícios, então é gravado mesmo
  // sem idade e altura, que só entram no cálculo da meta de calorias.
  const pesoValido = perfil.pesoKg >= 30 && perfil.pesoKg <= 300;
  useEffect(() => {
    if (!pesoValido) return;
    const t = setTimeout(() => salvarPeso(db, perfil.pesoKg), ESPERA_SALVAR_MS);
    return () => clearTimeout(t);
  }, [db, pesoValido, perfil.pesoKg]);

  // Salva sozinho, pouco depois de parar de digitar. Não existe botão de salvar:
  // esquecer de tocar nele deixava o resto do app sem meta.
  const perfilTexto = JSON.stringify(perfil);
  useEffect(() => {
    if (!valido || perfilTexto === gravado.current) return;
    const t = setTimeout(async () => {
      await salvarPerfil(db, perfil);
      gravado.current = perfilTexto;
      setSalvo(true);
    }, ESPERA_SALVAR_MS);
    return () => clearTimeout(t);
    // `perfil` vem de `perfilTexto`; comparar o texto evita gravar a cada tecla.
  }, [db, valido, perfilTexto]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <Cartao>
        <Text style={estilos.titulo}>Sobre você</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip texto="Masculino" ativo={sexo === 'masculino'} onPress={() => setSexo('masculino')} />
          <Chip texto="Feminino" ativo={sexo === 'feminino'} onPress={() => setSexo('feminino')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Campo rotulo="Idade" valor={idade} onChange={setIdade} sufixo="anos" />
          <Campo rotulo="Altura" valor={altura} onChange={setAltura} sufixo="cm" />
          <Campo rotulo="Peso" valor={peso} onChange={setPeso} sufixo="kg" />
        </View>
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>Atividade física</Text>
        {ATIVIDADES.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Chip texto={a.nome} ativo={atividade === a.id} onPress={() => setAtividade(a.id)} />
            <Text style={[estilos.suave, { flex: 1 }]}>{a.dica}</Text>
          </View>
        ))}
        <Text style={estilos.suave}>
          Conte aqui só o seu dia a dia, sem os treinos. Eles entram na aba Exercícios e somam na meta.
          Marcar um nível alto aqui e ainda registrar treino conta o mesmo esforço duas vezes.
        </Text>
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>Objetivo</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {OBJETIVOS.map((o) => (
            <Chip key={o.id} texto={o.nome} ativo={objetivo === o.id} onPress={() => setObjetivo(o.id)} />
          ))}
        </View>
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>Meta diária</Text>
        {meta ? (
          <>
            <Text style={[estilos.numero, { color: cores.primaria }]}>{meta.kcal} kcal</Text>
            <Text style={estilos.suave}>
              Proteína {meta.proteina} g · Carboidrato {meta.carboidrato} g · Gordura {meta.gordura} g
            </Text>
            <Text style={estilos.suave}>
              {perfil.metaManual
                ? `Meta manual. A calculada seria ${metaCalculada(perfil)} kcal.`
                : 'Calculada pela fórmula de Mifflin-St Jeor com o seu nível de atividade. É uma estimativa, e um nutricionista pode ajustar.'}
            </Text>
          </>
        ) : (
          <Text style={[estilos.suave, { color: cores.perigo }]}>Confira: {erros.join('; ')}.</Text>
        )}
        <Text style={[estilos.suave, { marginTop: 4 }]}>Prefere definir a meta você mesmo? (opcional)</Text>
        <TextInput
          style={estilos.input}
          value={metaManual}
          onChangeText={setMetaManual}
          keyboardType="number-pad"
          placeholder="ex.: 2000…"
          placeholderTextColor={cores.suave}
          accessibilityLabel="Meta manual em kcal"
        />
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>Aparência</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {TEMAS.map((t) => (
            <Chip key={t.id} texto={t.nome} ativo={preferencia === t.id} onPress={() => setPreferencia(t.id)} />
          ))}
        </View>
        <Text style={estilos.suave}>
          Seus dados ficam neste aparelho{armazenamento === 'sqlite' ? '' : ', em modo compatível'}.
        </Text>
        <Text style={estilos.suave}>Muda na hora. Em "Automático", o app segue o modo claro ou escuro do celular.</Text>
      </Cartao>

      <CartaoConta />

      <Text accessibilityLiveRegion="polite" style={[estilos.suave, { textAlign: 'center' }]}>
        {salvo
          ? 'Salvo. A meta nova já vale nas outras abas.'
          : valido
            ? 'O que você mudar aqui salva sozinho.'
            : pesoValido
              ? 'Peso salvo. Complete idade e altura para o app calcular sua meta de calorias.'
              : 'O que você mudar aqui salva sozinho.'}
      </Text>
    </ScrollView>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  sufixo,
}: {
  rotulo: string;
  valor: string;
  onChange: (t: string) => void;
  sufixo: string;
}) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={estilos.suave}>{rotulo}</Text>
      <TextInput
        style={estilos.input}
        value={valor}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={sufixo}
        placeholderTextColor={cores.suave}
        accessibilityLabel={`${rotulo} em ${sufixo}`}
      />
    </View>
  );
}
