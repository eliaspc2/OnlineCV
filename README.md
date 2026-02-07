# JSON Site — Documentação

Este site é **100% controlado por JSON**. O frontend (React + Vite) **não tem lógica do conteúdo** — apenas lê o JSON e renderiza a árvore de nós.

Contrato oficial de modelação/manipulação: `CONTRACT.md`.

## Estrutura

```
json-site/
  public/
    data/
      config.json
      class-keys.json
      pt-pt.json
      es-es.json
      fr-fr.json
      uk-en.json
    assets/
      images/
        icons/
        flags/
        brand/
      docs/
    editor.html
    editor.js
    editor.css
    sw.js
  src/
```

- `json-site/index.html` — entrada Vite
- `json-site/src/` — renderer genérico (lê `public/data/config.json`)
- `json-site/public/data/` — **fontes de verdade (JSON)**
  - `config.json` — layout/estética + chaves de texto
  - `class-keys.json` — catálogo mestre de `classKey -> classes CSS`
  - `pt-pt.json`, `es-es.json`, `fr-fr.json`, `uk-en.json` — strings por idioma
- `json-site/public/assets/images/` — **imagens** (inclui `icons/`, `flags/`, `brand/`)
- `json-site/public/assets/docs/` — **documentos** (PDFs)
- `json-site/public/editor.html` — editor simples (carrega os JSONs centrais)
- `json-site/public/sw.js` — service worker (PWA)

## Como funciona o renderer

O renderer React carrega `public/data/config.json`, `public/data/class-keys.json` e o ficheiro de idioma ativo.

Modelo:
- `objects.<key>`: definição visual (tem `tag` + `classKey`).
- `layout/pages`: deploy por instância (tem `id` + `ref` para `objects.<key>`).
- `idioma.references[]`: strings por instância em `ref = obj.<id>`.

## Configuração global

`config.meta` define o tema e metadados (strings ficam nas chaves):

```
  "meta": {
  "titleKey": "meta.title",
  "descriptionKey": "meta.description",
  "lang": "en-GB",
  "defaultLanguage": "en-GB",
  "classPresetsFile": "data/class-keys.json",
  "theme": {
    "bg": "#fcfcfd",
    "text": "#0f172a",
    "muted": "#64748b",
    "accent": "#3b82f6"
  },
  "languages": [
    { "code": "pt-PT", "label": "PT", "stringsFile": "data/pt-pt.json", "flag": "assets/images/flags/flag-pt.svg" },
    { "code": "es-ES", "label": "ES", "stringsFile": "data/es-es.json", "flag": "assets/images/flags/flag-es.svg" },
    { "code": "fr-FR", "label": "FR", "stringsFile": "data/fr-fr.json", "flag": "assets/images/flags/flag-fr.svg" },
    { "code": "en-GB", "label": "UK", "stringsFile": "data/uk-en.json", "flag": "assets/images/flags/flag-uk.svg" }
  ],
  "favicon": {
    "icon": "assets/images/brand/favicon.png",
    "appleTouchIcon": "assets/images/brand/apple-touch-icon.png"
  },
  "pwa": {
    "enabled": true,
    "nameKey": "meta.pwa.name",
    "shortNameKey": "meta.pwa.shortName",
    "descriptionKey": "meta.pwa.description",
    "startUrl": "./?lang=uk-en",
    "scope": "./",
    "display": "standalone",
    "themeColor": "#f8fafc",
    "backgroundColor": "#f8fafc",
    "icons": [
    { "src": "assets/images/brand/pwa-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "assets/images/brand/pwa-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }
}
```

## Catálogo de class keys

As classes visuais ficam no ficheiro dedicado `public/data/class-keys.json`.

Formato:

```json
{
  "version": 1,
  "classPresets": {
    "parts": {
      "ctaPrimary": "btn-primary flex items-center gap-2"
    },
    "visual": {
      "hero": {
        "title": "text-4xl font-bold"
      }
    }
  }
}
```

No `config.json`, cada nó deployado (`layout`/`pages`) deve ter `classKey` (ou `ref` para um objeto que tenha `classKey`).
O validador verifica esta regra.

O tema é aplicado via CSS variables.

## Strings por idioma

Cada ficheiro de idioma usa `globals` + `references`:

```json
{
  "lang": "pt-PT",
  "globals": {
    "meta.title": "Andre Camara"
  },
  "references": [
    {
      "ref": "obj.heroCtaPrimary",
      "strings": {
        "text": "Vamos Conversar?"
      }
    }
  ]
}
```

## Layout base

`config.layout.header`, `config.layout.footer` e `config.layout.floating` são **arrays de nós** que são renderizados sempre:

```
"layout": {
  "header": [ ...nós... ],
  "footer": [ ...nós... ],
  "floating": [ ...nós... ]
}
```

## Páginas e secções

`config.pages` é um array de páginas. Cada página tem `sections` e cada secção tem `nodes`.

Exemplo:

```
"pages": [
  {
    "id": "home",
    "sections": [
      {
        "id": "hero",
        "nodes": [ { ... } ]
      }
    ]
  }
]
```

A ordem das secções **é a ordem no array**.

## Assets (imagens e documentos)

- Imagens: `json-site/public/assets/images/`
- Documentos: `json-site/public/assets/docs/`

Dentro de `assets/images/` ficam `icons/` (ícones UI), `flags/` (bandeiras) e `brand/` (favicon/PWA).

Exemplo:

```
"attrs": { "src": "assets/images/profile-main.png" }
"attrs": { "href": "assets/docs/cv-andre-camara.pdf" }
```

## Comportamento de links e documentos

Os links são configurados no próprio JSON (`attrs` do nó `a`):

- `href`: destino do link
- `download`: nome do ficheiro para download (quando aplicável)
- `data-open-inline`: controla se abre no viewer interno

Exemplos:

```json
{
  "tag": "a",
  "attrs": {
    "href": "assets/docs/cv-andre-camara.pdf",
    "download": "cv-andre-camara.pdf",
    "data-open-inline": "true"
  }
}
```

```json
{
  "tag": "a",
  "attrs": {
    "href": "https://github.com/eliaspc2",
    "target": "_blank",
    "rel": "noopener noreferrer"
  }
}
```

Regras práticas:

- Documentos (`assets/docs/...`): usar `data-open-inline: "true"` para abrir no modal interno.
- Links externos (`https://...`): usar `target: "_blank"` (e idealmente `rel: "noopener noreferrer"`).

## Como publicar

1. Faz build com `npm run build`
2. Publica a pasta `dist/`

> O `manifest.json` e os ícones PWA são gerados a partir do JSON.

## Como editar

Qualquer editor pode gerar o `public/data/config.json`. Se criares uma app externa, tens de:

1. Respeitar a estrutura de nós
2. Referenciar imagens em `assets/images/...` e documentos em `assets/docs/...`
3. Manter `classKey` nos nós e classes no catálogo `data/class-keys.json`

## Dicas

- Para mudar o layout, modifica as classes e a estrutura dos nós
- Para mudar cores globais, edita `config.meta.theme`
- Para adicionar uma nova secção, cria um novo objeto em `pages[0].sections`

## Idiomas

Se `meta.languages` estiver definido, o site cria um seletor de idioma (bandeiras) à direita.
Cada botão carrega o respetivo ficheiro de **strings** e faz re-render.

## Acordeões

O site usa atributos `data-accordion-*` para abrir/fechar painéis:

- `data-accordion-item`: id do item
- `data-accordion-group`: grupo (fecha os outros do mesmo grupo)
- `data-accordion-toggle`: botão/cabeçalho de toggle
- `data-accordion-panel`: conteúdo colapsável

Para manter “apenas um aberto de cada vez”, todos os itens devem partilhar o mesmo `data-accordion-group`.

## Notas de consola (PDF/Service Worker)

- Warnings do `pdf.mjs`/cookies particionados podem aparecer ao embebedar PDFs no browser; são comuns e não bloqueiam a app.
- Após deploy, se vires comportamento antigo, faz `Shift + Refresh` para limpar cache do service worker.

Se precisares, posso gerar um **schema JSON** e um **editor visual**.

## Validação automática (console)

O frontend (`src/App.tsx`) valida o `public/data/config.json` ao carregar. Em caso de erro ou aviso, verás mensagens no console do browser.

## Editor simples

Abre `json-site/public/editor.html`:

- **Carregar ficheiros**: carrega `public/data/config.json` + ficheiros de strings
- **Validar**: valida o JSON (erros no console)
- **Download**: gera o ficheiro selecionado
- **Agregado**: vista em árvore (estilo regedit) + painel JSON por seleção, sem chavetas; permite editar textos e configuração (classes/attrs/styles)
- O editor abre no separador **Agregado** por defeito.

O editor guarda rascunho em `localStorage`.
    "classPresetsFile": "data/class-keys.json",
