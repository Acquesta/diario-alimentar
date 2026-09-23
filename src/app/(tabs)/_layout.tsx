import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useTema } from '@/components/ui';

/** As quatro áreas do app. O que abre de dentro delas fica na pilha de cima. */
export default function AbasLayout() {
  const { cores, escuro } = useTema();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerShadowVisible: false,
        headerTintColor: cores.primaria,
        headerTitleStyle: { color: cores.texto },
        sceneStyle: { backgroundColor: cores.fundo },
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.suave,
        // A barra fica translúcida e o conteúdo passa por baixo dela ao rolar.
        tabBarStyle: Platform.select({
          web: { backgroundColor: 'transparent', borderTopColor: cores.borda, position: 'absolute' },
          default: { backgroundColor: 'transparent', borderTopColor: cores.borda, position: 'absolute' },
        }),
        tabBarBackground: () => (
          <BlurView
            intensity={60}
            tint={escuro ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { backgroundColor: cores.cartao + 'B3' }]}
          />
        ),
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
