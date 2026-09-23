// Apaga o backup e a conta do usuario que fez a chamada.
// A chave de servico so existe no ambiente do Supabase, nunca no app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "metodo nao permitido" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return resposta({ erro: "sem token" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Identifica o usuario pelo token dele, nunca por um id vindo no corpo.
  const { data: quem, error: erroUsuario } = await admin.auth.getUser(token);
  if (erroUsuario || !quem?.user) return resposta({ erro: "token invalido" }, 401);
  const userId = quem.user.id;

  const { error: erroBackup } = await admin.from("backups").delete().eq("user_id", userId);
  if (erroBackup) return resposta({ erro: "falha ao apagar backup" }, 500);

  const { error: erroConta } = await admin.auth.admin.deleteUser(userId);
  if (erroConta) return resposta({ erro: "falha ao apagar conta" }, 500);

  return resposta({ ok: true });
});
