import { ScrollView, Text } from 'react-native';
import { Cartao, useTema } from '@/components/ui';

export default function TelaAgua() {
  const { estilos } = useTema();
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} contentInsetAdjustmentBehavior="automatic">
      <Cartao>
        <Text style={estilos.titulo}>Em breve</Text>
        <Text style={estilos.texto}>
          Aqui você vai registrar quanta água bebeu no dia, com botões de copo, caneca e garrafa, e acompanhar a meta
          calculada pelo seu peso.
        </Text>
      </Cartao>
    </ScrollView>
  );
}
