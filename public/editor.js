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
const ckSearch = document.getElementById('ckSearch');
const ckGroupFilter = document.getElementById('ckGroupFilter');
const ckLibrary = document.getElementById('ckLibrary');
const ckDropZone = document.getElementById('ckDropZone');
const ckSelection = document.getElementById('ckSelection');
const ckManualTokens = document.getElementById('ckManualTokens');
const ckPreview = document.getElementById('ckPreview');
const ckExisting = document.getElementById('ckExisting');
const ckTargetGroup = document.getElementById('ckTargetGroup');
const ckTargetKey = document.getElementById('ckTargetKey');
const ckSaveBtn = document.getElementById('ckSaveBtn');
const ckClearBtn = document.getElementById('ckClearBtn');
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
let currentFile = AGGREGATE_FILE;
let aggregateSelectedPath = 'meta';
const aggregateExpanded = new Set(['meta', 'objects', 'layout', 'pages']);
let classKeyBuilderState = null;
let classKeyBuilderEventsBound = false;

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
  (state.selectedPieces || []).forEach((piece) => {
    splitClassTokens(piece.value).forEach(pushToken);
  });
  splitClassTokens(state.manualTokens).forEach(pushToken);
  return ordered.join(' ');
};

const setClassKeyBuilderStatus = (message, type = 'info') => {
  if (!ckStatus) return;
  ckStatus.textContent = message || '';
  ckStatus.classList.toggle('error', type === 'error');
};

const moveClassKeyPiece = (fromIndex, toIndex) => {
  const pieces = classKeyBuilderState?.selectedPieces;
  if (!Array.isArray(pieces)) return;
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= pieces.length) return;
  if (toIndex < 0 || toIndex >= pieces.length) return;
  const [item] = pieces.splice(fromIndex, 1);
  pieces.splice(toIndex, 0, item);
};

const renderClassKeyBuilder = () => {
  if (!classKeyBuilderView || !classKeyBuilderState) return;
  const state = classKeyBuilderState;

  const entryMap = new Map(state.entries.map((entry) => [entry.path, entry]));
  const groupValues = [...new Set(state.entries.map((entry) => entry.group).filter(Boolean))].sort();
  const preview = composeClassKeyValue(state);

  if (ckSearch) ckSearch.value = state.search || '';
  if (ckTargetGroup) ckTargetGroup.value = state.targetGroup || '';
  if (ckTargetKey) ckTargetKey.value = state.targetKey || '';
  if (ckManualTokens) ckManualTokens.value = state.manualTokens || '';
  if (ckPreview) ckPreview.value = preview;

  if (ckGroupFilter) {
    const selected = state.groupFilter || '__all__';
    ckGroupFilter.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '__all__';
    allOption.textContent = 'Todos os grupos';
    ckGroupFilter.appendChild(allOption);
    groupValues.forEach((group) => {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      ckGroupFilter.appendChild(option);
    });
    ckGroupFilter.value = groupValues.includes(selected) ? selected : '__all__';
    state.groupFilter = ckGroupFilter.value;
  }

  if (ckExisting) {
    const previous = state.existingPath || '';
    ckExisting.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecionar class key...';
    ckExisting.appendChild(placeholder);
    state.entries
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.path;
        option.textContent = entry.path;
        ckExisting.appendChild(option);
      });
    ckExisting.value = entryMap.has(previous) ? previous : '';
    state.existingPath = ckExisting.value;
  }

  if (ckLibrary) {
    ckLibrary.innerHTML = '';
    const search = (state.search || '').trim().toLowerCase();
    const filtered = state.entries.filter((entry) => {
      if (state.groupFilter && state.groupFilter !== '__all__' && entry.group !== state.groupFilter) return false;
      if (!search) return true;
      return entry.path.toLowerCase().includes(search) || entry.value.toLowerCase().includes(search);
    });

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'classkey-library-value';
      empty.textContent = 'Sem resultados para os filtros atuais.';
      ckLibrary.appendChild(empty);
    } else {
      filtered.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'classkey-library-item';
        item.draggable = true;
        item.dataset.path = entry.path;

        const path = document.createElement('div');
        path.className = 'classkey-library-path';
        path.textContent = entry.path;

        const value = document.createElement('div');
        value.className = 'classkey-library-value';
        value.textContent = entry.value;

        item.appendChild(path);
        item.appendChild(value);
        ckLibrary.appendChild(item);
      });
    }
  }

  if (ckSelection) {
    ckSelection.innerHTML = '';
    state.selectedPieces.forEach((piece, index) => {
      const row = document.createElement('div');
      row.className = 'classkey-piece';
      row.draggable = true;
      row.dataset.index = String(index);

      const meta = document.createElement('div');
      meta.className = 'classkey-piece-meta';

      const path = document.createElement('div');
      path.className = 'classkey-piece-path';
      path.textContent = piece.sourcePath;

      const actions = document.createElement('div');
      actions.className = 'classkey-piece-actions';

      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        moveClassKeyPiece(index, index - 1);
        renderClassKeyBuilder();
      });

      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.disabled = index === state.selectedPieces.length - 1;
      down.addEventListener('click', () => {
        moveClassKeyPiece(index, index + 1);
        renderClassKeyBuilder();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remover';
      remove.addEventListener('click', () => {
        state.selectedPieces.splice(index, 1);
        renderClassKeyBuilder();
      });

      actions.appendChild(up);
      actions.appendChild(down);
      actions.appendChild(remove);
      meta.appendChild(path);
      meta.appendChild(actions);

      const value = document.createElement('div');
      value.className = 'classkey-piece-value';
      value.textContent = piece.value;

      row.appendChild(meta);
      row.appendChild(value);
      ckSelection.appendChild(row);
    });
  }
};

const buildClassKeyBuilderState = () => {
  const payload = getClassKeysPayloadFromDraft();
  const entries = flattenClassPresetEntries(payload.classPresets);
  const previous = classKeyBuilderState || {};
  classKeyBuilderState = {
    payload,
    entries,
    selectedPieces: Array.isArray(previous.selectedPieces) ? previous.selectedPieces : [],
    manualTokens: previous.manualTokens || '',
    targetGroup: previous.targetGroup || 'visual.shared',
    targetKey: previous.targetKey || '',
    existingPath: previous.existingPath || '',
    search: previous.search || '',
    groupFilter: previous.groupFilter || '__all__'
  };
  renderClassKeyBuilder();
};

const bindClassKeyBuilderEvents = () => {
  if (classKeyBuilderEventsBound) return;
  if (!classKeyBuilderView) return;
  classKeyBuilderEventsBound = true;

  const addPieceByPath = (sourcePath, insertIndex = null) => {
    const state = classKeyBuilderState;
    if (!state) return;
    const entry = state.entries.find((item) => item.path === sourcePath);
    if (!entry) return;
    const piece = {
      id: `${Date.now()}-${Math.random()}`,
      sourcePath: entry.path,
      value: entry.value
    };
    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= state.selectedPieces.length) {
      state.selectedPieces.splice(insertIndex, 0, piece);
    } else {
      state.selectedPieces.push(piece);
    }
    renderClassKeyBuilder();
  };

  if (ckSearch) {
    ckSearch.addEventListener('input', (event) => {
      classKeyBuilderState.search = event.target.value || '';
      renderClassKeyBuilder();
    });
  }

  if (ckGroupFilter) {
    ckGroupFilter.addEventListener('change', (event) => {
      classKeyBuilderState.groupFilter = event.target.value || '__all__';
      renderClassKeyBuilder();
    });
  }

  if (ckLibrary) {
    ckLibrary.addEventListener('click', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const item = targetEl ? targetEl.closest('.classkey-library-item') : null;
      if (!item || !item.dataset.path) return;
      addPieceByPath(item.dataset.path);
    });
    ckLibrary.addEventListener('dragstart', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const item = targetEl ? targetEl.closest('.classkey-library-item') : null;
      if (!item || !item.dataset.path) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/classkey-piece', item.dataset.path);
    });
  }

  if (ckDropZone) {
    ckDropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      ckDropZone.classList.add('over');
      event.dataTransfer.dropEffect = 'copy';
    });
    ckDropZone.addEventListener('dragleave', () => {
      ckDropZone.classList.remove('over');
    });
    ckDropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      ckDropZone.classList.remove('over');
      const sourcePath = event.dataTransfer.getData('text/classkey-piece');
      if (sourcePath) addPieceByPath(sourcePath);
    });
  }

  if (ckSelection) {
    ckSelection.addEventListener('dragstart', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const row = targetEl ? targetEl.closest('.classkey-piece') : null;
      if (!row || row.dataset.index === undefined) return;
      row.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/classkey-selected-index', row.dataset.index);
    });
    ckSelection.addEventListener('dragend', (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const row = targetEl ? targetEl.closest('.classkey-piece') : null;
      if (row) row.classList.remove('is-dragging');
    });
    ckSelection.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    ckSelection.addEventListener('drop', (event) => {
      event.preventDefault();
      const targetEl = event.target instanceof Element ? event.target : null;
      const target = targetEl ? targetEl.closest('.classkey-piece') : null;
      const sourcePath = event.dataTransfer.getData('text/classkey-piece');
      const fromIndexRaw = event.dataTransfer.getData('text/classkey-selected-index');
      const targetIndex = target?.dataset.index !== undefined ? Number(target.dataset.index) : null;

      if (sourcePath) {
        addPieceByPath(sourcePath, targetIndex === null ? null : targetIndex);
        return;
      }

      if (fromIndexRaw === '') return;
      const fromIndex = Number(fromIndexRaw);
      if (!Number.isFinite(fromIndex)) return;
      if (targetIndex === null) return;
      moveClassKeyPiece(fromIndex, targetIndex);
      renderClassKeyBuilder();
    });
  }

  if (ckManualTokens) {
    ckManualTokens.addEventListener('input', (event) => {
      classKeyBuilderState.manualTokens = event.target.value || '';
      renderClassKeyBuilder();
    });
  }

  if (ckTargetGroup) {
    ckTargetGroup.addEventListener('input', (event) => {
      classKeyBuilderState.targetGroup = event.target.value || '';
    });
  }

  if (ckTargetKey) {
    ckTargetKey.addEventListener('input', (event) => {
      classKeyBuilderState.targetKey = event.target.value || '';
    });
  }

  if (ckExisting) {
    ckExisting.addEventListener('change', (event) => {
      const selectedPath = event.target.value || '';
      classKeyBuilderState.existingPath = selectedPath;
      if (!selectedPath) return;
      const entry = classKeyBuilderState.entries.find((item) => item.path === selectedPath);
      if (!entry) return;
      classKeyBuilderState.targetGroup = entry.group;
      classKeyBuilderState.targetKey = entry.key;
      classKeyBuilderState.selectedPieces = [];
      classKeyBuilderState.manualTokens = entry.value;
      setClassKeyBuilderStatus(`Carregado: ${selectedPath}`);
      renderClassKeyBuilder();
    });
  }

  if (ckClearBtn) {
    ckClearBtn.addEventListener('click', () => {
      classKeyBuilderState.selectedPieces = [];
      classKeyBuilderState.manualTokens = '';
      setClassKeyBuilderStatus('Composição limpa.');
      renderClassKeyBuilder();
    });
  }

  if (ckSaveBtn) {
    ckSaveBtn.addEventListener('click', () => {
      const state = classKeyBuilderState;
      const group = (state.targetGroup || '').trim();
      const key = (state.targetKey || '').trim();
      if (!group) {
        setClassKeyBuilderStatus('Grupo alvo é obrigatório.', 'error');
        return;
      }
      if (!key) {
        setClassKeyBuilderStatus('Nome da class key é obrigatório.', 'error');
        return;
      }
      const value = composeClassKeyValue(state);
      if (!value) {
        setClassKeyBuilderStatus('Classe final está vazia.', 'error');
        return;
      }

      const root = ensureObjectPath(state.payload.classPresets, group);
      root[key] = value;
      persistClassKeysPayload(state.payload);

      state.entries = flattenClassPresetEntries(state.payload.classPresets);
      state.existingPath = `${group}.${key}`;
      setClassKeyBuilderStatus(`Guardado em ${state.existingPath}`);
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
