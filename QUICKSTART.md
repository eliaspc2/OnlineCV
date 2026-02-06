# Guia Rápido — Editar o JSON

Contrato oficial de modelação/manipulação: `CONTRACT.md`.

## 1) Mudar título, descrição e cores

`public/data/config.json` → `meta` (chaves), e depois editar `public/data/uk-en.json` / `public/data/pt-pt.json` / `public/data/es-es.json` / `public/data/fr-fr.json`:

```json
"meta": {
  "titleKey": "meta.title",
  "descriptionKey": "meta.description",
  "lang": "en-GB",
  "defaultLanguage": "en-GB",
  "theme": {
    "bg": "#ffffff",
    "text": "#111111",
    "muted": "#6b7280",
    "accent": "#2563eb"
  }
}
```

## 1b) Editar classes visuais (class keys)

As classes deixaram de estar no `config.json`. Agora ficam em:

- `public/data/class-keys.json`

Exemplo:

```json
{
  "version": 1,
  "classPresets": {
    "parts": {
      "ctaPrimary": "btn-primary flex items-center gap-2"
    }
  }
}
```

No `public/data/config.json`, aponta para o catálogo:

```json
"meta": {
  "classPresetsFile": "data/class-keys.json"
}
```

Regra: nós deployados em `layout` e `pages` devem ter `classKey` (ou `ref` para objeto com `classKey`).

## 2) Alterar textos no Hero

Procura `"id": "hero"` e muda os `textKey` para apontar para novas chaves de strings:

```json
{
  "tag": "h1",
  "class": "hero-title",
  "children": [
    { "tag": "span", "textKey": "hero.firstName" },
    { "tag": "span", "class": "accent", "textKey": "hero.lastName" }
  ]
}
```

E depois adiciona essas chaves no ficheiro de strings:

```json
{
  "strings": {
    "hero.firstName": "André",
    "hero.lastName": "Câmara"
  }
}
```

## 3) Trocar imagens

Procura um nó `img`:

```json
{ "tag": "img", "attrs": { "src": "assets/images/profile-main.png" } }
```

Troca por outro ficheiro dentro de `json-site/public/assets/images/`.

## 3b) Trocar documentos (PDF)

Procura um `href` para PDF:

```json
{ "tag": "a", "attrs": { "href": "assets/docs/cv-andre-camara.pdf" } }
```

Troca por outro ficheiro dentro de `json-site/public/assets/docs/`.

## 3c) Definir como abre cada link

Para documentos dentro da página (modal interno):

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

Para abrir num separador novo:

```json
{
  "tag": "a",
  "attrs": {
    "href": "https://example.com",
    "target": "_blank",
    "rel": "noopener noreferrer"
  }
}
```

## 4) Adicionar nova secção

Em `pages[0].sections`, adiciona um novo bloco:

```json
{
  "id": "nova-seccao",
  "nodes": [
    { "tag": "section", "attrs": { "id": "nova-seccao" }, "class": "section", "children": [
      { "tag": "div", "class": "container", "children": [
        { "tag": "h2", "class": "section-title", "text": "Nova secção" }
      ] }
    ] }
  ]
}
```

## 5) Criar botão

```json
{ "tag": "a", "classKey": "parts.ctaPrimary", "attrs": { "href": "#contact" }, "text": "Falar" }
```

## 6) Mudar ordem das secções

A ordem é a ordem no array `sections`.

## 7) Validar o JSON

Usa o schema:

- `json-site/config.schema.json`

## 8) PWA + favicon (via JSON)

```json
"favicon": {
  "icon": "assets/images/brand/favicon.svg",
  "appleTouchIcon": "assets/images/brand/pwa-icon.svg"
},
"pwa": {
  "enabled": true,
  "nameKey": "meta.pwa.name",
  "shortNameKey": "meta.pwa.shortName",
  "descriptionKey": "meta.pwa.description",
  "startUrl": "./?lang=uk-en",
  "display": "standalone",
  "themeColor": "#f8fafc",
  "backgroundColor": "#f8fafc",
  "icons": [
    { "src": "assets/images/brand/pwa-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

E depois as strings:

```json
{
  "strings": {
    "meta.pwa.name": "André Câmara — CV",
    "meta.pwa.shortName": "André CV",
    "meta.pwa.description": "Currículo digital do André Câmara."
  }
}
```

## 9) Publicar

1. `npm run build`
2. Faz deploy da pasta `dist/`

## 10) Editor integrado

Abre `json-site/public/editor.html`. O editor:

- Carrega os JSONs centrais
- Permite alternar entre ficheiros
- Faz download do ficheiro selecionado
- O separador **Agregado** mostra uma árvore (estilo regedit) e um painel JSON filtrado pela seleção
- O editor abre no **Agregado** por defeito

## 11) Se o site parecer desatualizado após deploy

1. Faz `Shift + Refresh` no browser.
2. Se necessário, abre DevTools e limpa o service worker/cache do domínio.

---

Se precisares de um editor visual para gerar este JSON, posso criar.
