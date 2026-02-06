export type NodeDef = {
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

  const validateNode = (node: NodeDef, path: string) => {
    if (!isObj(node)) {
      errors.push(`${path} is not an object`);
      return;
    }
    if (!node.tag || typeof node.tag !== 'string') {
      errors.push(`${path}.tag missing or not string`);
    }
    if (node.class && typeof node.class !== 'string') {
      warn.push(`${path}.class not string`);
    }
    if (node.classKey && typeof node.classKey !== 'string') {
      warn.push(`${path}.classKey not string`);
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
