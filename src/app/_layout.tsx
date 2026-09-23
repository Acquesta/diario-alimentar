import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, useFonts } from '@expo-google-fonts/manrope';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TemaProvider, useTema } from '@/components/ui';
import { BancoProvider } from '@/lib/banco';
import { ContaProvider } from '@/lib/conta';

// Na web, pede ao navegador para não apagar os dados do app por falta de espaço ou de uso.
if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
  navigator.storage?.persist?.().catch(() => {});
}

export default function Layout() {
  const [fontesProntas] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  return (
    <SafeAreaProvider>
      <BancoProvider carregando={<Espera />}>
        <TemaProvider>
          <ContaProvider>{fontesProntas ? <Navegacao /> : <Espera />}</ContaProvider>
        </TemaProvider>
      </BancoProvider>
    </SafeAreaProvider>
  );
}

/** Tela de espera enquanto o banco abre e as fontes carregam. */
function Espera() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2F7D5B" />
    </View>
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
          headerTitleStyle: { color: cores.texto, fontFamily: 'Manrope_600SemiBold' },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="adicionar" options={{ title: 'Adicionar alimento' }} />
        <Stack.Screen name="novo-alimento" options={{ title: 'Novo alimento' }} />
        <Stack.Screen name="codigo-barras" options={{ title: 'Código de barras' }} />
        <Stack.Screen name="prato" options={{ title: 'Prato' }} />
        <Stack.Screen name="privacidade" options={{ title: 'Privacidade' }} />
        <Stack.Screen name="apagar-conta" options={{ title: 'Apagar conta e dados' }} />
      </Stack>
    </>
  );
}
