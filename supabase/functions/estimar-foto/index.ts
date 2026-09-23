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
/** Da para trocar pelo segredo GEMINI_MODELO sem mexer no codigo. */
const MODELO = Deno.env.get("GEMINI_MODELO") ?? "gemini-3.6-flash";
/** O Gemini devolve 503 quando esta cheio. Vale esperar e tentar de novo. */
const TENTATIVAS = 3;
const ESPERA_MS = [800, 2500];

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

/** Le a resposta do modelo, que as vezes vem embrulhada em ```json. */
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

  const endereco =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${chave}`;
  const pedido = {
    contents: [{
      parts: [
        { text: INSTRUCAO },
        { inline_data: { mime_type: corpo.tipo ?? "image/jpeg", data: imagem } },
      ],
    }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  let textoModelo = "";
  let ultimoStatus = 0;
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    if (tentativa > 0) await espera(ESPERA_MS[tentativa - 1] ?? 2500);
    try {
      const r = await fetch(endereco, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
      if (r.ok) {
        const json = await r.json();
        textoModelo = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
        break;
      }
      ultimoStatus = r.status;
      const detalhe = await r.text();
      console.error("gemini", r.status, detalhe.slice(0, 300));
      // 503 e 429 sao fila cheia: vale esperar. O resto nao melhora tentando de novo.
      if (r.status !== 503 && r.status !== 429) break;
    } catch (e) {
      ultimoStatus = 0;
      console.error("gemini", e);
    }
  }

  if (!textoModelo) {
    const erro = ultimoStatus === 404
      ? "O modelo configurado nao existe mais. Ajuste o segredo GEMINI_MODELO."
      : ultimoStatus === 503 || ultimoStatus === 429
      ? "A IA esta congestionada agora. Tente de novo em um minuto."
      : "A IA nao respondeu agora. Tente de novo em instantes.";
    return resposta({ erro }, 502);
  }

  const itens = lerItens(textoModelo);
  if (itens === null) {
    console.error("resposta fora do formato:", textoModelo.slice(0, 300));
    return resposta({ erro: "Nao consegui ler o prato desta foto." }, 422);
  }

  return resposta({ itens, usadoHoje: usado, tetoDiario: TETO_DIARIO });
});
