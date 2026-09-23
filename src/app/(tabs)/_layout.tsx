import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '@/components/ui';

/** As quatro áreas do app. O que abre de dentro delas fica na pilha de cima. */
/** Altura da barra sem contar a faixa do indicador de início do iPhone. */
const ALTURA_ABAS = 64;

export default function AbasLayout() {
  const { cores, escuro } = useTema();
  const margens = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        // Sem cabeçalho nas abas: o nome da tela já está na barra de baixo.
        headerShown: false,
        sceneStyle: { backgroundColor: cores.fundo, paddingTop: margens.top },
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.suave,
        // A barra fica translúcida e o conteúdo passa por baixo dela ao rolar.
        // A altura soma a faixa de baixo do aparelho, senão o texto fica cortado.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: cores.borda,
          height: ALTURA_ABAS + margens.bottom,
          paddingTop: 6,
          paddingBottom: margens.bottom + 8,
        },
        // flexShrink: 0 impede o texto de ser espremido e cortar a cauda do "ç".
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, marginTop: 2, flexShrink: 0, fontFamily: 'Manrope_500Medium' },
        tabBarIconStyle: { flexShrink: 0 },
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
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
