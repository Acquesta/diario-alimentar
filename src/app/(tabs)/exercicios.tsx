import { ScrollView, Text } from 'react-native';
import { Cartao, useTema } from '@/components/ui';

export default function TelaExercicios() {
  const { estilos } = useTema();
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} contentInsetAdjustmentBehavior="automatic">
      <Cartao>
        <Text style={estilos.titulo}>Em breve</Text>
        <Text style={estilos.texto}>
          Aqui você vai registrar musculação, corrida, caminhada e bike. O gasto do treino soma na meta de calorias do
          dia.
        </Text>
      </Cartao>
    </ScrollView>
  );
}
