import { ScrollView, Text } from 'react-native';
import { Cartao, useTema } from '@/components/ui';

export default function TelaPrivacidade() {
  const { estilos } = useTema();
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} contentInsetAdjustmentBehavior="automatic">
      <Cartao>
        <Text style={estilos.titulo}>O que fica no aparelho</Text>
        <Text style={estilos.texto}>
          Tudo o que você registra (perfil, refeições, alimentos, pratos e favoritos) fica guardado neste aparelho. O app
          funciona sem internet e sem conta.
        </Text>
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>O que vai para a nuvem</Text>
        <Text style={estilos.texto}>
          Só se você entrar com seu e-mail. Nesse caso, guardamos seu e-mail e uma cópia do diário, com a data do último
          backup e o tipo de aparelho (ex.: iPhone). Também guardamos a cópia anterior, para desfazer uma restauração.
        </Text>
        <Text style={estilos.texto}>
          A cópia fica no Supabase, em servidores em São Paulo. Só a sua conta consegue ler a sua cópia.
        </Text>
        <Text style={estilos.texto}>Não vendemos, não compartilhamos e não usamos seus dados para anúncios.</Text>
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>Como apagar</Text>
        <Text style={estilos.texto}>
          Em Perfil, “Conta e backup”, toque em “Apagar minha conta e dados”. Isso apaga seu e-mail e a cópia da nuvem na
          hora. Você escolhe se apaga também os dados deste aparelho.
        </Text>
      </Cartao>

      <Cartao>
        <Text style={estilos.titulo}>Créditos</Text>
        <Text style={estilos.texto}>
          Tabela de alimentos: TACO, Tabela Brasileira de Composição de Alimentos (NEPA/UNICAMP). Banco de dados na web:
          sql.js. Código sob a licença MIT.
        </Text>
      </Cartao>
    </ScrollView>
  );
}
