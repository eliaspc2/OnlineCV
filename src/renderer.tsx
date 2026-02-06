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

const mergeNode = (base: NodeDef, override: NodeDef): NodeDef => {
  const merged: NodeDef = { ...base, ...override, ref: undefined };
  if (base.attrs || override.attrs) {
    merged.attrs = { ...(base.attrs || {}), ...(override.attrs || {}) };
  }
  if (base.attrsI18n || override.attrsI18n) {
    merged.attrsI18n = { ...(base.attrsI18n || {}), ...(override.attrsI18n || {}) };
  }
  if (base.styles || override.styles) {
    merged.styles = { ...(base.styles || {}), ...(override.styles || {}) };
  }
  if (override.children !== undefined) {
    merged.children = override.children;
  } else if (base.children !== undefined) {
    merged.children = base.children;
  }
  return merged;
};

const resolveNodeRef = (
  def: NodeDef,
  objects?: Record<string, NodeDef>,
  stack = new Set<string>()
): NodeDef => {
  if (!def.ref || !objects) return def;
  const target = objects[def.ref];
  if (!target) return def;
  if (stack.has(def.ref)) return { ...def, ref: undefined };
  stack.add(def.ref);
  const resolvedTarget = resolveNodeRef(target, objects, stack);
  stack.delete(def.ref);
  return mergeNode(resolvedTarget, def);
};

const fromStrings = (strings: Record<string, string> | undefined, key?: string) => {
  if (!strings || !key) return undefined;
  return strings[key];
};

const resolveI18nCandidates = (def: NodeDef) => {
  if (!def.id) return [];
  return [`obj.${def.id}`];
};

const resolveI18nValue = (
  strings: Record<string, string> | undefined,
  keys: string[],
  suffix: string
) => {
  for (const base of keys) {
    const value = fromStrings(strings, `${base}.${suffix}`);
    if (value !== undefined) return value;
  }
  return undefined;
};

export function renderNode(
  def: NodeDef,
  key?: React.Key,
  strings?: Record<string, string>,
  classPresets?: Record<string, string>,
  objects?: Record<string, NodeDef>
): React.ReactNode {
  const resolved = resolveNodeRef(def, objects);
  const tag = resolved.tag || 'div';
  const Tag = tag as React.ElementType;
  const i18nBases = resolveI18nCandidates(resolved);

  const props: Record<string, unknown> = {};
  if (key !== undefined) props.key = key;
  const presetClass = resolved.classKey ? classPresets?.[resolved.classKey] || '' : '';
  const className = [presetClass, resolved.class || ''].filter(Boolean).join(' ').trim();
  if (className) props.className = className;
  if (resolved.attrs) {
    Object.entries(resolved.attrs).forEach(([k, v]) => {
      if (k === 'class' || k === 'className') return;
      const translated = resolveI18nValue(strings, i18nBases, `attrs.${k}`);
      props[k] = translated ?? v;
    });
  }
  if (resolved.attrsI18n && strings) {
    Object.entries(resolved.attrsI18n).forEach(([k, v]) => {
      const translated = strings[v];
      if (translated !== undefined) {
        props[k] = translated;
      } else if (resolved.attrs?.[k] !== undefined) {
        props[k] = resolved.attrs[k];
      }
    });
  }
  Object.entries(resolved).forEach(([k, v]) => {
    if ((k.startsWith('data-') || k.startsWith('aria-')) && typeof v === 'string') {
      props[k] = v;
    }
  });
  if (resolved.styles) {
    const normalized: Record<string, unknown> = {};
    Object.entries(resolved.styles).forEach(([k, v]) => {
      normalized[k] = normalizeStyleValue(v);
    });
    props.style = normalized as React.CSSProperties;
  }

  const children: React.ReactNode[] = [];
  if (resolved.textKey && strings) {
    children.push(strings[resolved.textKey] ?? '');
  } else {
    const textByObject = resolveI18nValue(strings, i18nBases, 'text');
    if (textByObject !== undefined) {
      children.push(textByObject);
    } else if (resolved.text !== undefined) {
      children.push(resolved.text);
    }
  }
  if (resolved.children?.length) {
    resolved.children.forEach((child, idx) => {
      const childKey = child.id || idx;
      children.push(renderNode(child, childKey, strings, classPresets, objects));
    });
  }

  if (isVoidTag(tag)) {
    return React.createElement(Tag, props as React.Attributes);
  }

  return React.createElement(Tag, props as React.Attributes, children.length ? children : undefined);
}
