const resolveClassPresetTree = (source) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  if (Object.prototype.hasOwnProperty.call(source, 'classPresets')) {
    const nested = source.classPresets;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  }
  return source;
};

export function validateConfig(config, classPresetsSource) {
  const errors = [];
  const warn = [];

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const objectKeys = new Set();
  const usedNodeIds = new Map();

  if (!isObj(config)) errors.push('Config is not an object');
  if (!config.meta) errors.push('Missing meta');
  if (!config.pages || !Array.isArray(config.pages)) errors.push('Missing pages array');

  if (config.meta) {
    if (!config.meta.title && !config.meta.titleKey) warn.push('meta.title missing');
    if (!config.meta.lang) warn.push('meta.lang missing');
    if (!config.meta.description && !config.meta.descriptionKey) warn.push('meta.description missing');
    if (!config.meta.classPresetsFile && !config.meta.classPresets) {
      errors.push('meta.classPresetsFile missing');
    }
    if (config.meta.classPresets) {
      warn.push('meta.classPresets is deprecated; move class keys to data/class-keys.json');
    }
    if (!config.meta.theme) warn.push('meta.theme missing');
    else {
      ['bg','text','muted','accent'].forEach((k) => {
        if (!config.meta.theme[k]) warn.push(`meta.theme.${k} missing`);
      });
    }
    if (config.meta.pwa?.enabled) {
      if (!config.meta.pwa.name && !config.meta.pwa.nameKey) warn.push('meta.pwa.name missing');
      if (!config.meta.pwa.shortName && !config.meta.pwa.shortNameKey) warn.push('meta.pwa.shortName missing');
      if (!config.meta.pwa.icons || !config.meta.pwa.icons.length) warn.push('meta.pwa.icons missing');
      if (!config.meta.favicon?.icon) warn.push('meta.favicon.icon missing');
    }
  }

  const classPresetKeys = new Set();
  const collectClassPresetKeys = (node, prefix = '') => {
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
      collectClassPresetKeys(value, path);
    });
  };
  const classPresetTree = resolveClassPresetTree(classPresetsSource) || config?.meta?.classPresets;
  if (classPresetTree) {
    collectClassPresetKeys(classPresetTree);
  } else {
    warn.push('Class keys catalog missing or invalid');
  }

  if (config?.objects && !isObj(config.objects)) {
    errors.push('objects is not an object');
  } else if (isObj(config?.objects)) {
    Object.keys(config.objects).forEach((key) => objectKeys.add(key));
  }

  const validateNode = (node, path, scope) => {
    if (!isObj(node)) {
      errors.push(`${path} is not an object`);
      return;
    }
    if (node.id !== undefined && typeof node.id !== 'string') {
      warn.push(`${path}.id not string`);
    }
    if (typeof node.id === 'string') {
      const prev = usedNodeIds.get(node.id);
      if (prev) warn.push(`${path}.id "${node.id}" duplicates ${prev}`);
      else usedNodeIds.set(node.id, path);
    }
    if (scope === 'instance' && !node.id) {
      errors.push(`${path}.id missing (deploy nodes must define id for obj.<id> i18n ref)`);
    }
    if (node.ref !== undefined && typeof node.ref !== 'string') {
      warn.push(`${path}.ref not string`);
    }
    if (scope === 'instance' && !node.ref) {
      errors.push(`${path}.ref missing (deploy nodes must reference objects.<key>)`);
    }
    if (typeof node.ref === 'string' && !objectKeys.has(node.ref)) {
      errors.push(`${path}.ref "${node.ref}" missing in objects`);
    }
    if (node.i18nKey !== undefined && typeof node.i18nKey !== 'string') {
      warn.push(`${path}.i18nKey not string`);
    }
    if (scope === 'instance' && node.i18nKey) {
      errors.push(`${path}.i18nKey not allowed in deploy nodes (strings are keyed by obj.<id>)`);
    }
    if (typeof node.i18nKey === 'string' && node.i18nKey) {
      if (!/^obj(def)?\./.test(node.i18nKey)) {
        warn.push(`${path}.i18nKey "${node.i18nKey}" should start with "obj." or "objdef."`);
      }
    }
    if (!node.tag && !node.ref) {
      errors.push(`${path}.tag or ${path}.ref required`);
    }
    if (node.tag !== undefined && typeof node.tag !== 'string') {
      errors.push(`${path}.tag not string`);
    }
    if (scope === 'instance' && node.tag) {
      errors.push(`${path}.tag not allowed in deploy nodes (comes from ref object)`);
    }
    if (node.class && typeof node.class !== 'string') {
      warn.push(`${path}.class not string`);
    }
    if (scope === 'instance' && node.class) {
      errors.push(`${path}.class not allowed in deploy nodes (comes from ref object)`);
    }
    if (scope === 'instance' && node.classKey) {
      errors.push(`${path}.classKey not allowed in deploy nodes (comes from ref object)`);
    }
    const requiresClassKey = scope === 'object';
    if (requiresClassKey && !node.classKey) {
      errors.push(`${path}.classKey missing`);
    }
    if (node.classKey && typeof node.classKey !== 'string') {
      errors.push(`${path}.classKey not string`);
    }
    if (node.classKey && typeof node.classKey === 'string' && !classPresetKeys.has(node.classKey)) {
      errors.push(`${path}.classKey "${node.classKey}" missing in class keys catalog`);
    }
    if (node.text && typeof node.text !== 'string') {
      warn.push(`${path}.text not string`);
    }
    if (scope === 'instance' && node.text !== undefined) {
      errors.push(`${path}.text not allowed in deploy nodes (use obj.<id>.text in language files)`);
    }
    if (node.textKey && typeof node.textKey !== 'string') {
      warn.push(`${path}.textKey not string`);
    }
    if (scope === 'instance' && node.textKey) {
      errors.push(`${path}.textKey not allowed in deploy nodes (use obj.<id>.text in language files)`);
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
    if (scope === 'instance' && node.attrsI18n) {
      errors.push(`${path}.attrsI18n not allowed in deploy nodes (use obj.<id>.attrs.* in language files)`);
    }
    if (node.styles && !isObj(node.styles)) {
      warn.push(`${path}.styles not object`);
    }
    if (node.children) {
      if (!Array.isArray(node.children)) {
        errors.push(`${path}.children not array`);
      } else {
        node.children.forEach((child, idx) => validateNode(child, `${path}.children[${idx}]`, scope));
      }
    }
  };

  if (isObj(config?.objects)) {
    Object.entries(config.objects).forEach(([key, node]) => {
      validateNode(node, `objects.${key}`, 'object');
    });
  }

  if (config?.layout && !isObj(config.layout)) {
    errors.push('layout is not an object');
  } else if (isObj(config?.layout)) {
    Object.entries(config.layout).forEach(([name, nodes]) => {
      if (!Array.isArray(nodes)) {
        errors.push(`layout.${name} missing or not array`);
        return;
      }
      nodes.forEach((node, idx) => validateNode(node, `layout.${name}[${idx}]`, 'instance'));
    });
  }

  if (Array.isArray(config.pages)) {
    config.pages.forEach((page, pIdx) => {
      if (!page.id) warn.push(`pages[${pIdx}].id missing`);
      if (!Array.isArray(page.sections)) errors.push(`pages[${pIdx}].sections missing or not array`);
      (page.sections || []).forEach((section, sIdx) => {
        if (!section.id) warn.push(`pages[${pIdx}].sections[${sIdx}].id missing`);
        if (!Array.isArray(section.nodes)) errors.push(`pages[${pIdx}].sections[${sIdx}].nodes missing or not array`);
        (section.nodes || []).forEach((node, nIdx) => validateNode(node, `pages[${pIdx}].sections[${sIdx}].nodes[${nIdx}]`, 'instance'));
      });
    });
  }

  return { errors, warn };
}
