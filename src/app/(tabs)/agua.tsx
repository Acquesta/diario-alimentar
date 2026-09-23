import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AvisoDesfazer, Barra, Botao, Cartao, Chip, formatar, useTema } from '@/components/ui';
import { useAoAlterar, useBanco } from '@/lib/banco';
import { hoje, rotulo, somarDias } from '@/lib/dates';
import {
  lerConfig,
  lerPeso,
  listarAgua,
  registrarAgua,
  removerAgua,
  restaurarAgua,
  salvarConfig,
  type RegistroAgua,
} from '@/lib/db';
import { metaAgua } from '@/lib/nutrition';

/** Tempo para desfazer uma remoção. */
const JANELA_DESFAZER_MS = 6000;

const COPOS = [
  { ml: 200, nome: 'Copo' },
  { ml: 300, nome: 'Caneca' },
  { ml: 500, nome: 'Garrafa' },
];

const CHAVE_META = 'meta_agua_ml';

export default function TelaAgua() {
  const { cores, estilos } = useTema();
  const db = useBanco();
  const [data, setData] = useState(hoje());
  const [registros, setRegistros] = useState<RegistroAgua[]>([]);
  const [pesoKg, setPesoKg] = useState<number | null>(null);
  const [metaSalva, setMetaSalva] = useState<number | null>(null);
  const [removido, setRemovido] = useState<RegistroAgua | null>(null);
  const [livre, setLivre] = useState('');
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTexto, setMetaTexto] = useState('');

  const carregar = useCallback(async () => {
    const [regs, p, m] = await Promise.all([listarAgua(db, data), lerPeso(db), lerConfig(db, CHAVE_META)]);
    setRegistros(regs);
    setPesoKg(p);
    setMetaSalva(m ? Number(m) : null);
  }, [db, data]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  // As abas ficam montadas ao mesmo tempo: recarrega quando outra aba grava algo.
  const aoAlterar = useAoAlterar();
  useEffect(() => aoAlterar(() => carregar()), [aoAlterar, carregar]);

  useEffect(() => {
    if (!removido) return;
    const t = setTimeout(() => setRemovido(null), JANELA_DESFAZER_MS);
    return () => clearTimeout(t);
  }, [removido]);

  const total = registros.reduce((soma, r) => soma + r.ml, 0);
  const meta = metaSalva ?? (pesoKg ? metaAgua({ pesoKg }) : null);

  const beber = async (ml: number) => {
    await registrarAgua(db, data, ml);
    carregar();
  };

  const mlLivre = Math.round(Number(livre.replace(',', '.')));
  const livreValido = Number.isFinite(mlLivre) && mlLivre > 0 && mlLivre <= 5000;

  const novaMeta = Math.round(Number(metaTexto.replace(',', '.')));
  const metaValida = Number.isFinite(novaMeta) && novaMeta >= 500 && novaMeta <= 8000;

  return (
    <View style={estilos.tela}>
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={estilos.linhaEntre}>
          <Seta texto="‹" rotuloAcessivel="Dia anterior" onPress={() => setData(somarDias(data, -1))} />
          <Pressable onPress={() => setData(hoje())} accessibilityRole="button" accessibilityLabel="Voltar para hoje">
            <Text style={[estilos.titulo, { fontSize: 20 }]}>{rotulo(data)}</Text>
          </Pressable>
          <Seta texto="›" rotuloAcessivel="Próximo dia" onPress={() => setData(somarDias(data, 1))} />
        </View>

        <Cartao>
          <View style={estilos.linhaEntre}>
            <View>
              <Text style={estilos.numero}>{litros(total)}</Text>
              <Text style={estilos.suave}>{meta ? `de ${litros(meta)}` : 'bebidos hoje'}</Text>
            </View>
            {meta ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[estilos.titulo, { color: cores.primaria, fontVariant: ['tabular-nums'] }]}>
                  {total >= meta ? 'Meta batida' : litros(meta - total)}
                </Text>
                <Text style={estilos.suave}>{total >= meta ? '' : 'faltando'}</Text>
              </View>
            ) : null}
          </View>
          {meta ? <Barra rotulo="Água" valor={total} meta={meta} cor={cores.proteina} unidade="ml" /> : null}
          {!meta ? (
            <Text style={estilos.suave}>
              Preencha seu peso na aba Perfil para o app calcular a meta de água, ou defina a meta aqui.
            </Text>
          ) : null}
        </Cartao>

        <Cartao>
          <Text style={estilos.titulo}>Registrar</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {COPOS.map((c) => (
              <View key={c.ml} style={{ flex: 1 }}>
                <Botao titulo={`${c.nome}\n${c.ml} ml`} tipo="secundario" onPress={() => beber(c.ml)} />
              </View>
            ))}
          </View>
          <Text style={estilos.suave}>Outra quantidade, em ml</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              style={[estilos.input, { flex: 1 }]}
              value={livre}
              onChangeText={setLivre}
              keyboardType="number-pad"
              placeholder="ex.: 750…"
              placeholderTextColor={cores.suave}
              accessibilityLabel="Quantidade em ml"
            />
            <View style={{ flexShrink: 0 }}>
              <Botao
                titulo="Adicionar"
                desabilitado={!livreValido}
                onPress={async () => {
                  await beber(mlLivre);
                  setLivre('');
                }}
              />
            </View>
          </View>
        </Cartao>

        <Cartao>
          <View style={estilos.linhaEntre}>
            <Text style={estilos.titulo}>Hoje</Text>
            <Text style={[estilos.suave, { fontVariant: ['tabular-nums'] }]}>{registros.length === 1 ? '1 registro' : `${registros.length} registros`}</Text>
          </View>
          {registros.length === 0 ? (
            <Text style={estilos.suave}>Nada registrado neste dia.</Text>
          ) : (
            registros.map((r) => (
              <View key={r.id} style={estilos.linhaEntre}>
                <Text style={estilos.texto}>
                  {formatar(r.ml)} ml · {hora(r.criado_em)}
                </Text>
                <Pressable
                  onPress={async () => {
                    await removerAgua(db, r.id);
                    setRemovido(r);
                    carregar();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover registro de ${formatar(r.ml)} ml`}
                  hitSlop={8}
                  style={{ paddingHorizontal: 6 }}
                >
                  <Text style={{ fontSize: 20, color: cores.suave }}>×</Text>
                </Pressable>
              </View>
            ))
          )}
        </Cartao>

        <Cartao>
          <Text style={estilos.titulo}>Meta de água</Text>
          {editandoMeta ? (
            <>
              <Text style={estilos.suave}>Em ml, entre 500 e 8000</Text>
              <TextInput
                style={estilos.input}
                value={metaTexto}
                onChangeText={setMetaTexto}
                keyboardType="number-pad"
                placeholder="ex.: 3000…"
                placeholderTextColor={cores.suave}
                accessibilityLabel="Meta de água em ml"
              />
              <Botao
                titulo="Salvar meta"
                desabilitado={!metaValida}
                onPress={async () => {
                  await salvarConfig(db, CHAVE_META, String(novaMeta));
                  setEditandoMeta(false);
                  carregar();
                }}
              />
              {metaSalva !== null ? (
                <Botao
                  titulo="Voltar a calcular pelo peso"
                  tipo="secundario"
                  onPress={async () => {
                    await salvarConfig(db, CHAVE_META, '');
                    setMetaSalva(null);
                    setEditandoMeta(false);
                    carregar();
                  }}
                />
              ) : null}
              <Botao titulo="Cancelar" tipo="secundario" onPress={() => setEditandoMeta(false)} />
            </>
          ) : (
            <>
              <Text style={estilos.suave}>
                {metaSalva !== null
                  ? 'Meta definida por você.'
                  : pesoKg
                    ? `Calculada pelo seu peso: 35 ml por kg. É uma estimativa; sede, calor e exercício mudam a necessidade.`
                    : 'Sem peso no perfil, defina a meta aqui.'}
              </Text>
              <Chip
                texto={meta ? `Trocar meta (${litros(meta)})` : 'Definir meta'}
                onPress={() => {
                  setMetaTexto(meta ? String(meta) : '');
                  setEditandoMeta(true);
                }}
              />
            </>
          )}
        </Cartao>
      </ScrollView>

      {removido ? (
        <AvisoDesfazer
          texto={`${formatar(removido.ml)} ml removidos`}
          onDesfazer={async () => {
            await restaurarAgua(db, removido);
            setRemovido(null);
            carregar();
          }}
        />
      ) : null}
    </View>
  );
}

/** Mostra 1,4 L a partir de 1400 ml. Abaixo de 1 L, fica em ml. */
function litros(ml: number): string {
  return ml >= 1000 ? `${formatar(Math.round(ml / 100) / 10)} L` : `${formatar(ml)} ml`;
}

/** "2026-09-22 18:05:00" vira "18:05". */
function hora(criadoEm: string): string {
  return criadoEm.slice(11, 16);
}

function Seta({ texto, rotuloAcessivel, onPress }: { texto: string; rotuloAcessivel: string; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      style={{ paddingHorizontal: 16, paddingVertical: 4 }}
    >
      <Text style={{ fontSize: 28, color: cores.primaria }}>{texto}</Text>
    </Pressable>
  );
}
