import { router, useFocusEffect } from 'expo-router';
import { voltar } from '@/lib/navegacao';
import { useBanco, useTipoArmazenamento } from '@/lib/banco';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, Chip, useTema, type PreferenciaTema } from '@/components/ui';
import { CartaoConta } from '@/components/conta';
import { lerPerfil, salvarPerfil } from '@/lib/db';
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

  useFocusEffect(
    useCallback(() => {
      lerPerfil(db).then((p) => {
        if (!p) return;
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
                : 'Calculada pela equação de Mifflin-St Jeor com seu nível de atividade. É uma estimativa; um nutricionista pode ajustar.'}
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
          Seus dados ficam neste aparelho ({armazenamento === 'sqlite' ? 'SQLite' : 'modo compatível, IndexedDB'}).
        </Text>
        <Text style={estilos.suave}>Muda na hora. “Automático” segue o modo claro ou escuro do celular.</Text>
      </Cartao>

      <CartaoConta />

      <Botao
        titulo="Salvar"
        desabilitado={!valido}
        onPress={async () => {
          await salvarPerfil(db, perfil);
          voltar();
        }}
      />
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
