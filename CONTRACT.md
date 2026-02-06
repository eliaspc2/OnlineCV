# Contracto de Renderizacao (JSON Site)

Este e o contrato oficial para manipulacao do site.

## 1) Objeto visual (definicao)

Fica em `public/data/config.json` dentro de `objects.<objectKey>`.

Regras:
- tem `tag`
- tem `classKey` (obrigatoria)
- `classKey` aponta para `public/data/class-keys.json -> classPresets`

Exemplo:

```json
{
  "objects": {
    "hero.cta.primary": {
      "tag": "a",
      "classKey": "parts.ctaPrimary",
      "attrs": {
        "href": "#contact"
      }
    }
  }
}
```

## 2) Deploy (instancia no layout)

Fica em `layout.*` e `pages[].sections[].nodes[]`.

Regras:
- tem `id` (obrigatorio)
- tem `ref` (obrigatorio) para `objects.<objectKey>`
- nao define estilo base; o estilo vem do objeto referenciado

Exemplo:

```json
{
  "pages": [
    {
      "id": "home",
      "sections": [
        {
          "id": "hero",
          "nodes": [
            {
              "id": "heroCtaPrimary",
              "ref": "hero.cta.primary"
            }
          ]
        }
      ]
    }
  ]
}
```

## 3) Strings (idiomas)

Ficam em `public/data/<lang>.json` na lista `references`.

Regra:
- texto de instancia e resolvido por `obj.<id>` (sem fallback para `objdef.*`)

Exemplo:

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

## 4) Pipeline de resolucao

1. Deploy encontra `ref` e resolve `objects.<objectKey>`.
2. `classKey` do objeto resolve classes em `class-keys.json`.
3. Render busca strings por `obj.<id>`.
4. Render monta no local definido pela arvore `layout/pages`.
