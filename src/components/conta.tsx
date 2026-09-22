import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Botao, Cartao, useTema } from '@/components/ui';
import { useConta } from '@/lib/conta';

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatarDataHora(iso: string): string {
  return DATA_HORA.format(new Date(iso));
}

/** Cartão do perfil: entrar com código no e-mail, backup e restauração. */
export function CartaoConta() {
  const { cores, estilos } = useTema();
  const conta = useConta();
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);

  if (!conta.disponivel) return null;

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codigoValido = /^\d{6,10}$/.test(codigo.trim());
  const nada = () => {};

  return (
    <Cartao>
      <View style={estilos.linhaEntre}>
        <Text style={estilos.titulo}>Conta e backup</Text>
        {conta.ocupado && <ActivityIndicator color={cores.primaria} />}
      </View>

      {!conta.usuario && !codigoEnviado && (
        <>
          <Text style={estilos.suave}>
            Opcional. Entre com seu e-mail para guardar uma cópia do diário na nuvem e não perder nada se trocar de
            celular ou apagar o app.
          </Text>
          <TextInput
            style={estilos.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={cores.suave}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            accessibilityLabel="E-mail"
          />
          <Botao
            titulo="Receber código por e-mail"
            desabilitado={!emailValido || conta.ocupado}
            onPress={() => conta.pedirCodigo(email).then(() => setCodigoEnviado(true), nada)}
          />
        </>
      )}

      {!conta.usuario && codigoEnviado && (
        <>
          <Text style={estilos.texto}>Mandamos um código para {email.trim()}.</Text>
          <Text style={estilos.suave}>Pode levar um minuto. Se não chegar, olhe a caixa de spam.</Text>
          <TextInput
            style={[estilos.input, { letterSpacing: 4, fontVariant: ['tabular-nums'] }]}
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
            placeholder="código"
            placeholderTextColor={cores.suave}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            accessibilityLabel="Código recebido por e-mail"
          />
          <Botao
            titulo="Entrar"
            desabilitado={!codigoValido || conta.ocupado}
            onPress={() => conta.confirmarCodigo(email, codigo).then(() => setCodigo(''), nada)}
          />
          <Botao
            titulo="Trocar e-mail ou pedir outro código"
            tipo="secundario"
            onPress={() => {
              setCodigo('');
              setCodigoEnviado(false);
            }}
          />
        </>
      )}

      {conta.usuario && (
        <>
          <Text style={estilos.texto}>{conta.usuario.email}</Text>
          <Text style={estilos.suave}>
            {conta.ultimoBackup ? `Último backup: ${formatarDataHora(conta.ultimoBackup)}` : 'Ainda sem backup.'}
            {' '}O backup é automático depois de cada alteração.
          </Text>

          {conta.pendencia && (
            <View style={{ gap: 8, padding: 12, borderRadius: 10, backgroundColor: cores.primariaSuave }}>
              <Text style={estilos.texto}>
                Há um backup na nuvem de {formatarDataHora(conta.pendencia.atualizadoEm)}
                {conta.pendencia.aparelho ? ` (${conta.pendencia.aparelho})` : ''}. Restaurar?
              </Text>
              {conta.pendencia.aparelhoTemDados && (
                <Text style={estilos.suave}>
                  Restaurar troca os dados deste aparelho pelos da nuvem. Os dados daqui ficam guardados e dá para desfazer.
                </Text>
              )}
              <Botao titulo="Restaurar o backup" onPress={() => conta.restaurar().catch(nada)} />
              {conta.pendencia.aparelhoTemDados && (
                <Botao
                  titulo="Manter os dados deste aparelho"
                  tipo="secundario"
                  onPress={() => conta.manterDoAparelho().catch(nada)}
                />
              )}
            </View>
          )}

          {!conta.pendencia && (
            <>
              <Botao titulo="Fazer backup agora" desabilitado={conta.ocupado} onPress={() => conta.fazerBackupAgora().catch(nada)} />
              {confirmarRestaurar ? (
                <View style={{ gap: 8 }}>
                  <Text style={estilos.suave}>
                    Os dados deste aparelho serão trocados pelos da nuvem. Os daqui ficam guardados e dá para desfazer.
                  </Text>
                  <Botao
                    titulo="Sim, restaurar"
                    onPress={() => conta.restaurar().then(() => setConfirmarRestaurar(false), nada)}
                  />
                  <Botao titulo="Cancelar" tipo="secundario" onPress={() => setConfirmarRestaurar(false)} />
                </View>
              ) : (
                <Botao titulo="Restaurar da nuvem" tipo="secundario" onPress={() => setConfirmarRestaurar(true)} />
              )}
              {conta.podeDesfazer && (
                <Botao titulo="Desfazer a restauração" tipo="secundario" onPress={() => conta.desfazerRestauracao().catch(nada)} />
              )}
            </>
          )}

          <Botao titulo="Sair da conta" tipo="secundario" onPress={() => conta.sair().catch(nada)} />
        </>
      )}

      {conta.erro && <Text style={[estilos.suave, { color: cores.perigo }]}>{conta.erro}</Text>}

      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <Text style={[estilos.suave, { color: cores.primaria }]} onPress={() => router.push('/privacidade')} accessibilityRole="link">
          Privacidade
        </Text>
        {conta.usuario && (
          <Text style={[estilos.suave, { color: cores.perigo }]} onPress={() => router.push('/apagar-conta')} accessibilityRole="link">
            Apagar minha conta e dados
          </Text>
        )}
      </View>
    </Cartao>
  );
}
