# Funções do Supabase

Estas são as funções que rodam no servidor do projeto `diario-alimentar`
(`jndgkiogqujfldqcbjiv`, região São Paulo). Elas existem porque precisam de algo
que não pode ficar no app: a chave de serviço do banco e a chave do Gemini.

| Função | O que faz |
|---|---|
| `apagar-conta` | Apaga a conta e o backup da nuvem. Identifica a pessoa pelo token dela, nunca por um id vindo no pedido. |
| `estimar-foto` | Recebe a foto do prato, chama o Gemini e devolve a lista de alimentos estimados. |

As duas exigem token válido (`verify_jwt`), ou seja, só funcionam com a pessoa
logada no app.

## Segredos

Ficam no painel do Supabase, em Edge Functions > Secrets. O código nunca os vê
fora do servidor.

| Nome | Para quê |
|---|---|
| `GEMINI_API_KEY` | Chave do Gemini, de https://aistudio.google.com/apikey |
| `GEMINI_MODELO` | Opcional. Troca o modelo sem mexer no código. Padrão: `gemini-3.6-flash` |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm prontos no ambiente das funções.

## Publicar

O deploy foi feito pelo painel do Supabase. Com a CLI, seria:

```bash
supabase functions deploy estimar-foto --project-ref jndgkiogqujfldqcbjiv
```

Os arquivos aqui são a cópia do que está no ar, para o histórico ficar no git.
Ao mudar uma função, mude aqui e publique; o que vale é a versão publicada.

## Teto de uso

`estimar-foto` conta as chamadas na tabela `usos_ia` e recusa acima de 20 por
pessoa por dia. Quem conta é a função `registrar_uso_ia`, no banco, que desfaz a
contagem quando recusa, para o pedido recusado não gastar cota.
