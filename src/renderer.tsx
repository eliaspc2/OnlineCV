import React from 'react';
import type { NodeDef } from './validator';

const isVoidTag = (tag: string) =>
  ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tag);

const isAbsoluteUrl = (value: string) =>
  value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value);

const toPublicUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

const normalizeStyleValue = (value: unknown) => {
  if (typeof value !== 'string') return value;
  if (!value.includes('url(')) return value;
  return value.replace(/url\((['"]?)(\/[^'")]+)\1\)/g, (_match, quote, urlPath) => {
    if (isAbsoluteUrl(urlPath)) return _match;
    const resolved = toPublicUrl(urlPath);
    return `url(${quote}${resolved}${quote})`;
  });
};

export function renderNode(
  def: NodeDef,
  key?: React.Key,
  strings?: Record<string, string>
): React.ReactNode {
  const tag = def.tag || 'div';
  const Tag = tag as React.ElementType;

  const props: Record<string, unknown> = {};
  if (key !== undefined) props.key = key;
  if (def.class) props.className = def.class;
  if (def.attrs) {
    Object.entries(def.attrs).forEach(([k, v]) => {
      if (k === 'class' || k === 'className') return;
      props[k] = v;
    });
  }
  if (def.attrsI18n && strings) {
    Object.entries(def.attrsI18n).forEach(([k, v]) => {
      props[k] = strings[v] ?? '';
    });
  }
  Object.entries(def).forEach(([k, v]) => {
    if ((k.startsWith('data-') || k.startsWith('aria-')) && typeof v === 'string') {
      props[k] = v;
    }
  });
  if (def.styles) {
    const normalized: Record<string, unknown> = {};
    Object.entries(def.styles).forEach(([k, v]) => {
      normalized[k] = normalizeStyleValue(v);
    });
    props.style = normalized as React.CSSProperties;
  }

  const children: React.ReactNode[] = [];
  if (def.textKey && strings) {
    children.push(strings[def.textKey] ?? '');
  } else if (def.text !== undefined) {
    children.push(def.text);
  }
  if (def.children?.length) {
    def.children.forEach((child, idx) => {
      children.push(renderNode(child, idx, strings));
    });
  }

  if (isVoidTag(tag)) {
    return React.createElement(Tag, props as React.Attributes);
  }

  return React.createElement(Tag, props as React.Attributes, children.length ? children : undefined);
}
