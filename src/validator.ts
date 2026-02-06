export type NodeDef = {
  id?: string;
  ref?: string;
  i18nKey?: string;
  tag?: string;
  class?: string;
  classKey?: string;
  text?: string;
  textKey?: string;
  attrs?: Record<string, string>;
  attrsI18n?: Record<string, string>;
  styles?: Record<string, string>;
  children?: NodeDef[];
};

export type PwaIcon = {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
};

export type PwaConfig = {
  enabled?: boolean;
  name?: string;
  nameKey?: string;
  shortName?: string;
  shortNameKey?: string;
  description?: string;
  descriptionKey?: string;
  startUrl?: string;
  scope?: string;
  display?: string;
  orientation?: string;
  themeColor?: string;
  backgroundColor?: string;
  icons?: PwaIcon[];
};

export type FaviconConfig = {
  icon?: string;
  appleTouchIcon?: string;
  maskIcon?: string;
  color?: string;
};

export type StyleGroupValue =
  | string
  | StyleGroupValue[]
  | { [key: string]: StyleGroupValue };

export type ClassPresetGroup = {
  [key: string]: string | ClassPresetGroup;
};

export type Config = {
  meta: {
    title?: string;
    titleKey?: string;
    description?: string;
    descriptionKey?: string;
    lang?: string;
    defaultLanguage?: string;
    theme?: Record<string, string>;
    classPresets?: ClassPresetGroup;
    styles?: {
      order?: string[];
      [group: string]: StyleGroupValue | undefined;
    };
    languages?: { code: string; label: string; stringsFile?: string; flag: string }[];
    favicon?: FaviconConfig;
    pwa?: PwaConfig;
  };
  objects?: Record<string, NodeDef>;
  layout?: { header?: NodeDef[]; footer?: NodeDef[]; floating?: NodeDef[] };
  pages: { id: string; sections: { id: string; nodes: NodeDef[] }[] }[];
};

export function validateConfig(config: Config) {
  const errors: string[] = [];
  const warn: string[] = [];

  const isObj = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v);

  if (!isObj(config)) errors.push('Config is not an object');
  if (!config?.meta) errors.push('Missing meta');
  if (!config?.pages || !Array.isArray(config.pages)) errors.push('Missing pages array');

  if (config?.meta) {
    if (!config.meta.title && !config.meta.titleKey) warn.push('meta.title missing');
    if (!config.meta.lang) warn.push('meta.lang missing');
    if (!config.meta.theme) warn.push('meta.theme missing');
    if (!config.meta.description && !config.meta.descriptionKey) warn.push('meta.description missing');
    if (config.meta.pwa?.enabled) {
      if (!config.meta.pwa.name && !config.meta.pwa.nameKey) warn.push('meta.pwa.name missing');
      if (!config.meta.pwa.shortName && !config.meta.pwa.shortNameKey) warn.push('meta.pwa.shortName missing');
      if (!config.meta.pwa.icons?.length) warn.push('meta.pwa.icons missing');
      if (!config.meta.favicon?.icon) warn.push('meta.favicon.icon missing');
    }
  }

  const classPresetKeys = new Set<string>();
  const objectKeys = new Set<string>();
  const usedNodeIds = new Map<string, string>();
  const collectClassPresetKeys = (node: ClassPresetGroup | string, prefix = '') => {
    if (typeof node === 'string') {
      if (prefix) classPresetKeys.add(prefix);
      return;
    }
    if (!isObj(node)) return;
    Object.entries(node).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') {
        classPresetKeys.add(path);
        return;
      }
      collectClassPresetKeys(value as ClassPresetGroup, path);
    });
  };
  if (config?.meta?.classPresets) {
    collectClassPresetKeys(config.meta.classPresets);
  }

  if (config?.objects && !isObj(config.objects)) {
    errors.push('objects is not an object');
  }
  if (isObj(config?.objects)) {
    Object.keys(config.objects as Record<string, NodeDef>).forEach((key) => objectKeys.add(key));
  }

  const validateNode = (node: NodeDef, path: string) => {
    if (!isObj(node)) {
      errors.push(`${path} is not an object`);
      return;
    }
    if (node.id !== undefined && typeof node.id !== 'string') {
      warn.push(`${path}.id not string`);
    }
    if (typeof node.id === 'string') {
      const prev = usedNodeIds.get(node.id);
      if (prev) {
        warn.push(`${path}.id "${node.id}" duplicates ${prev}`);
      } else {
        usedNodeIds.set(node.id, path);
      }
    }
    if (node.ref !== undefined && typeof node.ref !== 'string') {
      warn.push(`${path}.ref not string`);
    }
    if (typeof node.ref === 'string' && !objectKeys.has(node.ref)) {
      warn.push(`${path}.ref "${node.ref}" missing in objects`);
    }
    if (node.i18nKey !== undefined && typeof node.i18nKey !== 'string') {
      warn.push(`${path}.i18nKey not string`);
    }
    if (!node.tag && !node.ref) {
      errors.push(`${path}.tag or ${path}.ref required`);
    }
    if (node.tag !== undefined && typeof node.tag !== 'string') {
      errors.push(`${path}.tag not string`);
    }
    if (node.class && typeof node.class !== 'string') {
      warn.push(`${path}.class not string`);
    }
    if (node.class && typeof node.class === 'string' && !node.classKey) {
      warn.push(`${path}.class has no classKey`);
    }
    if (node.classKey && typeof node.classKey !== 'string') {
      warn.push(`${path}.classKey not string`);
    }
    if (node.classKey && typeof node.classKey === 'string' && !classPresetKeys.has(node.classKey)) {
      warn.push(`${path}.classKey "${node.classKey}" missing in meta.classPresets`);
    }
    if (node.text && typeof node.text !== 'string') {
      warn.push(`${path}.text not string`);
    }
    if (node.textKey && typeof node.textKey !== 'string') {
      warn.push(`${path}.textKey not string`);
    }
    if (node.attrs && !isObj(node.attrs)) {
      warn.push(`${path}.attrs not object`);
    }
    if (node.attrsI18n && !isObj(node.attrsI18n)) {
      warn.push(`${path}.attrsI18n not object`);
    } else if (node.attrsI18n && isObj(node.attrsI18n)) {
      Object.entries(node.attrsI18n).forEach(([k, v]) => {
        if (typeof v !== 'string') warn.push(`${path}.attrsI18n.${k} not string`);
      });
    }
    if (node.styles && !isObj(node.styles)) {
      warn.push(`${path}.styles not object`);
    }
    if (node.children) {
      if (!Array.isArray(node.children)) {
        errors.push(`${path}.children not array`);
      } else {
        node.children.forEach((child, idx) => validateNode(child, `${path}.children[${idx}]`));
      }
    }
  };

  if (isObj(config?.objects)) {
    Object.entries(config.objects as Record<string, NodeDef>).forEach(([key, node]) =>
      validateNode(node, `objects.${key}`)
    );
  }

  if (config?.layout && !isObj(config.layout)) {
    errors.push('layout is not an object');
  } else if (isObj(config?.layout)) {
    Object.entries(config.layout as Record<string, NodeDef[] | undefined>).forEach(([name, nodes]) => {
      if (!Array.isArray(nodes)) {
        errors.push(`layout.${name} missing or not array`);
        return;
      }
      nodes.forEach((node, idx) => validateNode(node, `layout.${name}[${idx}]`));
    });
  }

  if (Array.isArray(config?.pages)) {
    config.pages.forEach((page, pIdx) => {
      if (!page.id) warn.push(`pages[${pIdx}].id missing`);
      if (!Array.isArray(page.sections)) errors.push(`pages[${pIdx}].sections missing or not array`);
      (page.sections || []).forEach((section, sIdx) => {
        if (!section.id) warn.push(`pages[${pIdx}].sections[${sIdx}].id missing`);
        if (!Array.isArray(section.nodes)) errors.push(`pages[${pIdx}].sections[${sIdx}].nodes missing or not array`);
        (section.nodes || []).forEach((node, nIdx) => validateNode(node, `pages[${pIdx}].sections[${sIdx}].nodes[${nIdx}]`));
      });
    });
  }

  return { errors, warn };
}
