import { router, useLocalSearchParams } from 'expo-router';
import { voltar } from '@/lib/navegacao';
import { useBanco } from '@/lib/banco';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, useTema } from '@/components/ui';
import { criarPersonalizado } from '@/lib/db';

/** Cadastro de alimento pelo rótulo nutricional. Valores convertidos para 100 g. */
export default function NovoAlimento() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const params = useLocalSearchParams<{ nome?: string; codigo?: string }>();
  const [nome, setNome] = useState(params.nome ?? '');
  const [porcaoG, setPorcaoG] = useState('100');
  const [kcal, setKcal] = useState('');
  const [proteina, setProteina] = useState('');
  const [carboidrato, setCarboidrato] = useState('');
  const [gordura, setGordura] = useState('');

  const n = (t: string) => (t.trim() === '' ? 0 : Number(t.replace(',', '.')));
  const porcao = n(porcaoG);
  const valores = [n(kcal), n(proteina), n(carboidrato), n(gordura)];
  const valido =
    nome.trim().length > 1 &&
    porcao > 0 &&
    kcal.trim() !== '' &&
    valores.every((v) => Number.isFinite(v) && v >= 0);

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <Cartao>
        <Text style={estilos.suave}>
          Copie os valores da tabela nutricional da embalagem. Se ela mostra "porção de 200 ml", digite 200 na porção.
        </Text>
        {params.codigo ? <Text style={estilos.suave}>Código de barras {params.codigo}</Text> : null}
        <Rotulo texto="Nome" />
        <TextInput
          style={estilos.input}
          value={nome}
          onChangeText={setNome}
          placeholder="ex.: Leite integral Marca X…"
          placeholderTextColor={cores.suave}
          accessibilityLabel="Nome do alimento"
        />
        <Rotulo texto="Porção do rótulo (g ou ml)" />
        <TextInput style={estilos.input} value={porcaoG} onChangeText={setPorcaoG} keyboardType="decimal-pad" accessibilityLabel="Porção do rótulo" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Numero rotulo="Calorias (kcal)" valor={kcal} onChange={setKcal} />
          <Numero rotulo="Proteína (g)" valor={proteina} onChange={setProteina} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Numero rotulo="Carboidrato (g)" valor={carboidrato} onChange={setCarboidrato} />
          <Numero rotulo="Gordura total (g)" valor={gordura} onChange={setGordura} />
        </View>
      </Cartao>

      <Botao
        titulo="Salvar alimento"
        desabilitado={!valido}
        onPress={async () => {
          const f = 100 / porcao;
          const um = (v: number) => Math.round(v * f * 10) / 10;
          await criarPersonalizado(db, {
            codigoBarras: params.codigo ?? null,
            nome: nome.trim(),
            kcal: Math.round(n(kcal) * f),
            proteina: um(n(proteina)),
            carboidrato: um(n(carboidrato)),
            gordura: um(n(gordura)),
          });
          voltar();
        }}
      />
    </ScrollView>
  );
}

function Rotulo({ texto }: { texto: string }) {
  const { cores, estilos } = useTema();
  return <Text style={estilos.suave}>{texto}</Text>;
}

function Numero({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (t: string) => void }) {
  const { cores, estilos } = useTema();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Rotulo texto={rotulo} />
      <TextInput style={estilos.input} value={valor} onChangeText={onChange} keyboardType="decimal-pad" accessibilityLabel={rotulo} />
    </View>
  );
}
