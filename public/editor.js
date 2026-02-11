import { validateConfig } from './validator.js';

const editor = document.getElementById('editor');
const loadAllBtn = document.getElementById('loadAllBtn');
const validateBtn = document.getElementById('validateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fileTabs = document.getElementById('fileTabs');
const exitBtn = document.getElementById('exitBtn');
const aggregateView = document.getElementById('aggregateView');
const aggregateTree = document.getElementById('aggregateTree');
const aggregateDetail = document.getElementById('aggregateDetail');
const classKeyBuilderView = document.getElementById('classKeyBuilderView');
const ckObjectSearch = document.getElementById('ckObjectSearch');
const ckObjectsList = document.getElementById('ckObjectsList');
const ckSnap = document.getElementById('ckSnap');
const ckStage = document.getElementById('ckStage');
const ckPositionInfo = document.getElementById('ckPositionInfo');
const ckResetPositionBtn = document.getElementById('ckResetPositionBtn');
const ckRemoveObjectBtn = document.getElementById('ckRemoveObjectBtn');
const ckSaveBtn = document.getElementById('ckSaveBtn');
const ckStatus = document.getElementById('ckStatus');

const AGGREGATE_FILE = '__aggregate__';
const CLASS_KEYS_VISUAL_FILE = '__classkeys_visual__';
const CLASS_KEYS_FILE = 'data/class-keys.json';
const FILES = [
  'data/config.json',
  CLASS_KEYS_FILE,
  'data/uk-en.json',
  'data/pt-pt.json',
  'data/es-es.json',
  'data/fr-fr.json'
];
const LANGUAGE_FILES = [
  'data/uk-en.json',
  'data/pt-pt.json',
  'data/es-es.json',
  'data/fr-fr.json'
];
const STORAGE_PREFIX = 'json_site_draft:';
const getInitialFile = () => {
  const params = new URLSearchParams(window.location.search);
  const rawView = (params.get('view') || params.get('tab') || '').trim().toLowerCase();
  if (['classkeys', 'class-keys', 'class_keys', 'classkeys_visual'].includes(rawView)) {
    return CLASS_KEYS_VISUAL_FILE;
  }
  if (rawView === 'aggregate') return AGGREGATE_FILE;
  const rawFile = (params.get('file') || '').trim();
  if (rawFile) {
    let candidate = rawFile.replace(/^\//, '');
    if (!candidate.endsWith('.json')) candidate = `${candidate}.json`;
    if (!candidate.startsWith('data/')) candidate = `data/${candidate}`;
    if (FILES.includes(candidate)) return candidate;
  }
  return AGGREGATE_FILE;
};
let currentFile = getInitialFile();
let aggregateSelectedPath = 'meta';
const aggregateExpanded = new Set(['meta', 'objects', 'layout', 'pages']);
let classKeyBuilderState = null;
let classKeyBuilderEventsBound = false;
let classKeyStageDrag = null;

const getDraftKey = (file) => `${STORAGE_PREFIX}${file}`;

const setActiveTab = () => {
  if (!fileTabs) return;
  [...fileTabs.querySelectorAll('button')].forEach((btn) => {
    const isActive = btn.dataset.file === currentFile;
    btn.classList.toggle('active', isActive);
  });
};

const setViewMode = () => {
  const isAggregate = currentFile === AGGREGATE_FILE;
  const isClassKeysVisual = currentFile === CLASS_KEYS_VISUAL_FILE;
  if (aggregateView) aggregateView.classList.toggle('hidden', !isAggregate);
  if (classKeyBuilderView) classKeyBuilderView.classList.toggle('hidden', !isClassKeysVisual);
  editor.classList.toggle('hidden', isAggregate || isClassKeysVisual);
};

const loadFile = async (file, preferDraft = true) => {
  const draft = preferDraft ? localStorage.getItem(getDraftKey(file)) : null;
  if (draft) {
    editor.value = draft;
    return;
  }
  const res = await fetch(file);
  const json = await res.text();
  editor.value = json;
};

const parseJsonSafe = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const normalizeClassPresetTree = (raw) => {
  if (!isObject(raw)) return null;
  if (isObject(raw.classPresets)) return raw.classPresets;
  return raw;
};

const getClassPresetSourceFromDraft = () => {
  const classKeys = getDraftJson(CLASS_KEYS_FILE);
  const fromFile = normalizeClassPresetTree(classKeys);
  if (fromFile) return fromFile;
  const config = getDraftJson('data/config.json');
  return config?.meta?.classPresets;
};

const collectConfigI18nRefs = (config) => {
  const refs = new Set();
  if (!isObject(config)) return refs;

  const walk = (node, scope) => {
    if (!isObject(node)) return;
    if (scope === 'instance' && typeof node.id === 'string' && node.id.trim()) {
      refs.add(`obj.${node.id}`);
    }
    if (Array.isArray(node.children)) node.children.forEach((child) => walk(child, scope));
  };

  if (isObject(config.layout)) {
    Object.values(config.layout).forEach((nodes) => {
      if (Array.isArray(nodes)) nodes.forEach((node) => walk(node, 'instance'));
    });
  }
  if (Array.isArray(config.pages)) {
    config.pages.forEach((page) => {
      (page.sections || []).forEach((section) => {
        (section.nodes || []).forEach((node) => walk(node, 'instance'));
      });
    });
  }
  return refs;
};

const flattenReferenceStrings = (ref, value, out, trail = []) => {
  if (typeof value === 'string') {
    const key = [ref, ...trail].join('.');
    out[key] = value;
    return;
  }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([k, v]) => {
    flattenReferenceStrings(ref, v, out, [...trail, k]);
  });
};

const flattenLanguageStrings = (data) => {
  const out = {};
  if (!isObject(data)) return out;

  const appendFlat = (obj) => {
    if (!isObject(obj)) return;
    Object.entries(obj).forEach(([k, v]) => {
      if (typeof v === 'string') out[k] = v;
    });
  };

  appendFlat(data.strings);
  appendFlat(data.globals);

  if (Array.isArray(data.references)) {
    data.references.forEach((entry) => {
      if (!isObject(entry) || typeof entry.ref !== 'string' || !entry.ref.trim()) return;
      flattenReferenceStrings(entry.ref, entry.strings, out);
    });
  }

  return out;
};

const parseObjI18nKey = (key) => {
  if (typeof key !== 'string' || !/^obj\./.test(key)) return null;
  if (key.endsWith('.text')) {
    return { ref: key.slice(0, -5), path: ['text'] };
  }
  const attrsMarker = '.attrs.';
  const attrsIdx = key.indexOf(attrsMarker, 4);
  if (attrsIdx >= 0) {
    return {
      ref: key.slice(0, attrsIdx),
      path: ['attrs', key.slice(attrsIdx + attrsMarker.length)]
    };
  }
  const lastDot = key.lastIndexOf('.');
  if (lastDot > 4) {
    return { ref: key.slice(0, lastDot), path: [key.slice(lastDot + 1)] };
  }
  return { ref: key, path: ['text'] };
};

const setByPath = (obj, path, value) => {
  let cursor = obj;
  for (let i = 0; i < path.length; i += 1) {
    const part = path[i];
    const isLeaf = i === path.length - 1;
    if (isLeaf) {
      cursor[part] = value;
      return;
    }
    if (!isObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
};

const setLanguageString = (data, key, value) => {
  if (!isObject(data)) return;

  const parsed = parseObjI18nKey(key);
  if (parsed) {
    if (!Array.isArray(data.references)) data.references = [];
    let entry = data.references.find((item) => isObject(item) && item.ref === parsed.ref);
    if (!entry) {
      entry = { ref: parsed.ref, strings: {} };
      data.references.push(entry);
    }
    if (!isObject(entry.strings)) entry.strings = {};
    setByPath(entry.strings, parsed.path, value);
    return;
  }

  if (!isObject(data.globals)) data.globals = {};
  data.globals[key] = value;
};

const validateLanguageBundle = (data, config, fileLabel = 'strings') => {
  const errors = [];
  const warns = [];

  if (!data || typeof data !== 'object') {
    errors.push(`${fileLabel}: Strings file is not an object`);
    return { errors, warns };
  }
  if (!data.lang) errors.push(`${fileLabel}: Missing lang`);

  const hasTranslations =
    (data.strings && typeof data.strings === 'object') ||
    (data.globals && typeof data.globals === 'object') ||
    Array.isArray(data.references);
  if (!hasTranslations) {
    errors.push(`${fileLabel}: Missing translations (strings/globals/references)`);
  }

  const validRefs = collectConfigI18nRefs(config);
  const languageRefs = new Set();
  if (Array.isArray(data.references)) {
    data.references.forEach((entry, idx) => {
      if (!isObject(entry)) {
        errors.push(`${fileLabel}: references[${idx}] is not an object`);
        return;
      }
      if (!entry.ref || typeof entry.ref !== 'string') {
        errors.push(`${fileLabel}: references[${idx}].ref missing or not string`);
      } else if (languageRefs.has(entry.ref)) {
        errors.push(`${fileLabel}: duplicate reference ref "${entry.ref}"`);
      } else {
        languageRefs.add(entry.ref);
        if (validRefs.size && !validRefs.has(entry.ref)) {
          warns.push(`${fileLabel}: references[${idx}].ref "${entry.ref}" not found in config`);
        }
      }
      if (!isObject(entry.strings)) {
        errors.push(`${fileLabel}: references[${idx}].strings missing or not object`);
      }
    });
  }

  if (validRefs.size) {
    const missingRefs = [...validRefs].filter((ref) => !languageRefs.has(ref));
    if (missingRefs.length) {
      const sample = missingRefs.slice(0, 5).join(', ');
      warns.push(
        `${fileLabel}: missing ${missingRefs.length} translation refs from config (${sample}${
          missingRefs.length > 5 ? ', ...' : ''
        })`
      );
    }
  }

  return { errors, warns };
};

const getDraftJson = (file) => parseJsonSafe(localStorage.getItem(getDraftKey(file)) || '');

const splitClassTokens = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const normalizeClassKeysPayload = (raw) => {
  if (isObject(raw) && isObject(raw.classPresets)) {
    return { ...raw, classPresets: { ...raw.classPresets } };
  }
  if (isObject(raw)) {
    return { version: 1, classPresets: { ...raw } };
  }
  return { version: 1, classPresets: {} };
};

const getClassKeysPayloadFromDraft = () => {
  const raw = getDraftJson(CLASS_KEYS_FILE);
  return normalizeClassKeysPayload(raw);
};

const persistClassKeysPayload = (payload) => {
  localStorage.setItem(getDraftKey(CLASS_KEYS_FILE), JSON.stringify(payload, null, 2));
};

const flattenClassPresetEntries = (node, path = [], out = []) => {
  if (typeof node === 'string') {
    const key = path[path.length - 1] || '';
    const group = path.slice(0, -1).join('.');
    out.push({
      path: path.join('.'),
      group,
      key,
      value: node
    });
    return out;
  }
  if (!isObject(node)) return out;
  Object.entries(node).forEach(([key, value]) => {
    flattenClassPresetEntries(value, [...path, key], out);
  });
  return out;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toObjectDisplayName = (key) => {
  const raw = String(key || '').trim();
  if (!raw) return 'Objeto';
  const tail = raw.split('.').pop() || raw;
  return tail
    .replace(/^visual_/, '')
    .replace(/^auto_/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getFriendlyTagLabel = (tag) => {
  const value = String(tag || '').toLowerCase();
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'small', 'strong', 'em'].includes(value)) {
    return 'Texto';
  }
  if (['img', 'video', 'canvas', 'svg'].includes(value)) return 'Imagem';
  if (['button', 'a'].includes(value)) return 'Acao';
  if (['input', 'select', 'textarea'].includes(value)) return 'Campo';
  if (['ul', 'ol', 'li', 'nav'].includes(value)) return 'Lista';
  if (['header', 'footer', 'section', 'article', 'aside', 'main', 'div'].includes(value)) {
    return 'Bloco';
  }
  return 'Elemento';
};

const getObjectCategory = (objectNode, resolvedClassValue = '') => {
  const tag = String(objectNode?.tag || '').toLowerCase();
  const classValue = `${resolvedClassValue || ''} ${objectNode?.className || ''} ${objectNode?.classKey || ''}`.toLowerCase();

  if (/\brounded-full\b/.test(classValue) || /\bmask\b/.test(classValue)) return 'Formas';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'small', 'strong', 'em'].includes(tag)) {
    return 'Texto';
  }
  if (['img', 'video', 'canvas', 'svg'].includes(tag)) return 'Imagem e Media';
  if (['button', 'a'].includes(tag)) return 'Acoes';
  if (['input', 'select', 'textarea'].includes(tag)) return 'Campos';
  if (['ul', 'ol', 'li', 'nav', 'header', 'footer', 'section', 'article', 'aside', 'main', 'div'].includes(tag)) {
    return 'Layout';
  }
  return 'Outros';
};

const objectCategorySortValue = (category) => {
  const order = ['Layout', 'Texto', 'Imagem e Media', 'Formas', 'Acoes', 'Campos', 'Outros'];
  const idx = order.indexOf(category);
  return idx === -1 ? order.length : idx;
};

const toClassKeySlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'objeto';

const mergeObjectNode = (base, override) => {
  const merged = { ...(base || {}), ...(override || {}) };
  if (isObject(base?.attrs) || isObject(override?.attrs)) {
    merged.attrs = { ...(base?.attrs || {}), ...(override?.attrs || {}) };
  }
  if (isObject(base?.styles) || isObject(override?.styles)) {
    merged.styles = { ...(base?.styles || {}), ...(override?.styles || {}) };
  }
  if (Array.isArray(override?.children)) {
    merged.children = override.children;
  } else if (Array.isArray(base?.children)) {
    merged.children = base.children;
  }
  return merged;
};

const resolveObjectDef = (key, objects, stack = new Set()) => {
  const current = objects?.[key];
  if (!isObject(current)) return null;
  const ref = typeof current.ref === 'string' ? current.ref : '';
  if (!ref || !isObject(objects?.[ref])) return current;
  if (stack.has(key)) return { ...current, ref: undefined };
  stack.add(key);
  const resolvedRef = resolveObjectDef(ref, objects, stack) || objects[ref];
  stack.delete(key);
  return mergeObjectNode(resolvedRef, current);
};

const collectRenderableObjects = (config) => {
  if (!isObject(config)) return [];
  const objects = isObject(config.objects) ? config.objects : {};
  const out = [];
  const MAX_STAGE_OBJECTS = 800;

  const objectKeys = Object.keys(objects).sort((a, b) => {
    const aAuto = a.startsWith('auto.');
    const bAuto = b.startsWith('auto.');
    if (aAuto !== bAuto) return aAuto ? 1 : -1;
    return a.localeCompare(b);
  });
  objectKeys.forEach((objectKey) => {
    if (out.length >= MAX_STAGE_OBJECTS) return;
    const resolved = resolveObjectDef(objectKey, objects);
    if (!isObject(resolved)) return;
    const tag = typeof resolved.tag === 'string' && resolved.tag.trim() ? resolved.tag.trim() : 'div';
    const attrs = isObject(resolved.attrs) ? resolved.attrs : {};
    const styles = isObject(resolved.styles) ? resolved.styles : {};
    const text = typeof resolved.text === 'string' ? resolved.text : '';
    const className = typeof resolved.class === 'string' ? resolved.class : '';
    const classKey = typeof resolved.classKey === 'string' ? resolved.classKey : '';
    const hint =
      text ||
      (typeof attrs.alt === 'string' && attrs.alt) ||
      (typeof attrs.placeholder === 'string' && attrs.placeholder) ||
      '';
    out.push({
      id: objectKey,
      key: objectKey,
      label: toObjectDisplayName(objectKey) || objectKey,
      tag,
      ref: typeof resolved.ref === 'string' ? resolved.ref : '',
      classKey,
      className,
      text,
      hint,
      attrs,
      styles
    });
  });

  return out;
};

const guessStageItemSize = (tag) => {
  if (['span', 'label', 'small', 'strong', 'em'].includes(tag)) return { width: 120, height: 48 };
  if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return { width: 170, height: 64 };
  if (tag === 'img') return { width: 160, height: 120 };
  if (tag === 'button') return { width: 150, height: 56 };
  if (tag === 'a') return { width: 180, height: 56 };
  if (tag === 'input') return { width: 190, height: 48 };
  if (tag === 'section') return { width: 220, height: 108 };
  return { width: 170, height: 78 };
};

const parseCssPixelSize = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const pxMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/i);
  if (pxMatch) return Number(pxMatch[1]);
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return null;
};

const readObjectSizeFromClassTokens = (classValue) => {
  let width = null;
  let height = null;
  splitClassTokens(classValue).forEach((token) => {
    if (width === null) {
      const widthPx = token.match(/^w-\[(\d+)px\]$/);
      if (widthPx) width = Number(widthPx[1]);
    }
    if (height === null) {
      const heightPx = token.match(/^h-\[(\d+)px\]$/);
      if (heightPx) height = Number(heightPx[1]);
    }
    if (width === null) {
      const widthScale = token.match(/^w-(\d+)$/);
      if (widthScale) width = Number(widthScale[1]) * 4;
    }
    if (height === null) {
      const heightScale = token.match(/^h-(\d+)$/);
      if (heightScale) height = Number(heightScale[1]) * 4;
    }
    if (width === null || height === null) {
      const sizeScale = token.match(/^size-(\d+)$/);
      if (sizeScale) {
        const px = Number(sizeScale[1]) * 4;
        if (width === null) width = px;
        if (height === null) height = px;
      }
    }
    if (width === null || height === null) {
      const sizePx = token.match(/^size-\[(\d+)px\]$/);
      if (sizePx) {
        const px = Number(sizePx[1]);
        if (width === null) width = px;
        if (height === null) height = px;
      }
    }
  });
  return { width, height };
};

const resolveStageItemSize = (objectNode, classValue) => {
  const fallback = guessStageItemSize(objectNode.tag);
  const fromClass = readObjectSizeFromClassTokens(classValue);
  const styleWidth = parseCssPixelSize(objectNode?.styles?.width);
  const styleHeight = parseCssPixelSize(objectNode?.styles?.height);
  const attrWidth = parseCssPixelSize(objectNode?.attrs?.width);
  const attrHeight = parseCssPixelSize(objectNode?.attrs?.height);
  const width = styleWidth ?? fromClass.width ?? attrWidth ?? fallback.width;
  const height = styleHeight ?? fromClass.height ?? attrHeight ?? fallback.height;
  return {
    width: clamp(Math.round(width), 86, 520),
    height: clamp(Math.round(height), 46, 420)
  };
};

const getStageItemAccent = (seed) => {
  const text = String(seed || 'item');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    stroke: `hsl(${hue} 84% 70%)`,
    fill: `hsl(${hue} 84% 60% / 0.16)`,
    chip: `hsl(${hue} 84% 87% / 0.2)`
  };
};

const makeStageItemFromObject = (objectNode, classValue, snap = 8, index = 0) => {
  const size = resolveStageItemSize(objectNode, classValue);
  const baseX = 12 + (index % 6) * 22;
  const baseY = 12 + Math.floor(index / 6) * 22;
  const snappedX = snap > 1 ? Math.round(baseX / snap) * snap : baseX;
  const snappedY = snap > 1 ? Math.round(baseY / snap) * snap : baseY;
  const accent = getStageItemAccent(objectNode.id || objectNode.label);
  return {
    id: `stage-${Date.now()}-${Math.random()}`,
    objectId: objectNode.id,
    label: objectNode.label,
    tag: objectNode.tag,
    ref: objectNode.ref,
    classKey: objectNode.classKey,
    className: objectNode.className || '',
    text: objectNode.text || '',
    hint: objectNode.hint || '',
    attrs: objectNode.attrs || {},
    styles: objectNode.styles || {},
    x: snappedX,
    y: snappedY,
    width: size.width,
    height: size.height,
    accentStroke: accent.stroke,
    accentFill: accent.fill,
    accentChip: accent.chip
  };
};

const getActiveStageItem = (state) =>
  state.stageItems.find((item) => item.id === state.activeStageItemId) || null;

const syncVisualTokensFromStage = (state) => {
  const active = getActiveStageItem(state);
  if (!active) {
    state.visualTokens = '';
    return;
  }
  const x = Math.round(active.x);
  const y = Math.round(active.y);
  state.visualTokens = `absolute left-[${x}px] top-[${y}px]`;
};

const resolveObjectClassValue = (state, objectNode) => {
  if (!objectNode) return '';
  const fromKey = objectNode.classKey ? state.classValueMap?.[objectNode.classKey] || '' : '';
  return [fromKey, objectNode.className || ''].filter(Boolean).join(' ').trim();
};

const getObjectPreviewLabel = (objectNode) => {
  if (!objectNode) return '';
  if (typeof objectNode.text === 'string' && objectNode.text.trim()) return objectNode.text.trim();
  if (objectNode.hint) return objectNode.hint;
  const tag = String(objectNode.tag || 'div').toLowerCase();
  if (tag === 'img') return 'Imagem';
  if (tag === 'button') return 'Botao';
  if (tag === 'input') return 'Campo';
  if (tag === 'a') return 'Link';
  return `<${tag}>`;
};

const getPreviewTag = (tag, classValue) => {
  const normalized = String(tag || 'div').toLowerCase();
  if (/\brounded-full\b/.test(classValue)) return 'mask';
  if (['img', 'button', 'a', 'input'].includes(normalized)) return normalized;
  return 'block';
};

const pxFromTailwindScale = (tokenNumber) => {
  const value = Number(tokenNumber);
  if (!Number.isFinite(value)) return null;
  return `${value * 4}px`;
};

const parseHexToRgba = (hexColor, opacity = null) => {
  const raw = String(hexColor || '').replace('#', '').trim();
  if (![3, 6, 8].includes(raw.length)) return null;
  let normalized = raw;
  if (raw.length === 3) {
    normalized = raw
      .split('')
      .map((ch) => `${ch}${ch}`)
      .join('');
  }
  const hasAlpha = normalized.length === 8;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const a = hasAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;
  const alpha = opacity === null ? a : opacity;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyTailwindLikePreviewStyles = (node, classValue, options = {}) => {
  if (!node || !classValue) return;
  const allowSize = options.allowSize !== false;
  splitClassTokens(classValue).forEach((token) => {
    if (token === 'rounded-full') node.style.borderRadius = '9999px';
    if (token === 'rounded-lg') node.style.borderRadius = '12px';
    if (token === 'rounded-xl') node.style.borderRadius = '16px';
    if (token === 'border') node.style.border = '1px solid rgba(148, 163, 184, 0.45)';
    if (allowSize && token === 'w-full') node.style.width = '100%';
    if (allowSize && token === 'h-full') node.style.height = '100%';

    const widthPx = token.match(/^w-\[(\d+)px\]$/);
    if (allowSize && widthPx) node.style.width = `${widthPx[1]}px`;

    const heightPx = token.match(/^h-\[(\d+)px\]$/);
    if (allowSize && heightPx) node.style.height = `${heightPx[1]}px`;

    const widthScale = token.match(/^w-(\d+)$/);
    if (allowSize && widthScale) node.style.width = pxFromTailwindScale(widthScale[1]) || node.style.width;

    const heightScale = token.match(/^h-(\d+)$/);
    if (allowSize && heightScale) node.style.height = pxFromTailwindScale(heightScale[1]) || node.style.height;

    const opacityMatch = token.match(/^opacity-(\d{1,3})$/);
    if (opacityMatch) node.style.opacity = String(clamp(Number(opacityMatch[1]) / 100, 0, 1));

    const bgMatch = token.match(/^bg-\[(#[0-9a-fA-F]{3,8})\](?:\/(\d{1,3}))?$/);
    if (bgMatch) {
      const opacity = bgMatch[2] ? clamp(Number(bgMatch[2]) / 100, 0, 1) : null;
      const rgba = parseHexToRgba(bgMatch[1], opacity);
      if (rgba) node.style.background = rgba;
    }

    const borderMatch = token.match(/^border-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (borderMatch) {
      const rgba = parseHexToRgba(borderMatch[1], null);
      if (rgba) node.style.borderColor = rgba;
    }
  });
};

const applyInlinePreviewStyles = (node, styles, options = {}) => {
  if (!node || !isObject(styles)) return;
  const allowSize = options.allowSize !== false;
  const allowed = new Set([
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'borderRadius',
    'border',
    'borderColor',
    'background',
    'backgroundColor',
    'color',
    'opacity',
    'padding',
    'margin'
  ]);
  Object.entries(styles).forEach(([key, value]) => {
    if (!allowed.has(key)) return;
    if (!allowSize && (key === 'width' || key === 'height' || key === 'minWidth' || key === 'minHeight')) {
      return;
    }
    if (typeof value !== 'string' && typeof value !== 'number') return;
    node.style[key] = String(value);
  });
};

const createObjectPreviewNode = (objectNode, classValue, compact = false) => {
  const preview = document.createElement('div');
  preview.className = `classkey-object-preview${compact ? ' compact' : ''}`;
  const previewTag = getPreviewTag(objectNode?.tag, classValue || '');
  const attrs = isObject(objectNode?.attrs) ? objectNode.attrs : {};
  let node;

  if (previewTag === 'img') {
    const src = typeof attrs.src === 'string' ? attrs.src.trim() : '';
    if (src) {
      node = document.createElement('img');
      node.src = src;
      node.alt = typeof attrs.alt === 'string' ? attrs.alt : 'preview';
      node.loading = 'lazy';
      node.className = 'classkey-object-preview-node';
      node.dataset.previewTag = 'img';
      node.style.objectFit = 'cover';
      node.style.width = compact ? '100%' : '88px';
      node.style.height = compact ? '100%' : '56px';
    } else {
      node = document.createElement('div');
      node.className = 'classkey-object-preview-node';
      node.dataset.previewTag = 'img';
      node.textContent = 'Imagem';
    }
  } else if (previewTag === 'input') {
    node = document.createElement('input');
    node.disabled = true;
    node.placeholder = typeof attrs.placeholder === 'string' ? attrs.placeholder : 'input';
    node.className = 'classkey-object-preview-node';
    node.dataset.previewTag = 'input';
  } else if (previewTag === 'button') {
    node = document.createElement('button');
    node.type = 'button';
    node.className = 'classkey-object-preview-node';
    node.dataset.previewTag = 'button';
    node.textContent = getObjectPreviewLabel(objectNode);
  } else if (previewTag === 'a') {
    node = document.createElement('a');
    node.href = 'javascript:void(0)';
    node.className = 'classkey-object-preview-node';
    node.dataset.previewTag = 'a';
    node.textContent = getObjectPreviewLabel(objectNode);
  } else {
    node = document.createElement('div');
    node.className = 'classkey-object-preview-node';
    node.dataset.previewTag = previewTag;
    node.textContent = getObjectPreviewLabel(objectNode);
  }

  applyTailwindLikePreviewStyles(node, classValue, { allowSize: !compact });
  applyInlinePreviewStyles(node, objectNode?.styles || {}, { allowSize: !compact });
  if (compact) {
    node.style.width = '100%';
    node.style.height = '100%';
  }

  preview.appendChild(node);
  return preview;
};

const ensureObjectPath = (obj, dottedPath) => {
  if (!dottedPath) return obj;
  const parts = dottedPath.split('.').map((p) => p.trim()).filter(Boolean);
  let cursor = obj;
  parts.forEach((part) => {
    if (!isObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  });
  return cursor;
};

const composeClassKeyValue = (state) => {
  const ordered = [];
  const seen = new Set();
  const pushToken = (token) => {
    if (seen.has(token)) return;
    seen.add(token);
    ordered.push(token);
  };
  const active = getActiveStageItem(state);
  if (active) {
    splitClassTokens(resolveObjectClassValue(state, active)).forEach(pushToken);
  }
  splitClassTokens(state.visualTokens).forEach(pushToken);
  return ordered.join(' ');
};

const setClassKeyBuilderStatus = (message, type = 'info') => {
  if (!ckStatus) return;
  ckStatus.textContent = message || '';
  ckStatus.classList.toggle('error', type === 'error');
};

const renderClassKeyBuilder = () => {
  if (!classKeyBuilderView || !classKeyBuilderState) return;
  const state = classKeyBuilderState;
  syncVisualTokensFromStage(state);

  const activeStage = getActiveStageItem(state);

  if (ckObjectSearch) ckObjectSearch.value = state.objectSearch || '';
  if (ckSnap) ckSnap.value = String(state.snap || 8);

  if (ckObjectsList) {
    if (
      state.selectedObjectId &&
      !state.visualObjects.some((item) => item.id === state.selectedObjectId)
    ) {
      state.selectedObjectId = '';
    }
    if (!state.selectedObjectId && state.visualObjects.length) {
      state.selectedObjectId = state.visualObjects[0].id;
    }

    ckObjectsList.innerHTML = '';
    const search = (state.objectSearch || '').trim().toLowerCase();
    const filtered = state.visualObjects.filter((objectNode) => {
      if (!search) return true;
      const classValue = resolveObjectClassValue(state, objectNode).toLowerCase();
      return (
        objectNode.label.toLowerCase().includes(search) ||
        String(objectNode.tag || '').toLowerCase().includes(search) ||
        String(objectNode.classKey || '').toLowerCase().includes(search) ||
        classValue.includes(search)
      );
    });

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'classkey-library-value';
      empty.textContent = 'Sem objetos para os filtros atuais.';
      ckObjectsList.appendChild(empty);
    } else {
      const groups = filtered.reduce((acc, objectNode) => {
        const category = getObjectCategory(objectNode, resolveObjectClassValue(state, objectNode));
        if (!Array.isArray(acc[category])) acc[category] = [];
        acc[category].push(objectNode);
        return acc;
      }, {});

      Object.keys(groups)
        .sort((a, b) => {
          const orderDiff = objectCategorySortValue(a) - objectCategorySortValue(b);
          return orderDiff === 0 ? a.localeCompare(b) : orderDiff;
        })
        .forEach((category, idx) => {
          const details = document.createElement('details');
          details.className = 'classkey-object-group';
          details.dataset.group = category;
          const remembered = state.objectGroupOpen?.[category];
          details.open = search ? true : typeof remembered === 'boolean' ? remembered : idx < 2;

          const summary = document.createElement('summary');
          summary.textContent = `${category} (${groups[category].length})`;
          details.appendChild(summary);

          const body = document.createElement('div');
          body.className = 'classkey-object-group-body';

          groups[category].forEach((objectNode) => {
            const card = document.createElement('div');
            card.className = 'classkey-object-item';
            if (objectNode.id === state.selectedObjectId) card.classList.add('active');
            card.draggable = true;
            card.dataset.objectId = objectNode.id;

            const header = document.createElement('div');
            header.className = 'classkey-object-head';

            const textWrap = document.createElement('div');
            textWrap.className = 'classkey-object-text';

            const title = document.createElement('div');
            title.className = 'classkey-object-title';
            title.textContent = objectNode.label;

            const meta = document.createElement('div');
            meta.className = 'classkey-object-meta';
            meta.textContent = getFriendlyTagLabel(objectNode.tag);

            textWrap.appendChild(title);
            textWrap.appendChild(meta);

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'classkey-object-add';
            addBtn.dataset.objectId = objectNode.id;
            addBtn.textContent = 'Adicionar';

            header.appendChild(textWrap);
            header.appendChild(addBtn);

            const classValue = resolveObjectClassValue(state, objectNode);
            const previewEl = createObjectPreviewNode(objectNode, classValue);

            card.appendChild(header);
            card.appendChild(previewEl);
            body.appendChild(card);
          });

          details.appendChild(body);
          ckObjectsList.appendChild(details);
        });
    }
  }

  if (ckStage) {
    ckStage.innerHTML = '';
    if (!state.stageItems.length) {
      const empty = document.createElement('div');
      empty.className = 'classkey-stage-empty';
      empty.textContent = 'Sem objetos no palco. Arrasta da lista de objetos.';
      ckStage.appendChild(empty);
    } else {
      state.stageItems.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'classkey-stage-item';
        if (item.id === state.activeStageItemId) el.classList.add('active');
        el.dataset.stageId = item.id;
        if (item.accentStroke) {
          el.style.setProperty('--ck-item-stroke', item.accentStroke);
          el.style.setProperty('--ck-item-fill', item.accentFill || 'rgba(59, 130, 246, 0.16)');
          el.style.setProperty('--ck-item-chip', item.accentChip || 'rgba(148, 163, 184, 0.2)');
        }
        el.style.zIndex = item.id === state.activeStageItemId ? '30' : '10';
        el.style.left = `${Math.round(item.x)}px`;
        el.style.top = `${Math.round(item.y)}px`;
        el.style.width = `${Math.round(item.width)}px`;
        el.style.height = `${Math.round(item.height)}px`;

        const chip = document.createElement('div');
        chip.className = 'classkey-stage-item-chip';
        if (item.id !== state.activeStageItemId) chip.classList.add('passive');
        chip.textContent = item.label;
        el.appendChild(chip);

        const previewEl = createObjectPreviewNode(item, resolveObjectClassValue(state, item), true);
        el.appendChild(previewEl);
        ckStage.appendChild(el);
      });
    }
  }

  if (ckPositionInfo) {
    if (!activeStage) {
      ckPositionInfo.textContent = 'Seleciona um objeto no palco.';
    } else {
      ckPositionInfo.textContent = `${activeStage.label}  x:${Math.round(activeStage.x)} y:${Math.round(activeStage.y)}`;
    }
  }
  if (ckResetPositionBtn) ckResetPositionBtn.disabled = !activeStage;
  if (ckRemoveObjectBtn) ckRemoveObjectBtn.disabled = !activeStage;
};

const buildClassKeyBuilderState = () => {
  const payload = getClassKeysPayloadFromDraft();
  const entries = flattenClassPresetEntries(payload.classPresets);
  const classValueMap = entries.reduce((acc, entry) => {
    acc[entry.path] = entry.value;
    return acc;
  }, {});
  const config = getDraftJson('data/config.json');
  const visualObjects = collectRenderableObjects(config);
  const previous = classKeyBuilderState || {};
  const snap = Number(previous.snap);
  const normalizedSnap = Number.isFinite(snap) ? clamp(Math.round(snap), 1, 64) : 8;
  const previousStageItems = Array.isArray(previous.stageItems) ? previous.stageItems : [];
  const stageItems = previousStageItems.map((item) => {
    const accent = getStageItemAccent(item?.objectId || item?.label || item?.id);
    const fallbackSize = guessStageItemSize(item?.tag);
    const rawWidth = Number(item?.width);
    const rawHeight = Number(item?.height);
    const width =
      Number.isFinite(rawWidth) && rawWidth > 0 ? clamp(Math.round(rawWidth), 86, 520) : fallbackSize.width;
    const height =
      Number.isFinite(rawHeight) && rawHeight > 0
        ? clamp(Math.round(rawHeight), 46, 420)
        : fallbackSize.height;
    return {
      ...item,
      width,
      height,
      accentStroke: item?.accentStroke || accent.stroke,
      accentFill: item?.accentFill || accent.fill,
      accentChip: item?.accentChip || accent.chip
    };
  });
  const activeStageItemId =
    typeof previous.activeStageItemId === 'string' ? previous.activeStageItemId : '';
  const selectedObjectId =
    typeof previous.selectedObjectId === 'string'
      ? previous.selectedObjectId
      : visualObjects[0]?.id || '';
  classKeyBuilderState = {
    payload,
    entries,
    classValueMap,
    visualObjects,
    stageItems,
    activeStageItemId,
    visualTokens: typeof previous.visualTokens === 'string' ? previous.visualTokens : '',
    selectedObjectId,
    objectSearch: previous.objectSearch || '',
    objectGroupOpen: isObject(previous.objectGroupOpen) ? { ...previous.objectGroupOpen } : {},
    snap: normalizedSnap
  };
  syncVisualTokensFromStage(classKeyBuilderState);
  renderClassKeyBuilder();
};

const bindClassKeyBuilderEvents = () => {
  if (classKeyBuilderEventsBound) return;
  if (!classKeyBuilderView) return;
  classKeyBuilderEventsBound = true;

  const addStageObject = (objectId, dropPosition = null) => {
    const state = classKeyBuilderState;
    if (!state) return;
    const selected =
      state.visualObjects.find((item) => item.id === objectId) ||
      state.visualObjects.find((item) => item.id === state.selectedObjectId) ||
      state.visualObjects[0];
    if (!selected) {
      setClassKeyBuilderStatus('Sem objetos no config para renderizar.', 'error');
      return;
    }
    const classValue = resolveObjectClassValue(state, selected);
    const stageItem = makeStageItemFromObject(selected, classValue, state.snap, state.stageItems.length);
    if (dropPosition && ckStage) {
      const stageRect = ckStage.getBoundingClientRect();
      const snap = clamp(Number(state.snap) || 8, 1, 64);
      let nextX = dropPosition.clientX - stageRect.left - stageItem.width / 2;
      let nextY = dropPosition.clientY - stageRect.top - stageItem.height / 2;
      if (snap > 1) {
        nextX = Math.round(nextX / snap) * snap;
        nextY = Math.round(nextY / snap) * snap;
      }
      stageItem.x = clamp(nextX, 0, Math.max(0, stageRect.width - stageItem.width));
      stageItem.y = clamp(nextY, 0, Math.max(0, stageRect.height - stageItem.height));
    }
    state.stageItems.push(stageItem);
    state.activeStageItemId = stageItem.id;
    state.selectedObjectId = selected.id;
    syncVisualTokensFromStage(state);
    setClassKeyBuilderStatus(`Objeto adicionado ao palco: ${selected.label}`);
    renderClassKeyBuilder();
  };

  const removeActiveStageObject = () => {
    const state = classKeyBuilderState;
    if (!state) return;
    const active = getActiveStageItem(state);
    if (!active) return;
    state.stageItems = state.stageItems.filter((item) => item.id !== active.id);
    state.activeStageItemId = state.stageItems[0]?.id || '';
    syncVisualTokensFromStage(state);
    setClassKeyBuilderStatus('Objeto removido do palco.');
    renderClassKeyBuilder();
  };

  const updateStageDrag = (event, finalize = false) => {
    const state = classKeyBuilderState;
    if (!state || !classKeyStageDrag || !ckStage) return;
    const item = state.stageItems.find((entry) => entry.id === classKeyStageDrag.stageItemId);
    if (!item) return;

    const stageRect = ckStage.getBoundingClientRect();
    const itemEl = ckStage.querySelector(`[data-stage-id="${item.id}"]`);
    const width = itemEl ? itemEl.offsetWidth : item.width;
    const height = itemEl ? itemEl.offsetHeight : item.height;
    item.width = width;
    item.height = height;

    let nextX = event.clientX - stageRect.left - classKeyStageDrag.offsetX;
    let nextY = event.clientY - stageRect.top - classKeyStageDrag.offsetY;
    const snap = clamp(Number(state.snap) || 8, 1, 64);
    if (snap > 1) {
      nextX = Math.round(nextX / snap) * snap;
      nextY = Math.round(nextY / snap) * snap;
    }

    nextX = clamp(nextX, 0, Math.max(0, stageRect.width - width));
    nextY = clamp(nextY, 0, Math.max(0, stageRect.height - height));
    item.x = nextX;
    item.y = nextY;
    syncVisualTokensFromStage(state);

    if (itemEl) {
      itemEl.style.left = `${Math.round(nextX)}px`;
      itemEl.style.top = `${Math.round(nextY)}px`;
    }
    if (ckPositionInfo) {
      ckPositionInfo.textContent = `${item.label}  x:${Math.round(nextX)} y:${Math.round(nextY)}`;
    }
    if (finalize) renderClassKeyBuilder();
  };

  if (ckObjectSearch) {
    ckObjectSearch.addEventListener('input', (event) => {
      classKeyBuilderState.objectSearch = event.target.value || '';
      renderClassKeyBuilder();
    });
  }

  if (ckSnap) {
    ckSnap.addEventListener('input', (event) => {
      const raw = Number(event.target.value);
      const snap = Number.isFinite(raw) ? clamp(Math.round(raw), 1, 64) : 8;
      classKeyBuilderState.snap = snap;
      event.target.value = String(snap);
    });
  }

  if (ckObjectsList) {
    ckObjectsList.addEventListener(
      'toggle',
      (event) => {
        if (!classKeyBuilderState) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || !target.classList.contains('classkey-object-group')) return;
        const group = target.dataset.group;
        if (!group) return;
        classKeyBuilderState.objectGroupOpen[group] = target.open;
      },
      true
    );

    ckObjectsList.addEventListener('click', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const addBtn = targetEl ? targetEl.closest('.classkey-object-add') : null;
      if (addBtn && addBtn.dataset.objectId) {
        event.preventDefault();
        event.stopPropagation();
        addStageObject(addBtn.dataset.objectId);
        return;
      }
      const card = targetEl ? targetEl.closest('.classkey-object-item') : null;
      if (!card || !card.dataset.objectId) return;
      classKeyBuilderState.selectedObjectId = card.dataset.objectId;
      renderClassKeyBuilder();
    });
    ckObjectsList.addEventListener('dblclick', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const card = targetEl ? targetEl.closest('.classkey-object-item') : null;
      if (!card || !card.dataset.objectId) return;
      addStageObject(card.dataset.objectId);
    });
    ckObjectsList.addEventListener('dragstart', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const card = targetEl ? targetEl.closest('.classkey-object-item') : null;
      if (!card || !card.dataset.objectId) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/classkey-object-id', card.dataset.objectId);
    });
  }

  if (ckRemoveObjectBtn) {
    ckRemoveObjectBtn.addEventListener('click', () => {
      removeActiveStageObject();
    });
  }

  if (ckResetPositionBtn) {
    ckResetPositionBtn.addEventListener('click', () => {
      const state = classKeyBuilderState;
      const active = state ? getActiveStageItem(state) : null;
      if (!active) return;
      active.x = 0;
      active.y = 0;
      syncVisualTokensFromStage(state);
      setClassKeyBuilderStatus('Posição do objeto reiniciada.');
      renderClassKeyBuilder();
    });
  }

  if (ckStage) {
    ckStage.addEventListener('dragover', (event) => {
      const types = Array.from(event.dataTransfer?.types || []);
      const hasObject = types.includes('text/classkey-object-id');
      if (!hasObject) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      ckStage.classList.add('over');
    });
    ckStage.addEventListener('dragleave', () => {
      ckStage.classList.remove('over');
    });
    ckStage.addEventListener('drop', (event) => {
      const objectId = event.dataTransfer.getData('text/classkey-object-id');
      ckStage.classList.remove('over');
      if (!objectId) return;
      event.preventDefault();
      addStageObject(objectId, { clientX: event.clientX, clientY: event.clientY });
    });

    ckStage.addEventListener('click', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const stageItem = targetEl ? targetEl.closest('.classkey-stage-item') : null;
      if (!stageItem) return;
      classKeyBuilderState.activeStageItemId = stageItem.dataset.stageId || '';
      syncVisualTokensFromStage(classKeyBuilderState);
      renderClassKeyBuilder();
    });

    ckStage.addEventListener('pointerdown', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const stageItem = targetEl ? targetEl.closest('.classkey-stage-item') : null;
      if (!stageItem || !stageItem.dataset.stageId) return;
      event.preventDefault();
      classKeyBuilderState.activeStageItemId = stageItem.dataset.stageId;
      const rect = stageItem.getBoundingClientRect();
      classKeyStageDrag = {
        stageItemId: stageItem.dataset.stageId,
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      if (stageItem.setPointerCapture) {
        stageItem.setPointerCapture(event.pointerId);
      }
      syncVisualTokensFromStage(classKeyBuilderState);
      ckStage
        .querySelectorAll('.classkey-stage-item')
        .forEach((el) => el.classList.toggle('active', el.dataset.stageId === stageItem.dataset.stageId));
      if (ckPositionInfo) {
        const active = getActiveStageItem(classKeyBuilderState);
        ckPositionInfo.textContent = active
          ? `${active.label}  x:${Math.round(active.x)} y:${Math.round(active.y)}`
          : 'Seleciona um objeto no palco.';
      }
    });

    ckStage.addEventListener('pointermove', (event) => {
      if (!classKeyStageDrag || event.pointerId !== classKeyStageDrag.pointerId) return;
      event.preventDefault();
      updateStageDrag(event, false);
    });

    const finishStageDrag = (event) => {
      if (!classKeyStageDrag || event.pointerId !== classKeyStageDrag.pointerId) return;
      updateStageDrag(event, true);
      classKeyStageDrag = null;
    };

    ckStage.addEventListener('pointerup', finishStageDrag);
    ckStage.addEventListener('pointercancel', finishStageDrag);
    ckStage.addEventListener('pointerleave', finishStageDrag);
  }

  if (ckSaveBtn) {
    ckSaveBtn.addEventListener('click', () => {
      const state = classKeyBuilderState;
      const active = getActiveStageItem(state);
      if (!active) {
        setClassKeyBuilderStatus('Seleciona um objeto no palco para guardar.', 'error');
        return;
      }
      const value = composeClassKeyValue(state);
      if (!value) {
        setClassKeyBuilderStatus('Classe final está vazia.', 'error');
        return;
      }

      const group = 'visual.simple';
      const root = ensureObjectPath(state.payload.classPresets, group);
      const baseName = toClassKeySlug(active.label || active.tag || 'objeto');
      let key = baseName;
      let suffix = 2;
      while (typeof root[key] === 'string') {
        key = `${baseName}_${suffix}`;
        suffix += 1;
      }

      root[key] = value;
      persistClassKeysPayload(state.payload);

      state.entries = flattenClassPresetEntries(state.payload.classPresets);
      state.classValueMap = state.entries.reduce((acc, entry) => {
        acc[entry.path] = entry.value;
        return acc;
      }, {});
      setClassKeyBuilderStatus(`Guardado em ${group}.${key}`);
      buildAggregateView();
      renderClassKeyBuilder();
    });
  }
};

const initClassKeyBuilder = () => {
  if (!classKeyBuilderView) return;
  bindClassKeyBuilderEvents();
  buildClassKeyBuilderState();
};

const buildAggregateView = () => {
  if (!aggregateTree || !aggregateDetail) return;
  aggregateTree.innerHTML = '';
  aggregateDetail.innerHTML = '';

  const config = getDraftJson('data/config.json');
  if (!config) return;

  const langDefs = config.meta?.languages || [];
  const languages = Array.isArray(langDefs) ? langDefs : [];
  const stringsByFile = {};
  languages.forEach((lang) => {
    const file = lang.stringsFile;
    if (!file) return;
    const data = getDraftJson(file);
    if (data) {
      stringsByFile[file] = flattenLanguageStrings(data);
    }
  });

  const getString = (file, key) => {
    if (!file || !key) return '';
    return (stringsByFile[file] && stringsByFile[file][key]) || '';
  };
  const hasAnyString = (key) => {
    if (!key) return false;
    return languages.some((lang) => {
      const file = lang.stringsFile;
      return Boolean(file && stringsByFile[file] && stringsByFile[file][key] !== undefined);
    });
  };

  const persistConfig = () => {
    localStorage.setItem(getDraftKey('data/config.json'), JSON.stringify(config, null, 2));
  };

  const buildUniqueInstanceId = (prefix = 'n') => {
    const used = new Set();
    const walk = (node) => {
      if (!isObject(node)) return;
      if (typeof node.id === 'string' && node.id.trim()) used.add(node.id.trim());
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    if (isObject(config.layout)) {
      Object.values(config.layout).forEach((nodes) => {
        if (Array.isArray(nodes)) nodes.forEach(walk);
      });
    }
    if (Array.isArray(config.pages)) {
      config.pages.forEach((page) => {
        (page.sections || []).forEach((section) => {
          (section.nodes || []).forEach(walk);
        });
      });
    }
    let idx = 1;
    let id = `${prefix}_${String(idx).padStart(4, '0')}`;
    while (used.has(id)) {
      idx += 1;
      id = `${prefix}_${String(idx).padStart(4, '0')}`;
    }
    return id;
  };

  const buildDeployNodeTemplate = () => {
    const objectKeys = isObject(config.objects) ? Object.keys(config.objects) : [];
    return {
      id: buildUniqueInstanceId('n'),
      ref: objectKeys[0] || ''
    };
  };

  const updateStringValue = (file, key, value) => {
    if (!file || !key) return;
    const data = getDraftJson(file) || { lang: '', globals: {}, references: [] };
    if (!data.lang) {
      const langDef = languages.find((l) => l.stringsFile === file);
      data.lang = langDef?.code || 'en-GB';
    }
    setLanguageString(data, key, value);
    localStorage.setItem(getDraftKey(file), JSON.stringify(data, null, 2));
  };

  const buildNodeLabel = (node) => {
    if (!node || typeof node !== 'object') return 'node';
    const tag = node.tag || 'div';
    const nodeId = node.id ? `#${node.id}` : '';
    const refName = node.ref ? ` -> ${node.ref}` : '';
    const id = node.attrs?.id ? `#${node.attrs.id}` : '';
    const className = node.class ? `.${node.class.split(' ')[0]}` : '';
    return `${tag}${nodeId}${id}${className}${refName}`;
  };

  const createSection = (title) => {
    const section = document.createElement('div');
    section.className = 'agg-section';
    const header = document.createElement('div');
    header.className = 'agg-section-title';
    header.textContent = title;
    const body = document.createElement('div');
    body.className = 'agg-fields';
    section.appendChild(header);
    section.appendChild(body);
    return { section, body };
  };

  const addFieldRow = (container, label, value, onChange) => {
    const row = document.createElement('div');
    row.className = 'agg-row';
    const labelEl = document.createElement('div');
    labelEl.className = 'agg-label';
    labelEl.textContent = label;
    const input = document.createElement('input');
    input.value = value || '';
    input.addEventListener('input', (event) => {
      onChange(event.target.value);
      persistConfig();
    });
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    row.appendChild(labelEl);
    row.appendChild(input);
    row.appendChild(actions);
    container.appendChild(row);
  };

  const renderKeyValueSection = (container, title, obj, onSet) => {
    let current = obj && typeof obj === 'object' ? obj : null;
    const ensure = () => {
      if (!current) {
        current = {};
        onSet(current);
        persistConfig();
      }
      return current;
    };
    const { section, body } = createSection(title);

    const renderRows = () => {
      body.innerHTML = '';
      const entries = Object.entries(current || {});
      entries.forEach(([key, value]) => {
        const row = document.createElement('div');
        row.className = 'agg-row';

        const keyInput = document.createElement('input');
        keyInput.value = key;
        const valInput = document.createElement('input');
        valInput.value = value ?? '';
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remover';

        removeBtn.addEventListener('click', () => {
          const objRef = ensure();
          delete objRef[key];
          persistConfig();
          renderRows();
        });

        keyInput.addEventListener('input', (event) => {
          const objRef = ensure();
          const newKey = event.target.value.trim();
          if (!newKey || newKey === key) return;
          objRef[newKey] = objRef[key];
          delete objRef[key];
          key = newKey;
          persistConfig();
        });

        valInput.addEventListener('input', (event) => {
          const objRef = ensure();
          objRef[key] = event.target.value;
          persistConfig();
        });

        actions.appendChild(removeBtn);
        row.appendChild(keyInput);
        row.appendChild(valInput);
        row.appendChild(actions);
        body.appendChild(row);
      });

      const actions = document.createElement('div');
      actions.className = 'array-actions';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = 'Adicionar';
      addBtn.addEventListener('click', () => {
        const objRef = ensure();
        let idx = 1;
        let newKey = `key${idx}`;
        while (Object.prototype.hasOwnProperty.call(objRef, newKey)) {
          idx += 1;
          newKey = `key${idx}`;
        }
        objRef[newKey] = '';
        persistConfig();
        renderRows();
      });
      actions.appendChild(addBtn);
      body.appendChild(actions);
    };

    renderRows();
    container.appendChild(section);
  };

  const renderStringsSection = (container, fields) => {
    if (!fields.length) return;
    const { section, body } = createSection('Strings');
    fields.forEach((field) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'agg-item';

      const label = document.createElement('div');
      label.className = 'agg-label';
      label.textContent = field.label;
      wrapper.appendChild(label);

      const langs = document.createElement('div');
      langs.className = 'agg-langs';
      languages.forEach((lang) => {
        const langBox = document.createElement('div');
        langBox.className = 'agg-lang';
        const labelEl = document.createElement('label');
        labelEl.textContent = lang.code || lang.label || 'lang';
        const value = getString(lang.stringsFile, field.key);
        const input = value.length > 120 ? document.createElement('textarea') : document.createElement('input');
        input.value = value;
        input.addEventListener('input', (event) => {
          updateStringValue(lang.stringsFile, field.key, event.target.value);
        });
        langBox.appendChild(labelEl);
        langBox.appendChild(input);
        langs.appendChild(langBox);
      });
      wrapper.appendChild(langs);
      body.appendChild(wrapper);
    });
    container.appendChild(section);
  };

  const renderArraySection = (container, title, items, options) => {
    const { section, body } = createSection(title);
    const list = document.createElement('div');
    list.className = 'agg-fields';

    (items || []).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'agg-row';
      const labelEl = document.createElement('div');
      labelEl.className = 'agg-label';
      labelEl.textContent = options.labelFn(item, index);
      const valueEl = document.createElement('div');
      valueEl.className = 'agg-label';
      valueEl.textContent = options.subtitleFn ? options.subtitleFn(item, index) : '';
      const actions = document.createElement('div');
      actions.className = 'row-actions';

      if (options.onSelect) {
        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.textContent = 'Selecionar';
        selectBtn.addEventListener('click', () => options.onSelect(index));
        actions.appendChild(selectBtn);
      }
      if (options.onRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remover';
        removeBtn.addEventListener('click', () => options.onRemove(index));
        actions.appendChild(removeBtn);
      }

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      row.appendChild(actions);
      list.appendChild(row);
    });

    const arrayActions = document.createElement('div');
    arrayActions.className = 'array-actions';
    if (options.onAdd) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = 'Adicionar';
      addBtn.addEventListener('click', () => options.onAdd());
      arrayActions.appendChild(addBtn);
    }
    list.appendChild(arrayActions);
    body.appendChild(list);
    container.appendChild(section);
  };

  const renderLanguagesSection = (container, meta) => {
    const { section, body } = createSection('meta.languages');
    const list = Array.isArray(meta.languages) ? meta.languages : [];
    list.forEach((lang, index) => {
      const block = document.createElement('div');
      block.className = 'agg-item';

      const title = document.createElement('div');
      title.className = 'agg-label';
      title.textContent = `Idioma ${index + 1}`;
      block.appendChild(title);

      const fields = document.createElement('div');
      fields.className = 'agg-fields';
      const addLangField = (label, value, onChange) => {
        const row = document.createElement('div');
        row.className = 'agg-row';
        const labelEl = document.createElement('div');
        labelEl.className = 'agg-label';
        labelEl.textContent = label;
        const input = document.createElement('input');
        input.value = value || '';
        input.addEventListener('input', (event) => {
          onChange(event.target.value);
          persistConfig();
        });
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        row.appendChild(labelEl);
        row.appendChild(input);
        row.appendChild(actions);
        fields.appendChild(row);
      };

      addLangField('code', lang.code, (val) => {
        lang.code = val;
      });
      addLangField('label', lang.label, (val) => {
        lang.label = val;
      });
      addLangField('stringsFile', lang.stringsFile, (val) => {
        lang.stringsFile = val;
      });
      addLangField('flag', lang.flag, (val) => {
        lang.flag = val;
      });

      const removeWrap = document.createElement('div');
      removeWrap.className = 'array-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remover idioma';
      removeBtn.addEventListener('click', () => {
        list.splice(index, 1);
        meta.languages = list;
        persistConfig();
        buildAggregateView();
      });
      removeWrap.appendChild(removeBtn);
      fields.appendChild(removeWrap);

      block.appendChild(fields);
      body.appendChild(block);
    });

    const addWrap = document.createElement('div');
    addWrap.className = 'array-actions';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Adicionar idioma';
    addBtn.addEventListener('click', () => {
      if (!Array.isArray(meta.languages)) meta.languages = [];
      meta.languages.push({ code: '', label: '', stringsFile: '', flag: '' });
      persistConfig();
      buildAggregateView();
    });
    addWrap.appendChild(addBtn);
    body.appendChild(addWrap);
    container.appendChild(section);
  };

  const renderPwaSection = (container, meta) => {
    const pwa = meta.pwa || (meta.pwa = {});
    const { section, body } = createSection('meta.pwa');

    const addToggleRow = (label, value, onChange) => {
      const row = document.createElement('div');
      row.className = 'agg-row';
      const labelEl = document.createElement('div');
      labelEl.className = 'agg-label';
      labelEl.textContent = label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(value);
      input.addEventListener('change', (event) => {
        onChange(event.target.checked);
        persistConfig();
      });
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      row.appendChild(labelEl);
      row.appendChild(input);
      row.appendChild(actions);
      body.appendChild(row);
    };

    addToggleRow('enabled', pwa.enabled, (val) => {
      pwa.enabled = val;
    });
    addFieldRow(body, 'nameKey', pwa.nameKey || '', (val) => {
      pwa.nameKey = val;
    });
    addFieldRow(body, 'shortNameKey', pwa.shortNameKey || '', (val) => {
      pwa.shortNameKey = val;
    });
    addFieldRow(body, 'descriptionKey', pwa.descriptionKey || '', (val) => {
      pwa.descriptionKey = val;
    });
    addFieldRow(body, 'startUrl', pwa.startUrl || '', (val) => {
      pwa.startUrl = val;
    });
    addFieldRow(body, 'scope', pwa.scope || '', (val) => {
      pwa.scope = val;
    });
    addFieldRow(body, 'display', pwa.display || '', (val) => {
      pwa.display = val;
    });
    addFieldRow(body, 'orientation', pwa.orientation || '', (val) => {
      pwa.orientation = val;
    });
    addFieldRow(body, 'themeColor', pwa.themeColor || '', (val) => {
      pwa.themeColor = val;
    });
    addFieldRow(body, 'backgroundColor', pwa.backgroundColor || '', (val) => {
      pwa.backgroundColor = val;
    });

    const icons = Array.isArray(pwa.icons) ? pwa.icons : (pwa.icons = []);
    const iconsSection = createSection('meta.pwa.icons');
    icons.forEach((icon, index) => {
      const block = document.createElement('div');
      block.className = 'agg-item';

      const title = document.createElement('div');
      title.className = 'agg-label';
      title.textContent = `Icon ${index + 1}`;
      block.appendChild(title);

      const fields = document.createElement('div');
      fields.className = 'agg-fields';
      const addIconField = (label, value, onChange) => {
        const row = document.createElement('div');
        row.className = 'agg-row';
        const labelEl = document.createElement('div');
        labelEl.className = 'agg-label';
        labelEl.textContent = label;
        const input = document.createElement('input');
        input.value = value || '';
        input.addEventListener('input', (event) => {
          onChange(event.target.value);
          persistConfig();
        });
        const actions = document.createElement('div');
        actions.className = 'row-actions';
        row.appendChild(labelEl);
        row.appendChild(input);
        row.appendChild(actions);
        fields.appendChild(row);
      };

      addIconField('src', icon.src, (val) => {
        icon.src = val;
      });
      addIconField('sizes', icon.sizes || '', (val) => {
        icon.sizes = val;
      });
      addIconField('type', icon.type || '', (val) => {
        icon.type = val;
      });
      addIconField('purpose', icon.purpose || '', (val) => {
        icon.purpose = val;
      });

      const removeWrap = document.createElement('div');
      removeWrap.className = 'array-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remover icon';
      removeBtn.addEventListener('click', () => {
        icons.splice(index, 1);
        pwa.icons = icons;
        persistConfig();
        buildAggregateView();
      });
      removeWrap.appendChild(removeBtn);
      fields.appendChild(removeWrap);
      block.appendChild(fields);
      iconsSection.body.appendChild(block);
    });

    const addWrap = document.createElement('div');
    addWrap.className = 'array-actions';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Adicionar icon';
    addBtn.addEventListener('click', () => {
      icons.push({ src: '', sizes: '', type: '', purpose: '' });
      pwa.icons = icons;
      persistConfig();
      buildAggregateView();
    });
    addWrap.appendChild(addBtn);
    iconsSection.body.appendChild(addWrap);

    container.appendChild(section);
    container.appendChild(iconsSection.section);
  };

  const buildNodeTree = (nodes, basePath, kind = 'node') => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map((node, idx) => {
      const path = `${basePath}.${idx}`;
      const entry = {
        kind,
        label: buildNodeLabel(node),
        path,
        ref: node,
        parentArray: nodes,
        index: idx,
        children: buildNodeTree(node.children, `${path}.children`, kind)
      };
      return entry;
    });
  };

  const buildSectionTree = (sections, pagePath) => {
    if (!Array.isArray(sections)) return [];
    return sections.map((section, idx) => {
      const label = section.title || section.id || `section-${idx + 1}`;
      const path = `${pagePath}.sections.${idx}`;
      return {
        kind: 'section',
        label,
        path,
        ref: section,
        parentArray: sections,
        index: idx,
        children: buildNodeTree(section.nodes, `${path}.nodes`)
      };
    });
  };

  const buildPageTree = (pages) => {
    if (!Array.isArray(pages)) return [];
    return pages.map((page, idx) => {
      const label = page.title || page.id || `page-${idx + 1}`;
      const path = `pages.${idx}`;
      return {
        kind: 'page',
        label,
        path,
        ref: page,
        parentArray: pages,
        index: idx,
        children: buildSectionTree(page.sections, path)
      };
    });
  };

  const buildObjectTree = (objects) => {
    if (!objects || typeof objects !== 'object') return [];
    return Object.entries(objects).map(([key, node]) => ({
      kind: 'object-node',
      label: key,
      path: `objects.${key}`,
      ref: node,
      parentArray: objects,
      index: key,
      children: buildNodeTree(node.children, `objects.${key}.children`, 'object-node')
    }));
  };

  const treeData = [];
  treeData.push({ kind: 'meta', label: 'Meta', path: 'meta', ref: config.meta || {}, children: [] });

  const objectsEntry = {
    kind: 'objects',
    label: 'Objects',
    path: 'objects',
    ref: config.objects || {},
    children: buildObjectTree(config.objects)
  };
  treeData.push(objectsEntry);

  const layoutEntry = {
    kind: 'layout',
    label: 'Layout',
    path: 'layout',
    ref: config.layout || {},
    children: []
  };
  if (config.layout && typeof config.layout === 'object') {
    Object.entries(config.layout).forEach(([key, nodes]) => {
      layoutEntry.children.push({
        kind: 'layout-group',
        label: key,
        path: `layout.${key}`,
        ref: nodes,
        parentArray: config.layout,
        index: key,
        children: buildNodeTree(nodes, `layout.${key}`)
      });
    });
  }
  treeData.push(layoutEntry);

  const pagesEntry = {
    kind: 'pages',
    label: 'Pages',
    path: 'pages',
    ref: Array.isArray(config.pages) ? config.pages : [],
    children: buildPageTree(config.pages)
  };
  treeData.push(pagesEntry);

  const nodeMap = new Map();
  const renderTree = (nodes, container, level = 0) => {
    nodes.forEach((entry) => {
      nodeMap.set(entry.path, entry);
      const row = document.createElement('div');
      row.className = `tree-row${entry.path === aggregateSelectedPath ? ' selected' : ''}`;
      row.style.marginLeft = `${level * 12}px`;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tree-toggle';
      const hasChildren = entry.children && entry.children.length > 0;
      toggle.textContent = hasChildren ? (aggregateExpanded.has(entry.path) ? '▾' : '▸') : '';
      toggle.disabled = !hasChildren;
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!hasChildren) return;
        if (aggregateExpanded.has(entry.path)) {
          aggregateExpanded.delete(entry.path);
        } else {
          aggregateExpanded.add(entry.path);
        }
        buildAggregateView();
      });

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'tree-label';
      label.textContent = entry.label;
      label.addEventListener('click', () => {
        aggregateSelectedPath = entry.path;
        buildAggregateView();
      });

      row.appendChild(toggle);
      row.appendChild(label);
      container.appendChild(row);

      if (hasChildren && aggregateExpanded.has(entry.path)) {
        renderTree(entry.children, container, level + 1);
      }
    });
  };

  renderTree(treeData, aggregateTree, 0);

  const selected = nodeMap.get(aggregateSelectedPath) || treeData[0];
  if (selected) aggregateSelectedPath = selected.path;

  const renderMetaDetail = () => {
    const meta = config.meta || {};
    const { section, body } = createSection('Meta');
    addFieldRow(body, 'titleKey', meta.titleKey, (val) => {
      meta.titleKey = val;
    });
    addFieldRow(body, 'descriptionKey', meta.descriptionKey, (val) => {
      meta.descriptionKey = val;
    });
    addFieldRow(body, 'lang', meta.lang, (val) => {
      meta.lang = val;
    });
    addFieldRow(body, 'defaultLanguage', meta.defaultLanguage, (val) => {
      meta.defaultLanguage = val;
    });
    addFieldRow(body, 'classPresetsFile', meta.classPresetsFile || '', (val) => {
      meta.classPresetsFile = val || undefined;
    });
    aggregateDetail.appendChild(section);

    renderKeyValueSection(aggregateDetail, 'meta.theme', meta.theme, (val) => {
      meta.theme = val;
    });
    renderPwaSection(aggregateDetail, meta);
    renderKeyValueSection(aggregateDetail, 'meta.favicon', meta.favicon, (val) => {
      meta.favicon = val;
    });
    renderLanguagesSection(aggregateDetail, meta);

    const pwa = meta.pwa || {};
    const stringFields = [
      { label: 'meta.title', key: meta.titleKey },
      { label: 'meta.description', key: meta.descriptionKey },
      { label: 'meta.pwa.name', key: pwa.nameKey },
      { label: 'meta.pwa.shortName', key: pwa.shortNameKey },
      { label: 'meta.pwa.description', key: pwa.descriptionKey }
    ].filter((item) => item.key);
    renderStringsSection(aggregateDetail, stringFields);
  };

  const renderPageDetail = (entry) => {
    const page = entry.ref;
    const { section, body } = createSection('Page');
    addFieldRow(body, 'id', page.id, (val) => {
      page.id = val;
    });
    addFieldRow(body, 'title', page.title || '', (val) => {
      page.title = val;
    });
    aggregateDetail.appendChild(section);

    const sections = Array.isArray(page.sections) ? page.sections : (page.sections = []);
    renderArraySection(aggregateDetail, 'Sections', sections, {
      labelFn: (item, idx) => item.title || item.id || `section-${idx + 1}`,
      onSelect: (idx) => {
        aggregateSelectedPath = `${entry.path}.sections.${idx}`;
        buildAggregateView();
      },
      onRemove: (idx) => {
        sections.splice(idx, 1);
        persistConfig();
        buildAggregateView();
      },
      onAdd: () => {
        sections.push({ id: 'section-new', title: '', nodes: [] });
        persistConfig();
        buildAggregateView();
      }
    });
  };

  const renderSectionDetail = (entry) => {
    const section = entry.ref;
    const { section: header, body } = createSection('Section');
    addFieldRow(body, 'id', section.id, (val) => {
      section.id = val;
    });
    addFieldRow(body, 'title', section.title || '', (val) => {
      section.title = val;
    });
    aggregateDetail.appendChild(header);

    const nodes = Array.isArray(section.nodes) ? section.nodes : (section.nodes = []);
    renderArraySection(aggregateDetail, 'Nodes', nodes, {
      labelFn: (item) => buildNodeLabel(item),
      onSelect: (idx) => {
        aggregateSelectedPath = `${entry.path}.nodes.${idx}`;
        buildAggregateView();
      },
      onRemove: (idx) => {
        nodes.splice(idx, 1);
        persistConfig();
        buildAggregateView();
      },
      onAdd: () => {
        nodes.push(buildDeployNodeTemplate());
        persistConfig();
        buildAggregateView();
      }
    });
  };

  const renderLayoutGroupDetail = (entry) => {
    const nodes = Array.isArray(entry.ref) ? entry.ref : [];
    renderArraySection(aggregateDetail, `Layout / ${entry.label}`, nodes, {
      labelFn: (item) => buildNodeLabel(item),
      onSelect: (idx) => {
        aggregateSelectedPath = `${entry.path}.${idx}`;
        buildAggregateView();
      },
      onRemove: (idx) => {
        nodes.splice(idx, 1);
        persistConfig();
        buildAggregateView();
      },
      onAdd: () => {
        nodes.push(buildDeployNodeTemplate());
        persistConfig();
        buildAggregateView();
      }
    });
  };

  const renderObjectsDetail = () => {
    const objects = config.objects && typeof config.objects === 'object' ? config.objects : (config.objects = {});
    const entries = Object.entries(objects);
    renderArraySection(aggregateDetail, 'Objects', entries, {
      labelFn: (item) => item[0],
      subtitleFn: (item) => buildNodeLabel(item[1]),
      onSelect: (idx) => {
        const key = entries[idx]?.[0];
        if (!key) return;
        aggregateSelectedPath = `objects.${key}`;
        buildAggregateView();
      },
      onRemove: (idx) => {
        const key = entries[idx]?.[0];
        if (!key) return;
        delete objects[key];
        persistConfig();
        buildAggregateView();
      },
      onAdd: () => {
        let index = 1;
        let key = `object_${index}`;
        while (Object.prototype.hasOwnProperty.call(objects, key)) {
          index += 1;
          key = `object_${index}`;
        }
        objects[key] = {
          tag: 'div',
          classKey: '',
          children: []
        };
        persistConfig();
        aggregateSelectedPath = `objects.${key}`;
        buildAggregateView();
      }
    });
  };

  const renderNodeDetail = (entry) => {
    const node = entry.ref;
    const isObjectNode = entry.kind === 'object-node';
    const getObjectByRef = (ref) => {
      if (!ref || !isObject(config.objects)) return null;
      return config.objects[ref] || null;
    };
    const { section, body } = createSection('Node');
    if (isObjectNode) {
      addFieldRow(body, 'tag', node.tag, (val) => {
        node.tag = val || undefined;
      });
      addFieldRow(body, 'classKey', node.classKey || '', (val) => {
        node.classKey = val || undefined;
      });
      addFieldRow(body, 'class (optional override)', node.class || '', (val) => {
        node.class = val || undefined;
      });
      addFieldRow(body, 'text (optional static)', node.text || '', (val) => {
        node.text = val || undefined;
      });
    } else {
      addFieldRow(body, 'id (required)', node.id || '', (val) => {
        node.id = val || undefined;
      });
      addFieldRow(body, 'ref (required)', node.ref || '', (val) => {
        node.ref = val || undefined;
      });
    }
    aggregateDetail.appendChild(section);

    renderKeyValueSection(aggregateDetail, 'attrs', node.attrs, (val) => {
      node.attrs = val;
    });
    renderKeyValueSection(aggregateDetail, 'styles', node.styles, (val) => {
      node.styles = val;
    });
    if (isObjectNode) {
      renderKeyValueSection(aggregateDetail, 'attrsI18n', node.attrsI18n, (val) => {
        node.attrsI18n = val;
      });
    }

    const fields = [];
    if (!isObjectNode) {
      const i18nBase = node.id ? `obj.${node.id}` : '';
      const baseObject = getObjectByRef(node.ref);
      if (i18nBase) {
        const textKey = `${i18nBase}.text`;
        if ((baseObject && baseObject.text !== undefined) || hasAnyString(textKey)) {
          fields.push({ label: 'text', key: textKey });
        }
        const attrKeys = new Set();
        if (isObject(baseObject?.attrs)) {
          Object.keys(baseObject.attrs).forEach((k) => attrKeys.add(k));
        }
        if (isObject(node.attrs)) {
          Object.keys(node.attrs).forEach((k) => attrKeys.add(k));
        }
        attrKeys.forEach((attr) => {
          fields.push({ label: `attr:${attr}`, key: `${i18nBase}.attrs.${attr}` });
        });
      }
    }
    renderStringsSection(aggregateDetail, fields);

    const children = Array.isArray(node.children) ? node.children : (node.children = []);
    renderArraySection(aggregateDetail, 'children', children, {
      labelFn: (item) => buildNodeLabel(item),
      onSelect: (idx) => {
        aggregateSelectedPath = `${entry.path}.children.${idx}`;
        buildAggregateView();
      },
      onRemove: (idx) => {
        children.splice(idx, 1);
        persistConfig();
        buildAggregateView();
      },
      onAdd: () => {
        if (entry.kind === 'object-node') {
          children.push({ tag: 'div', classKey: '', children: [] });
        } else {
          children.push(buildDeployNodeTemplate());
        }
        persistConfig();
        buildAggregateView();
      }
    });
  };

  const renderOverview = (entry) => {
    const { section, body } = createSection(entry.label);
    const list = entry.children || [];
    list.forEach((child) => {
      const row = document.createElement('div');
      row.className = 'agg-row';
      const labelEl = document.createElement('div');
      labelEl.className = 'agg-label';
      labelEl.textContent = child.label;
      const valueEl = document.createElement('div');
      valueEl.className = 'agg-label';
      valueEl.textContent = child.path;
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.textContent = 'Selecionar';
      selectBtn.addEventListener('click', () => {
        aggregateSelectedPath = child.path;
        buildAggregateView();
      });
      actions.appendChild(selectBtn);
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      row.appendChild(actions);
      body.appendChild(row);
    });
    aggregateDetail.appendChild(section);
  };

  if (!selected) return;
  const heading = document.createElement('div');
  heading.className = 'agg-section-title';
  heading.textContent = selected.label;
  aggregateDetail.appendChild(heading);

  switch (selected.kind) {
    case 'meta':
      renderMetaDetail();
      break;
    case 'layout':
      renderOverview(selected);
      break;
    case 'objects':
      renderObjectsDetail();
      break;
    case 'layout-group':
      renderLayoutGroupDetail(selected);
      break;
    case 'pages': {
      renderOverview(selected);
      const pages = Array.isArray(config.pages) ? config.pages : (config.pages = []);
      renderArraySection(aggregateDetail, 'Pages', pages, {
        labelFn: (item, idx) => item.title || item.id || `page-${idx + 1}`,
        onSelect: (idx) => {
          aggregateSelectedPath = `pages.${idx}`;
          buildAggregateView();
        },
        onRemove: (idx) => {
          pages.splice(idx, 1);
          persistConfig();
          buildAggregateView();
        },
        onAdd: () => {
          pages.push({ id: 'page-new', title: '', sections: [] });
          persistConfig();
          buildAggregateView();
        }
      });
      break;
    }
    case 'page':
      renderPageDetail(selected);
      break;
    case 'section':
      renderSectionDetail(selected);
      break;
    case 'node':
    case 'object-node':
      renderNodeDetail(selected);
      break;
    default:
      renderOverview(selected);
      break;
  }
};

const validate = () => {
  try {
    if (currentFile === AGGREGATE_FILE) {
      const config = getDraftJson('data/config.json');
      if (config) {
        const result = validateConfig(config, getClassPresetSourceFromDraft());
        if (result.errors.length) {
          console.error('[EDITOR] Errors:', result.errors);
          alert('JSON inválido. Ver console.');
          return;
        }
        if (result.warn.length) {
          console.warn('[EDITOR] Warnings:', result.warn);
        }
      }
      LANGUAGE_FILES.forEach((file) => {
        const data = getDraftJson(file);
        const { errors, warns } = validateLanguageBundle(data, config, file);
        if (errors.length) {
          console.error('[EDITOR] Errors:', errors);
          alert('JSON inválido. Ver console.');
          return;
        }
        if (warns.length) {
          console.warn('[EDITOR] Warnings:', warns);
        }
      });
      alert('JSON válido.');
      return;
    }

    if (currentFile === CLASS_KEYS_VISUAL_FILE) {
      const payload = getClassKeysPayloadFromDraft();
      const classTree = normalizeClassPresetTree(payload);
      if (!classTree) {
        console.error('[EDITOR] Errors:', [`${CLASS_KEYS_FILE}: invalid class keys payload`]);
        alert('JSON inválido. Ver console.');
        return;
      }
      alert('JSON válido.');
      return;
    }

    const data = JSON.parse(editor.value);
    if (currentFile === 'data/config.json') {
      const result = validateConfig(data, getClassPresetSourceFromDraft());
      if (result.errors.length) {
        console.error('[EDITOR] Errors:', result.errors);
        alert('JSON inválido. Ver console.');
        return;
      }
      if (result.warn.length) {
        console.warn('[EDITOR] Warnings:', result.warn);
      }
    } else if (currentFile === CLASS_KEYS_FILE) {
      const classTree = normalizeClassPresetTree(data);
      if (!classTree) {
        console.error('[EDITOR] Errors:', [`${CLASS_KEYS_FILE}: invalid class keys payload`]);
        alert('JSON inválido. Ver console.');
        return;
      }
    } else {
      const config = getDraftJson('data/config.json');
      const { errors, warns } = validateLanguageBundle(data, config, currentFile);
      if (errors.length) {
        console.error('[EDITOR] Errors:', errors);
        alert('JSON inválido. Ver console.');
        return;
      }
      if (warns.length) {
        console.warn('[EDITOR] Warnings:', warns);
      }
    }
    alert('JSON válido.');
  } catch (e) {
    console.error('[EDITOR] JSON parse error', e);
    alert('JSON inválido.');
  }
};

const download = () => {
  if (currentFile === AGGREGATE_FILE) {
    alert('Seleciona um ficheiro para fazer download.');
    return;
  }
  const content =
    currentFile === CLASS_KEYS_VISUAL_FILE
      ? localStorage.getItem(getDraftKey(CLASS_KEYS_FILE)) || JSON.stringify(getClassKeysPayloadFromDraft(), null, 2)
      : editor.value;
  const fileName = currentFile === CLASS_KEYS_VISUAL_FILE ? 'class-keys.json' : currentFile.split('/').pop() || currentFile;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

editor.addEventListener('input', () => {
  if (currentFile === AGGREGATE_FILE || currentFile === CLASS_KEYS_VISUAL_FILE) return;
  localStorage.setItem(getDraftKey(currentFile), editor.value);
  buildAggregateView();
});

const loadAll = async () => {
  await Promise.all(
    FILES.map(async (file) => {
      const res = await fetch(file);
      if (!res.ok) return;
      const text = await res.text();
      localStorage.setItem(getDraftKey(file), text);
    })
  );
  if (currentFile !== AGGREGATE_FILE && currentFile !== CLASS_KEYS_VISUAL_FILE) {
    await loadFile(currentFile, true);
  } else if (currentFile === CLASS_KEYS_VISUAL_FILE) {
    initClassKeyBuilder();
  }
};

const switchFile = async (file) => {
  if (file === currentFile) return;
  if (currentFile !== AGGREGATE_FILE && currentFile !== CLASS_KEYS_VISUAL_FILE) {
    localStorage.setItem(getDraftKey(currentFile), editor.value);
  }
  currentFile = file;
  if (currentFile === AGGREGATE_FILE) {
    setActiveTab();
    buildAggregateView();
    setViewMode();
    return;
  }
  if (currentFile === CLASS_KEYS_VISUAL_FILE) {
    setActiveTab();
    setViewMode();
    initClassKeyBuilder();
    return;
  }
  await loadFile(currentFile, true);
  setActiveTab();
  setViewMode();
};

if (fileTabs) {
  const aggBtn = document.createElement('button');
  aggBtn.type = 'button';
  aggBtn.dataset.file = AGGREGATE_FILE;
  aggBtn.textContent = 'Agregado';
  aggBtn.addEventListener('click', () => switchFile(AGGREGATE_FILE));
  fileTabs.appendChild(aggBtn);

  const visualClassBtn = document.createElement('button');
  visualClassBtn.type = 'button';
  visualClassBtn.dataset.file = CLASS_KEYS_VISUAL_FILE;
  visualClassBtn.textContent = 'Class Keys Visual';
  visualClassBtn.addEventListener('click', () => switchFile(CLASS_KEYS_VISUAL_FILE));
  fileTabs.appendChild(visualClassBtn);

  FILES.forEach((file) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.file = file;
    btn.textContent = file;
    btn.addEventListener('click', () => switchFile(file));
    fileTabs.appendChild(btn);
  });
}

loadAllBtn.addEventListener('click', loadAll);
validateBtn.addEventListener('click', validate);
downloadBtn.addEventListener('click', download);
if (exitBtn) {
  exitBtn.addEventListener('click', () => {
    window.location.href = new URL('./', window.location.href).toString();
  });
}

setActiveTab();
setViewMode();
loadAll().then(() => buildAggregateView());
