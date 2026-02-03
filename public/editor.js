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

const AGGREGATE_FILE = '__aggregate__';
const FILES = [
  'data/config.json',
  'data/uk-en.json',
  'data/pt-pt.json',
  'data/es-es.json',
  'data/fr-fr.json'
];
const STORAGE_PREFIX = 'json_site_draft:';
let currentFile = AGGREGATE_FILE;
let aggregateSelectedPath = 'meta';
const aggregateExpanded = new Set(['meta', 'layout', 'pages']);

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
  if (aggregateView) aggregateView.classList.toggle('hidden', !isAggregate);
  editor.classList.toggle('hidden', isAggregate);
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

const getDraftJson = (file) => parseJsonSafe(localStorage.getItem(getDraftKey(file)) || '');

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
    if (data && data.strings) {
      stringsByFile[file] = data.strings;
    }
  });

  const getString = (file, key) => {
    if (!file || !key) return '';
    return (stringsByFile[file] && stringsByFile[file][key]) || '';
  };

  const persistConfig = () => {
    localStorage.setItem(getDraftKey('data/config.json'), JSON.stringify(config, null, 2));
  };

  const updateStringValue = (file, key, value) => {
    if (!file || !key) return;
    const data = getDraftJson(file) || { lang: '', strings: {} };
    if (!data.lang) {
      const langDef = languages.find((l) => l.stringsFile === file);
      data.lang = langDef?.code || 'en-GB';
    }
    if (!data.strings || typeof data.strings !== 'object') {
      data.strings = {};
    }
    data.strings[key] = value;
    localStorage.setItem(getDraftKey(file), JSON.stringify(data, null, 2));
  };

  const buildNodeLabel = (node) => {
    if (!node || typeof node !== 'object') return 'node';
    const tag = node.tag || 'div';
    const id = node.attrs?.id ? `#${node.attrs.id}` : '';
    const className = node.class ? `.${node.class.split(' ')[0]}` : '';
    return `${tag}${id}${className}`;
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

  const buildNodeTree = (nodes, basePath) => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map((node, idx) => {
      const path = `${basePath}.${idx}`;
      const entry = {
        kind: 'node',
        label: buildNodeLabel(node),
        path,
        ref: node,
        parentArray: nodes,
        index: idx,
        children: buildNodeTree(node.children, `${path}.children`)
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

  const treeData = [];
  treeData.push({ kind: 'meta', label: 'Meta', path: 'meta', ref: config.meta || {}, children: [] });

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
        nodes.push({ tag: 'div', class: '', children: [] });
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
        nodes.push({ tag: 'div', class: '', children: [] });
        persistConfig();
        buildAggregateView();
      }
    });
  };

  const renderNodeDetail = (entry) => {
    const node = entry.ref;
    const { section, body } = createSection('Node');
    addFieldRow(body, 'tag', node.tag, (val) => {
      node.tag = val;
    });
    addFieldRow(body, 'class', node.class || '', (val) => {
      node.class = val;
    });
    addFieldRow(body, 'textKey', node.textKey || '', (val) => {
      node.textKey = val;
    });
    if (node.text !== undefined) {
      addFieldRow(body, 'text', node.text || '', (val) => {
        node.text = val;
      });
    }
    aggregateDetail.appendChild(section);

    renderKeyValueSection(aggregateDetail, 'attrs', node.attrs, (val) => {
      node.attrs = val;
    });
    renderKeyValueSection(aggregateDetail, 'styles', node.styles, (val) => {
      node.styles = val;
    });
    renderKeyValueSection(aggregateDetail, 'attrsI18n', node.attrsI18n, (val) => {
      node.attrsI18n = val;
    });

    const fields = [];
    if (node.textKey) fields.push({ label: 'text', key: node.textKey });
    if (node.attrsI18n) {
      Object.entries(node.attrsI18n).forEach(([attr, key]) => {
        fields.push({ label: `attr:${attr}`, key });
      });
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
        children.push({ tag: 'div', class: '', children: [] });
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
        const result = validateConfig(config);
        if (result.errors.length) {
          console.error('[EDITOR] Errors:', result.errors);
          alert('JSON inválido. Ver console.');
          return;
        }
        if (result.warn.length) {
          console.warn('[EDITOR] Warnings:', result.warn);
        }
      }
      FILES.filter((f) => f !== 'data/config.json').forEach((file) => {
        const data = getDraftJson(file);
        const errors = [];
        if (!data || typeof data !== 'object') errors.push(`${file}: Strings file is not an object`);
        if (!data?.lang) errors.push(`${file}: Missing lang`);
        if (!data?.strings || typeof data.strings !== 'object') errors.push(`${file}: Missing strings object`);
        if (errors.length) {
          console.error('[EDITOR] Errors:', errors);
          alert('JSON inválido. Ver console.');
          return;
        }
      });
      alert('JSON válido.');
      return;
    }

    const data = JSON.parse(editor.value);
    if (currentFile === 'data/config.json') {
      const result = validateConfig(data);
      if (result.errors.length) {
        console.error('[EDITOR] Errors:', result.errors);
        alert('JSON inválido. Ver console.');
        return;
      }
      if (result.warn.length) {
        console.warn('[EDITOR] Warnings:', result.warn);
      }
    } else {
      const errors = [];
      if (!data || typeof data !== 'object') errors.push('Strings file is not an object');
      if (!data.lang) errors.push('Missing lang');
      if (!data.strings || typeof data.strings !== 'object') errors.push('Missing strings object');
      if (errors.length) {
        console.error('[EDITOR] Errors:', errors);
        alert('JSON inválido. Ver console.');
        return;
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
  const blob = new Blob([editor.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFile.split('/').pop() || currentFile;
  a.click();
  URL.revokeObjectURL(url);
};

editor.addEventListener('input', () => {
  if (currentFile === AGGREGATE_FILE) return;
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
  if (currentFile !== AGGREGATE_FILE) {
    await loadFile(currentFile, true);
  }
};

const switchFile = async (file) => {
  if (file === currentFile) return;
  if (currentFile !== AGGREGATE_FILE) {
    localStorage.setItem(getDraftKey(currentFile), editor.value);
  }
  currentFile = file;
  if (currentFile === AGGREGATE_FILE) {
    setActiveTab();
    buildAggregateView();
    setViewMode();
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
    window.location.href = '/';
  });
}

setActiveTab();
setViewMode();
loadAll().then(() => buildAggregateView());
