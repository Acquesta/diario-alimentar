import { router } from 'expo-router';

/** Volta para a tela anterior. Se a tela foi aberta direto por link, vai para o diário. */
export function voltar(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
