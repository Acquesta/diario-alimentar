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
| `GEMINI_MODELOS` | Opcional. Lista de modelos separados por vírgula, na ordem de preferência. Padrão: `gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.6-flash` |
| `GEMINI_MODELO` | Nome antigo, com um modelo só. Ainda funciona, mas `GEMINI_MODELOS` vem antes |
| `TETO_DIARIO` | Opcional. Quantas fotos cada pessoa manda por dia. Padrão: 30 |
| `TETO_MENSAL` | Opcional. Quantas fotos o app inteiro aceita por mês, somando todo mundo. Padrão: 2000. `0` desliga o teto |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm prontos no ambiente das funções.

## Publicar

O deploy foi feito pelo painel do Supabase. Com a CLI, seria:

```bash
supabase functions deploy estimar-foto --project-ref jndgkiogqujfldqcbjiv
```

Os arquivos aqui são a cópia do que está no ar, para o histórico ficar no git.
Ao mudar uma função, mude aqui e publique; o que vale é a versão publicada.

## Teto de uso

São dois tetos, os dois contados na tabela `usos_ia`:

- **Por pessoa:** `TETO_DIARIO` fotos por dia, padrão 30. Quem conta é a função `registrar_uso_ia`, no
  banco, que desfaz a contagem quando recusa, para o pedido recusado não gastar cota.
- **Do app inteiro:** `TETO_MENSAL` fotos por mês, somando todo mundo, conferido
  pela função `uso_ia_do_mes` antes de contar o uso da pessoa.

O teto mensal existe por causa da cobrança. Com a chave no plano pago, o Google
manda alerta de gasto mas não corta o serviço, então o corte tem que ser aqui.
Vale escolher o número abaixo do que se quer gastar, com folga: no
`gemini-3.5-flash-lite` cada foto custa perto de US$ 0,001.

## Quando a IA não responde

`estimar-foto` percorre a lista de modelos até um responder, até oito voltas com
espera crescente. Cada tentativa tem 30 s, e o conjunto todo para em 110 s, antes
do limite de 150 s do worker do Supabase. Modelo que devolve 404 ou 429 sai da
busca: um não existe mais, o outro só volta quando a cota do dia virar. Sem esses cortes a chamada ficava pendurada e o app devolvia
`WORKER_RESOURCE_LIMIT` depois de dois minutos e meio.

A resposta de erro traz `tentativas`, com o modelo, o status e o tempo de cada
uma. É por ali que se descobre se o problema é fila cheia (503), limite da chave
(429) ou modelo aposentado (404).
