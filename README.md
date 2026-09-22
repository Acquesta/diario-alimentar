# Diário Alimentar

App para registrar o que se come e ver calorias e macros do dia. Uso pessoal, feito com Expo (React Native) e publicado como PWA para iPhone.

## O que faz

- Diário por dia com quatro refeições e total de calorias, proteína, carboidrato e gordura.
- Meta diária calculada pela equação de Mifflin-St Jeor (sexo, idade, altura, peso, atividade e objetivo), ou meta manual.
- Busca em 593 alimentos da TACO (Tabela Brasileira de Composição de Alimentos), sem acento e em qualquer ordem.
- Porção em gramas, com atalhos de 50 a 300 g.
- Favoritos com a porção salva, lista de usados recentemente e "Repetir de ontem" por refeição.
- Cadastro de alimento pelo rótulo da embalagem, convertido para 100 g.
- Dados só no aparelho (SQLite), sem conta e sem servidor.

## Comandos

```bash
npm start            # servidor de desenvolvimento (Expo)
npm test             # testes de cálculo e busca
npm run typecheck    # checagem de tipos
npm run build:web    # gera a PWA em dist/
npm run serve:web    # serve dist/ localmente com os headers certos
npm run build:taco   # regenera src/data/taco.json a partir do CSV
```

## Publicar a PWA

O expo-sqlite na web usa SQLite em WebAssembly com `SharedArrayBuffer`, que só funciona com isolamento de origem. O host precisa enviar estes headers em todas as respostas:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Use `require-corp`, não `credentialless`: o Safari do iPhone não suporta `credentialless`. Rotas desconhecidas devem cair em `index.html`.

O `vercel.json` já traz esses headers e o redirecionamento das rotas.

### Plano B de armazenamento

Se o navegador não permitir o expo-sqlite (sem `SharedArrayBuffer`, sem OPFS, ou se ele não abrir em 8 segundos), o app usa o sql.js: o mesmo SQLite em WebAssembly, rodando na página, com o banco gravado no IndexedDB. As consultas SQL são as mesmas nos dois casos (`src/lib/banco.tsx`). A tela "Meu perfil e meta" mostra qual está em uso.

Para testar o plano B: abrir com `?armazenamento=indexeddb`, ou servir sem os headers com `SEM_ISOLAMENTO=1 npm run serve:web`. O `sql.js` fica em `public/sqljs/` fora do bundle, porque usa módulos do Node que o Metro não empacota (`npm run build:sqljs` atualiza a cópia).

### No iPhone

Abrir o link no Safari, tocar em Compartilhar e em "Adicionar à Tela de Início". Instalado assim, o Safari não apaga os dados por falta de uso.

## Dados

- `scripts/taco_composicao.csv`: TACO 4ª edição (NEPA/UNICAMP), normalizada em [brolesi/taco](https://github.com/brolesi/taco).
- Quatro itens sem nenhum valor analisado na TACO ficam de fora, entre eles leite integral e leite desnatado. Cadastre pelo rótulo.
- Os dados da TACO pertencem às fontes originais. Confira os termos antes de distribuir o app além do uso pessoal.
