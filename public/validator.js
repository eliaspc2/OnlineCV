export function validateConfig(config) {
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

  if (config?.objects && !isObj(config.objects)) {
    errors.push('objects is not an object');
  } else if (isObj(config?.objects)) {
    Object.keys(config.objects).forEach((key) => objectKeys.add(key));
  }

  const validateNode = (node, path) => {
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
    Object.entries(config.objects).forEach(([key, node]) => validateNode(node, `objects.${key}`));
  }

  if (config?.layout && !isObj(config.layout)) {
    errors.push('layout is not an object');
  } else if (isObj(config?.layout)) {
    Object.entries(config.layout).forEach(([name, nodes]) => {
      if (!Array.isArray(nodes)) {
        errors.push(`layout.${name} missing or not array`);
        return;
      }
      nodes.forEach((node, idx) => validateNode(node, `layout.${name}[${idx}]`));
    });
  }

  if (Array.isArray(config.pages)) {
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
