// Estima o que tem no prato a partir de uma foto, usando o Gemini.
// A chave fica em GEMINI_API_KEY, no painel do Supabase, e nunca sai daqui.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Quantas fotos cada pessoa pode mandar por dia. */
const TETO_DIARIO = 20;
/** Tamanho maximo da imagem depois da reducao feita no aparelho. */
const LIMITE_IMAGEM = 4 * 1024 * 1024;
/**
 * Modelos na ordem de preferencia. Quando um esta lotado, o proximo assume.
 * Da para trocar a lista pelo segredo GEMINI_MODELOS, separando por virgula.
 */
const MODELOS = (Deno.env.get("GEMINI_MODELOS") ?? Deno.env.get("GEMINI_MODELO") ??
  "gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.6-flash")
  .split(",").map((m) => m.trim()).filter(Boolean);
/** Quanto esperar por uma tentativa. Sem isso a chamada fica pendurada. */
const TEMPO_TENTATIVA_MS = 30_000;
/** Teto somando todas as tentativas. O worker do Supabase morre aos 150 s. */
const ORCAMENTO_MS = 110_000;
/**
 * Quantas voltas na lista de modelos. Fila cheia costuma passar em segundos, e
 * o 503 volta rapido, entao vale insistir enquanto o orcamento de tempo permitir.
 */
const RODADAS = 8;

const INSTRUCAO = `Voce recebe a foto de um prato de comida brasileiro.
Liste os alimentos que aparecem, com a quantidade estimada em gramas e os valores
nutricionais da porcao inteira (nao por 100 g).

Regras:
- Responda apenas com o JSON, sem texto em volta e sem blocos de codigo.
- Formato: {"itens":[{"nome":"","gramas":0,"kcal":0,"proteina":0,"carboidrato":0,"gordura":0,"confianca":"alta|media|baixa"}]}
- Nomes curtos, em portugues do Brasil, como "Arroz branco" ou "File de frango grelhado".
- No maximo 8 itens. Junte o que for do mesmo tipo.
- Se a foto nao tiver comida, responda {"itens":[]}.
- Use pratos e talheres como referencia de tamanho quando der.`;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type Item = {
  nome: string;
  gramas: number;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  confianca: string;
};

/** Le a resposta do modelo, que as vezes vem embrulhada em cercas de codigo. */
function lerItens(texto: string): Item[] | null {
  const limpo = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let cru: unknown;
  try {
    cru = JSON.parse(limpo);
  } catch {
    return null;
  }
  const lista = (cru as { itens?: unknown })?.itens;
  if (!Array.isArray(lista)) return null;

  const numero = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const itens: Item[] = [];
  for (const bruto of lista.slice(0, 8)) {
    const i = bruto as Record<string, unknown>;
    const nome = typeof i.nome === "string" ? i.nome.trim() : "";
    const gramas = Math.round(numero(i.gramas));
    const kcal = Math.round(numero(i.kcal));
    if (!nome || gramas <= 0 || kcal <= 0) continue;
    itens.push({
      nome,
      gramas,
      kcal,
      proteina: Math.round(numero(i.proteina) * 10) / 10,
      carboidrato: Math.round(numero(i.carboidrato) * 10) / 10,
      gordura: Math.round(numero(i.gordura) * 10) / 10,
      confianca: i.confianca === "alta" || i.confianca === "baixa" ? i.confianca : "media",
    });
  }
  return itens;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** O que aconteceu em cada tentativa, para o log e para a resposta de erro. */
type Tentativa = { modelo: string; status: number | string; ms: number };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "metodo nao permitido" }, 405);

  const chave = Deno.env.get("GEMINI_API_KEY");
  if (!chave) return resposta({ erro: "A chave do Gemini ainda nao foi configurada." }, 503);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return resposta({ erro: "sem token" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: quem, error: erroUsuario } = await admin.auth.getUser(token);
  if (erroUsuario || !quem?.user) return resposta({ erro: "token invalido" }, 401);

  let corpo: { imagem?: string; tipo?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "corpo invalido" }, 400);
  }
  const imagem = corpo.imagem ?? "";
  if (!imagem || imagem.length > LIMITE_IMAGEM) {
    return resposta({ erro: "A foto esta vazia ou grande demais." }, 400);
  }

  const { data: usado, error: erroUso } = await admin.rpc("registrar_uso_ia", {
    p_user_id: quem.user.id,
    p_teto: TETO_DIARIO,
  });
  if (erroUso) return resposta({ erro: "falha ao contar o uso" }, 500);
  if (usado === -1) {
    return resposta({ erro: `Voce ja usou as ${TETO_DIARIO} fotos de hoje. Tente amanha.` }, 429);
  }

  const pedido = {
    contents: [{
      parts: [
        { text: INSTRUCAO },
        { inline_data: { mime_type: corpo.tipo ?? "image/jpeg", data: imagem } },
      ],
    }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  const comeco = Date.now();
  const restante = () => ORCAMENTO_MS - (Date.now() - comeco);
  const tentativas: Tentativa[] = [];
  /** Modelo que nao existe mais nao volta nas proximas rodadas. */
  const semModelo = new Set<string>();
  let textoModelo = "";
  let modeloUsado = "";

  busca:
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    for (const modelo of MODELOS) {
      if (semModelo.has(modelo)) continue;
      if (restante() < 6_000) break busca;
      // Espera crescente entre tentativas, ate 5 s, para dar tempo da fila andar.
      if (tentativas.length > 0) await espera(Math.min(5_000, 300 + rodada * 1_200));

      const t0 = Date.now();
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pedido),
            signal: AbortSignal.timeout(Math.min(TEMPO_TENTATIVA_MS, Math.max(5_000, restante()))),
          },
        );
        tentativas.push({ modelo, status: r.status, ms: Date.now() - t0 });
        if (r.ok) {
          const json = await r.json();
          textoModelo = json?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
          modeloUsado = modelo;
          break busca;
        }
        const detalhe = await r.text();
        console.error("gemini", modelo, r.status, detalhe.slice(0, 300));
        // 404 saiu do ar; 429 e cota do dia, que nao volta em um minuto. Os dois
        // ficam de fora do resto da busca. 400 e 403 sao pedido ou chave ruim.
        if (r.status === 404 || r.status === 429) semModelo.add(modelo);
        if (r.status === 400 || r.status === 403) break busca;
      } catch (e) {
        // Estouro do tempo da tentativa cai aqui: o proximo modelo assume.
        tentativas.push({ modelo, status: "tempo", ms: Date.now() - t0 });
        console.error("gemini", modelo, e);
      }
    }
  }

  if (!textoModelo) {
    const status = tentativas.map((t) => t.status);
    const erro = status.length > 0 && status.every((s) => s === 404)
      ? "Nenhum modelo de IA da lista existe mais. Ajuste o segredo GEMINI_MODELOS."
      : status.includes(429)
      ? "A IA bateu o limite de uso da chave. Tente de novo mais tarde."
      : status.includes(503) || status.includes("tempo")
      ? "A IA esta congestionada agora. Tente de novo em um minuto."
      : "A IA nao respondeu agora. Tente de novo em instantes.";
    console.error("tentativas", JSON.stringify(tentativas));
    return resposta({ erro, tentativas }, 502);
  }

  const itens = lerItens(textoModelo);
  if (itens === null) {
    console.error("resposta fora do formato:", textoModelo.slice(0, 300));
    return resposta({ erro: "Nao consegui ler o prato desta foto." }, 422);
  }

  return resposta({ itens, usadoHoje: usado, tetoDiario: TETO_DIARIO, modelo: modeloUsado });
});
