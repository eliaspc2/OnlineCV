import React from 'react';
import type { NodeDef } from './validator';

const isVoidTag = (tag: string) =>
  ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tag);

export function renderNode(
  def: NodeDef,
  key?: React.Key,
  strings?: Record<string, string>
): React.ReactNode {
  const tag = def.tag || 'div';
  const Tag = tag as keyof JSX.IntrinsicElements;

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
    props.style = def.styles as React.CSSProperties;
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
    return React.createElement(Tag, props);
  }

  return React.createElement(Tag, props, children.length ? children : undefined);
}
