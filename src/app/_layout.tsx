import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import { TemaProvider, useTema } from '@/components/ui';
import { BancoProvider } from '@/lib/banco';

// Na web, pede ao navegador para não apagar os dados do app por falta de espaço ou de uso.
if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
  navigator.storage?.persist?.().catch(() => {});
}

export default function Layout() {
  return (
    <BancoProvider
      carregando={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2F7D5B" />
        </View>
      }
    >
      <TemaProvider>
        <Navegacao />
      </TemaProvider>
    </BancoProvider>
  );
}

function Navegacao() {
  const { cores, escuro } = useTema();

  // Na web, pinta o fundo da página e a barra do navegador com a cor do tema.
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.body.style.backgroundColor = cores.fundo;
    document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cores.fundo);
  }

  return (
    <>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerShadowVisible: false,
          headerTintColor: cores.primaria,
          headerTitleStyle: { color: cores.texto },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Diário Alimentar' }} />
        <Stack.Screen name="adicionar" options={{ title: 'Adicionar alimento' }} />
        <Stack.Screen name="perfil" options={{ title: 'Meu perfil e meta' }} />
        <Stack.Screen name="novo-alimento" options={{ title: 'Novo alimento' }} />
        <Stack.Screen name="prato" options={{ title: 'Prato' }} />
      </Stack>
    </>
  );
}
