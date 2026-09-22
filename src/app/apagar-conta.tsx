import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Botao, Cartao, useTema } from '@/components/ui';
import { useConta } from '@/lib/conta';

/** Apagar conta e backup da nuvem, com confirmação em dois passos. */
export default function TelaApagarConta() {
  const { cores, estilos } = useTema();
  const conta = useConta();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [apagarDoAparelho, setApagarDoAparelho] = useState(false);
  const [feito, setFeito] = useState(false);

  if (feito) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Text style={estilos.titulo}>Conta apagada</Text>
          <Text style={estilos.texto}>
            Sua conta e a cópia na nuvem foram apagadas.
            {apagarDoAparelho ? ' Os dados deste aparelho também.' : ' Os dados deste aparelho continuam aqui.'}
          </Text>
          <Botao titulo="Voltar ao início" onPress={() => router.replace('/')} />
        </Cartao>
      </ScrollView>
    );
  }

  if (!conta.usuario) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Text style={estilos.texto}>Você não está com a conta aberta neste aparelho.</Text>
        </Cartao>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} contentInsetAdjustmentBehavior="automatic">
      <Cartao>
        <Text style={estilos.titulo}>Apagar conta de {conta.usuario.email}</Text>
        <Text style={estilos.texto}>
          Isso apaga sua conta e a cópia do diário na nuvem. Não dá para desfazer.
        </Text>
        <View style={[estilos.linhaEntre, { marginTop: 4 }]}>
          <Text style={[estilos.texto, { flex: 1 }]}>Apagar também os dados deste aparelho</Text>
          <Switch
            value={apagarDoAparelho}
            onValueChange={setApagarDoAparelho}
            trackColor={{ true: cores.perigo }}
            accessibilityLabel="Apagar também os dados deste aparelho"
          />
        </View>
        <Text style={estilos.suave}>
          {apagarDoAparelho
            ? 'O app volta a ficar vazio, como recém-instalado.'
            : 'Seu diário continua neste aparelho, só sem backup.'}
        </Text>
      </Cartao>

      {passo === 1 ? (
        <Botao titulo="Continuar" onPress={() => setPasso(2)} />
      ) : (
        <Cartao>
          <Text style={[estilos.titulo, { color: cores.perigo }]}>Tem certeza?</Text>
          <Botao
            titulo={conta.ocupado ? 'Apagando…' : 'Sim, apagar para sempre'}
            desabilitado={conta.ocupado}
            onPress={() => conta.apagarConta(apagarDoAparelho).then(() => setFeito(true), () => {})}
          />
          <Botao titulo="Cancelar" tipo="secundario" onPress={() => router.back()} />
        </Cartao>
      )}
      {conta.erro && <Text style={[estilos.suave, { color: cores.perigo }]}>{conta.erro}</Text>}
    </ScrollView>
  );
}
