import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { FONTES, useTema } from '@/components/ui';

/** As quatro áreas do app. O que abre de dentro delas fica na pilha de cima. */
export default function AbasLayout() {
  const { cores } = useTema();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerShadowVisible: false,
        headerTintColor: cores.primaria,
        headerTitleStyle: { color: cores.texto, fontFamily: FONTES.textoForte },
        sceneStyle: { backgroundColor: cores.fundo },
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.suave,
        tabBarStyle: { backgroundColor: cores.cartao, borderTopColor: cores.borda },
        tabBarLabelStyle: { fontFamily: FONTES.textoMedio, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Alimentação',
          headerTitle: 'Diário Alimentar',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="agua"
        options={{
          title: 'Água',
          tabBarIcon: ({ color, size }) => <Ionicons name="water-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exercicios"
        options={{
          title: 'Exercícios',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          headerTitle: 'Meu perfil e meta',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
