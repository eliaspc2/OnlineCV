import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { renderNode } from './renderer';
import { validateConfig, type ClassPresetGroup, type Config } from './validator';

const STORAGE_KEY = 'json-site-lang';
const DEFAULT_STRINGS_FILE = 'data/uk-en.json';
const APP_BUILD_VERSION = '2026-09-05.3';
const DATA_CACHE_KEY = APP_BUILD_VERSION;

const FOOTER_DOCUMENT_LINKS = [
  {
    label: 'CV Padrão',
    href: 'assets/docs/cv-andre-camara.pdf',
    download: 'cv-andre-camara.pdf'
  },
  {
    label: 'CV Estendido',
    href: 'assets/docs/cv-extended-andre-camara.pdf',
    download: 'cv-extended-andre-camara.pdf'
  },
  {
    label: 'Python I',
    href: 'assets/docs/cert-python-intro-helsinki.png',
    download: 'cert-python-intro-helsinki.png'
  },
  {
    label: 'Python II',
    href: 'assets/docs/cert-python-adv-helsinki.png',
    download: 'cert-python-adv-helsinki.png'
  },
  {
    label: 'Marketing',
    href: 'assets/docs/cert-marketing-digital.pdf',
    download: 'cert-marketing-digital.pdf'
  },
  {
    label: 'EFA Programação',
    href: 'assets/docs/efa-program-content.pdf',
    download: 'efa-program-content.pdf'
  },
  {
    label: 'CET Cibersegurança',
    href: 'assets/docs/Referencial_de_Dupla_Certifica____o_CET_em_Ciberseguran__a.pdf',
    download: 'Referencial_de_Dupla_Certifica____o_CET_em_Ciberseguran__a.pdf'
  },
  {
    label: 'Ciência de Dados',
    href: 'assets/docs/data-science-program-content.pdf',
    download: 'data-science-program-content.pdf'
  }
];

const isAbsoluteUrl = (value: string) =>
  value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value);

const toPublicUrl = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

const toPublicUrlIfRelative = (path?: string) => {
  if (!path) return path;
  if (isAbsoluteUrl(path)) return path;
  return toPublicUrl(path);
};

const withCacheVersion = (url: string, version = DATA_CACHE_KEY) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

const parseBooleanAttr = (el: Element, attr: string, fallback: boolean) => {
  const raw = el.getAttribute(attr);
  if (raw === null || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(normalized);
};

type StringsBundle = {
  lang?: string;
  strings: Record<string, string>;
};

type StringsReference = {
  ref?: string;
  strings?: unknown;
};

type RawStringsBundle = {
  lang?: string;
  strings?: Record<string, string>;
  globals?: Record<string, string>;
  references?: StringsReference[];
};

type ClassKeysBundle = {
  classPresets?: ClassPresetGroup;
};

type SectionId = 'hero' | 'about' | 'experience' | 'skills' | 'mindset' | 'summary' | 'now' | 'contact';
type SectionNotePosition = { section: SectionId; top: number };
type ScrollNoteConfig = { key: string; side: 'left' | 'right'; offset?: number };

const scrollNotes: Partial<Record<SectionId, ScrollNoteConfig[]>> = {
  experience: [
    { key: 'notes.experience.left', side: 'left', offset: -80 },
    { key: 'notes.experience.right', side: 'right', offset: 72 }
  ],
  skills: [
    { key: 'notes.skills.right', side: 'right', offset: 110 }
  ],
  mindset: [
    { key: 'notes.mindset.left', side: 'left', offset: 20 }
  ],
  summary: [
    { key: 'notes.summary.right', side: 'right', offset: -24 }
  ],
  now: [
    { key: 'notes.now.left', side: 'left', offset: -36 },
    { key: 'notes.now.right', side: 'right', offset: 80 }
  ],
  contact: [
    { key: 'notes.contact.left', side: 'left', offset: -24 },
    { key: 'notes.contact.right', side: 'right', offset: 56 }
  ]
};

const ScrollNotes = ({
  positions,
  strings
}: {
  positions: SectionNotePosition[];
  strings: Record<string, string>;
}) => {
  return (
    <aside className="scroll-notes" aria-label={strings['notes.aria'] || 'Section highlights'}>
      {positions.map(({ section, top }) => {
        const notes = scrollNotes[section];
        if (!notes?.length) return null;
        return (
          <div
            className="scroll-note-cluster"
            key={section}
            data-scroll-note-section={section}
            style={{ top: `${top}px` }}
          >
            {notes.map((note) => (
              <div
                className={`scroll-note scroll-note-${note.side}`}
                key={`${section}-${note.side}-${note.key}`}
                style={{ '--note-offset': `${note.offset || 0}px` } as React.CSSProperties}
              >
                {strings[note.key]}
              </div>
            ))}
          </div>
        );
      })}
    </aside>
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const flattenReferenceStrings = (
  ref: string,
  value: unknown,
  out: Record<string, string>,
  trail: string[] = []
) => {
  if (typeof value === 'string') {
    const key = [ref, ...trail].join('.');
    out[key] = value;
    return;
  }
  if (!isRecord(value)) return;
  Object.entries(value).forEach(([k, v]) => {
    flattenReferenceStrings(ref, v, out, [...trail, k]);
  });
};

const skillLevelLabel = (percentText: string, lang?: string) => {
  const match = percentText.match(/^(\d{1,3})%$/);
  if (!match) return percentText;
  const value = Number(match[1]);
  const locale = (lang || '').toLowerCase();

  const band = value >= 60 ? 'advanced' : value >= 45 ? 'solid' : 'operational';

  if (locale.startsWith('pt')) {
    return band === 'advanced' ? 'Avançado' : band === 'solid' ? 'Sólido' : 'Operacional';
  }
  if (locale.startsWith('es')) {
    return band === 'advanced' ? 'Avanzado' : band === 'solid' ? 'Sólido' : 'Operativo';
  }
  if (locale.startsWith('fr')) {
    return band === 'advanced' ? 'Avancé' : band === 'solid' ? 'Solide' : 'Opérationnel';
  }
  return band === 'advanced' ? 'Advanced' : band === 'solid' ? 'Strong' : 'Operational';
};

const normalizeStringsBundle = (raw: unknown): StringsBundle => {
  const out: Record<string, string> = {};
  const data = (isRecord(raw) ? raw : {}) as RawStringsBundle;
  const lang = typeof data.lang === 'string' ? data.lang : undefined;

  const appendFlat = (obj?: Record<string, string>) => {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([k, v]) => {
      if (typeof v === 'string') out[k] = skillLevelLabel(v, lang);
    });
  };

  appendFlat(data.strings);
  appendFlat(data.globals);

  if (Array.isArray(data.references)) {
    data.references.forEach((entry) => {
      if (!entry || typeof entry.ref !== 'string' || !entry.ref.trim()) return;
      flattenReferenceStrings(entry.ref, entry.strings, out);
    });
  }

  Object.keys(out).forEach((key) => {
    out[key] = skillLevelLabel(out[key], lang);
  });

  return {
    lang,
    strings: out
  };
};

const normalizeStringsFile = (value?: string | null) => {
  if (!value) return null;
  let file = value;
  if (!file.endsWith('.json')) file = `${file}.json`;
  file = file.replace(/^\//, '');
  file = file.replace(/^data\//, '');
  return `data/${file}`;
};

const flattenClassPresets = (tree?: ClassPresetGroup) => {
  const map: Record<string, string> = {};
  if (!tree) return map;
  const walk = (node: ClassPresetGroup, prefix: string) => {
    Object.entries(node).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') {
        map[path] = value;
        return;
      }
      if (value && typeof value === 'object') {
        walk(value as ClassPresetGroup, path);
      }
    });
  };
  walk(tree, '');
  return map;
};

const normalizeClassPresetTree = (raw: unknown): ClassPresetGroup | undefined => {
  if (!isRecord(raw)) return undefined;
  if (isRecord(raw.classPresets)) return raw.classPresets as ClassPresetGroup;
  return raw as ClassPresetGroup;
};

const getInitialStringsFile = () => {
  const params = new URLSearchParams(window.location.search);
  const paramLang = params.get('lang');
  if (paramLang) return normalizeStringsFile(paramLang);
  return normalizeStringsFile(localStorage.getItem(STORAGE_KEY)) || DEFAULT_STRINGS_FILE;
};

const applyTheme = (config: Config) => {
  if (!config.meta?.theme) return;
  Object.entries(config.meta.theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value);
  });
};

const applyMeta = (
  config: Config,
  strings: StringsBundle | null,
  manifestUrlRef: MutableRefObject<string | null>
) => {
  const head = document.head;
  head.querySelectorAll('[data-json-site-head]').forEach((el) => el.remove());
  const existingStyle = head.querySelector('[data-json-site-style]') as HTMLStyleElement | null;
  if (existingStyle) existingStyle.remove();
  if (manifestUrlRef.current) {
    URL.revokeObjectURL(manifestUrlRef.current);
    manifestUrlRef.current = null;
  }

  const createHeadEl = (tag: 'meta' | 'link', attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    el.setAttribute('data-json-site-head', 'true');
    head.appendChild(el);
  };

  const meta = config.meta;
  const getString = (key?: string, fallback?: string) => {
    if (!key) return fallback;
    return strings?.strings?.[key] ?? fallback;
  };
  const title = getString(meta?.titleKey, meta?.title) || meta?.title || document.title;
  const description = getString(meta?.descriptionKey, meta?.description);

  if (title) {
    document.title = title;
  }
  if (strings?.lang) {
    document.documentElement.lang = strings.lang;
  } else if (meta?.defaultLanguage || meta?.lang) {
    document.documentElement.lang = meta.defaultLanguage || meta.lang || 'en';
  }
  if (description) {
    createHeadEl('meta', { name: 'description', content: description });
  }

  const styles = meta?.styles;
  if (styles) {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-json-site-style', 'true');
    const order = Array.isArray(styles.order) ? styles.order : [];
    const blocks: string[] = [];
    const flattenStyleValue = (value: unknown) => {
      if (typeof value === 'string') {
        if (value.trim()) blocks.push(value.trim());
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(flattenStyleValue);
        return;
      }
      if (value && typeof value === 'object') {
        Object.values(value as Record<string, unknown>).forEach(flattenStyleValue);
      }
    };
    const addBlock = (key: string) => {
      flattenStyleValue(styles[key]);
    };
    order.forEach(addBlock);
    Object.keys(styles)
      .filter((key) => key !== 'order' && !order.includes(key))
      .forEach(addBlock);
    styleEl.textContent = blocks.join('\n');
    head.appendChild(styleEl);
  }

  const pwa = meta?.pwa;
  if (pwa?.themeColor) {
    createHeadEl('meta', { name: 'theme-color', content: pwa.themeColor });
  }
  if (pwa?.enabled) {
    createHeadEl('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    const pwaName = getString(pwa.nameKey, pwa.name);
    if (pwaName) {
      createHeadEl('meta', { name: 'apple-mobile-web-app-title', content: pwaName });
    }
    createHeadEl('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  }

  const favicon = meta?.favicon;
  const guessType = (href: string) => {
    if (href.endsWith('.svg')) return 'image/svg+xml';
    if (href.endsWith('.png')) return 'image/png';
    if (href.endsWith('.jpg') || href.endsWith('.jpeg')) return 'image/jpeg';
    return undefined;
  };

  if (favicon?.icon) {
    const type = guessType(favicon.icon);
    const href = toPublicUrlIfRelative(favicon.icon);
    if (href) {
      createHeadEl('link', { rel: 'icon', href, ...(type ? { type } : {}) });
    }
  }
  if (favicon?.appleTouchIcon) {
    const href = toPublicUrlIfRelative(favicon.appleTouchIcon);
    if (href) {
      createHeadEl('link', { rel: 'apple-touch-icon', href });
    }
  }
  if (favicon?.maskIcon) {
    const href = toPublicUrlIfRelative(favicon.maskIcon);
    if (href) {
      createHeadEl('link', {
        rel: 'mask-icon',
        href,
        ...(favicon.color ? { color: favicon.color } : {})
      });
    }
  }

  if (pwa?.enabled) {
    if (!head.querySelector('link[rel=\"manifest\"]')) {
      createHeadEl('link', { rel: 'manifest', href: toPublicUrl('manifest.webmanifest?v=8') });
    }
  }
};

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [classPresetTree, setClassPresetTree] = useState<ClassPresetGroup | null>(null);
  const [classPresetMap, setClassPresetMap] = useState<Record<string, string>>({});
  const [stringsFile, setStringsFile] = useState(getInitialStringsFile());
  const [strings, setStrings] = useState<StringsBundle | null>(null);
  const [isLangTransition, setIsLangTransition] = useState(false);
  const [sectionNotePositions, setSectionNotePositions] = useState<SectionNotePosition[]>([]);
  const activeSectionRef = useRef<SectionId>('hero');
  const [docViewer, setDocViewer] = useState<{
    url: string;
    title: string;
    downloadName?: string;
    isImage: boolean;
  } | null>(null);
  const langTimer = useRef<number | null>(null);
  const manifestUrlRef = useRef<string | null>(null);
  const stringsFileRef = useRef(stringsFile);

  useEffect(() => {
    stringsFileRef.current = stringsFile;
  }, [stringsFile]);

  useEffect(() => {
    const load = async () => {
      const configUrl = withCacheVersion(toPublicUrl('data/config.json'));
      const res = await fetch(configUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load data/config.json');
      const data = (await res.json()) as Config;
      let classTree = data.meta?.classPresets;
      const classKeysFile = data.meta?.classPresetsFile;
      if (classKeysFile) {
        const classKeysUrl = toPublicUrlIfRelative(classKeysFile) || toPublicUrl(classKeysFile);
        const classRes = await fetch(
          isAbsoluteUrl(classKeysUrl) ? classKeysUrl : withCacheVersion(classKeysUrl),
          { cache: 'no-store' }
        );
        if (!classRes.ok) throw new Error(`Failed to load ${classKeysFile}`);
        const classData = (await classRes.json()) as ClassKeysBundle;
        classTree = normalizeClassPresetTree(classData);
      }
      console.info(`[OnlineCV] page version build ${APP_BUILD_VERSION}`, {
        build: APP_BUILD_VERSION,
        config: configUrl,
        classKeys: classKeysFile
          ? withCacheVersion(toPublicUrlIfRelative(classKeysFile) || toPublicUrl(classKeysFile))
          : 'inline',
        serviceWorker: 'json-site-v49'
      });
      setClassPresetTree(classTree || {});
      setClassPresetMap(flattenClassPresets(classTree));
      setConfig(data);
    };

    load().catch((err) => console.error('[JSON-SITE]', err));
  }, []);

  useEffect(() => {
    if (!stringsFile) return;
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(withCacheVersion(toPublicUrl(stringsFile)), {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`Failed to load ${stringsFile}`);
        const data = normalizeStringsBundle(await res.json());
        if (active) setStrings(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[JSON-SITE]', err);
        }
      } finally {
        if (active) setIsLangTransition(false);
      }
    };

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [stringsFile]);

  useEffect(() => {
    if (!config) return;

    const result = validateConfig(config, classPresetTree || undefined);
    if (result.errors.length) {
      console.error('[JSON-SITE] Config validation errors:', result.errors);
    }
    if (result.warn.length) {
      console.warn('[JSON-SITE] Config validation warnings:', result.warn);
    }

    applyTheme(config);
    applyMeta(config, strings, manifestUrlRef);

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fadeInUp');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

    const skillBars = document.querySelectorAll('[data-skill-bar]');
    skillBars.forEach((bar) => {
      (bar as HTMLElement).style.width = '0%';
    });

    const skillObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const bar = entry.target as HTMLElement;
          const level = bar.getAttribute('data-level');
          const delay = bar.getAttribute('data-delay');
          if (delay) bar.style.transitionDelay = `${delay}ms`;
          if (level) {
            const raw = Number(level);
            const boosted = Number.isFinite(raw) ? Math.min(96, Math.max(0, raw + 8)) : raw;
            bar.style.width = `${boosted}%`;
          }
        });
      },
      { threshold: 0.3 }
    );

    skillBars.forEach((bar) => skillObserver.observe(bar));

    const heroSection = document.getElementById('hero');
    const heroRings = Array.from(document.querySelectorAll('.hero-portrait-ring'));
    let heroRingsPlayedForCurrentVisit = false;
    const heroRingObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting) {
          heroRingsPlayedForCurrentVisit = false;
          heroRings.forEach((ring) => ring.classList.remove('is-entering'));
          return;
        }
        if (heroRingsPlayedForCurrentVisit) return;
        heroRingsPlayedForCurrentVisit = true;
        heroRings.forEach((ring) => ring.classList.remove('is-entering'));
        void (heroRings[0] as HTMLElement | undefined)?.offsetWidth;
        heroRings.forEach((ring) => ring.classList.add('is-entering'));
      },
      { threshold: 0.45 }
    );
    if (heroSection) heroRingObserver.observe(heroSection);

    const heroProfileContactTrigger = document.querySelector(
      '.hero-profile-contact-trigger'
    ) as HTMLElement | null;
    const usePhoneForHeroProfile = () =>
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 767;
    const updateHeroProfileContactLabel = () => {
      if (!heroProfileContactTrigger) return;
      heroProfileContactTrigger.setAttribute(
        'aria-label',
        usePhoneForHeroProfile() ? 'Telefonar para André Câmara' : 'Enviar email a André Câmara'
      );
    };
    const openHeroProfileContact = (event?: Event) => {
      event?.preventDefault();
      const contactLink = document.createElement('a');
      contactLink.href = usePhoneForHeroProfile()
        ? 'tel:+351928308015'
        : 'mailto:eliaspc2@gmail.com';
      contactLink.click();
    };
    const onHeroProfileContactKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      openHeroProfileContact(event);
    };
    if (heroProfileContactTrigger) {
      heroProfileContactTrigger.setAttribute('role', 'button');
      heroProfileContactTrigger.setAttribute('tabindex', '0');
      updateHeroProfileContactLabel();
      heroProfileContactTrigger.addEventListener('click', openHeroProfileContact);
      heroProfileContactTrigger.addEventListener('keydown', onHeroProfileContactKeyDown);
    }

    const syncFooterQuickLinksFromHeader = () => {
      const headerLinks = Array.from(
        document.querySelectorAll('#site-header [data-nav-link]')
      ) as HTMLElement[];
      if (!headerLinks.length) return;

      const seen = new Set<string>();
      const orderedLinks: Array<{ section: string; link: HTMLElement }> = [];
      headerLinks.forEach((link) => {
        const section = (link.getAttribute('data-nav-link') || '').trim();
        if (!section || seen.has(section)) return;
        if (!document.getElementById(section)) return;
        seen.add(section);
        orderedLinks.push({ section, link });
      });
      if (!orderedLinks.length) return;

      const footerQuickAnchors = Array.from(
        document.querySelectorAll('#site-footer a[id^="footer.quick."]')
      ) as HTMLAnchorElement[];
      if (!footerQuickAnchors.length) return;
      const footerList = footerQuickAnchors[0].closest('ul');
      if (!footerList) return;

      const listItemClass =
        (footerQuickAnchors[0].closest('li') as HTMLElement | null)?.className || '';
      const linkClass = footerQuickAnchors[0].className || '';

      footerList.innerHTML = '';
      orderedLinks.forEach(({ section, link }, idx) => {
        const li = document.createElement('li');
        if (listItemClass) li.className = listItemClass;

        const anchor = document.createElement('a');
        anchor.id = `footer.quick.nav.${section || idx}`;
        if (linkClass) anchor.className = linkClass;

        const href = link.getAttribute('href') || `#${section}`;
        anchor.setAttribute('href', href);
        anchor.setAttribute('data-scroll-to', section);
        anchor.textContent = (link.textContent || '').trim();

        li.appendChild(anchor);
        footerList.appendChild(li);
      });
    };

    syncFooterQuickLinksFromHeader();
    const sections: SectionId[] = ['hero', 'about', 'experience', 'skills', 'mindset', 'summary', 'now', 'contact'];

    const updateScrollNotePositions = () => {
      const next = sections.flatMap((section) => {
        const element = document.getElementById(section);
        if (!element) return [];
        const rect = element.getBoundingClientRect();
        const sectionTop = rect.top + window.scrollY;
        const viewportAnchor = window.innerHeight * 0.55;
        const sectionAnchor = rect.height * 0.48;
        return [{ section, top: Math.round(sectionTop + Math.min(viewportAnchor, sectionAnchor)) }];
      });
      setSectionNotePositions(next);
    };
    let noteParallaxFrame = 0;
    const updateScrollNoteParallax = () => {
      if (noteParallaxFrame) return;
      noteParallaxFrame = window.requestAnimationFrame(() => {
        noteParallaxFrame = 0;
        const viewportCenter = window.innerHeight / 2;
        const visibilityRange = window.innerHeight * 0.336;
        const steadyRange = window.innerHeight * 0.14;
        const fadeRange = visibilityRange - steadyRange;
        document.querySelectorAll('.scroll-note-cluster').forEach((cluster) => {
          const rect = cluster.getBoundingClientRect();
          const distanceFromFocus = Math.abs(viewportCenter - rect.top);
          const drift = Math.max(-72, Math.min(72, (viewportCenter - rect.top) * 0.16));
          const fadeDistance = Math.max(0, distanceFromFocus - steadyRange);
          const opacity = Math.max(0, Math.min(1, 1 - fadeDistance / fadeRange));
          const clusterElement = cluster as HTMLElement;
          clusterElement.style.setProperty('--note-parallax', `${Math.round(drift)}px`);
          clusterElement.style.setProperty('--note-opacity', opacity.toFixed(3));
          clusterElement.classList.toggle('is-note-visible', opacity > 0.02);
        });
      });
    };

    const footerElement = document.getElementById('site-footer');
    let footerDockMode: 'auto' | 'manual-open' | 'manual-closed' = 'auto';
    let manualFooterDockScrollY = 0;
    let footerDockPinnedDuringNavigation = false;
    let footerDockNavigationTimer: number | undefined;
    const canExpandFooterDock = () => !window.matchMedia('(max-width: 480px)').matches;
    const updateFooterDockState = () => {
      if (!footerElement) return;
      if (!canExpandFooterDock()) {
        footerDockPinnedDuringNavigation = false;
        footerDockMode = 'manual-closed';
        document.body.classList.remove('footer-dock-expanded');
        return;
      }
      if (footerDockPinnedDuringNavigation) {
        document.body.classList.add('footer-dock-expanded');
        return;
      }
      if (footerDockMode === 'manual-closed') {
        const moved = Math.abs(window.scrollY - manualFooterDockScrollY);
        if (moved < 120) {
          document.body.classList.remove('footer-dock-expanded');
          return;
        }
        footerDockMode = 'auto';
      }
      const scrollRoot = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(1, scrollRoot.scrollHeight - window.innerHeight);
      const remaining = maxScroll - window.scrollY;
      const isExpanded = document.body.classList.contains('footer-dock-expanded');
      const shouldExpand = isExpanded ? remaining < 500 : remaining < 80;
      document.body.classList.toggle('footer-dock-expanded', shouldExpand);
      if (footerDockMode === 'manual-open') {
        const moved = Math.abs(window.scrollY - manualFooterDockScrollY);
        if (moved < 120) {
          document.body.classList.add('footer-dock-expanded');
          return;
        }
        footerDockMode = 'auto';
      }
    };
    const footerBrand = footerElement?.querySelector(
      '.grid > :first-child > div:first-child'
    ) as HTMLElement | null;
    const toggleFooterDock = (event?: Event) => {
      event?.preventDefault();
      footerDockPinnedDuringNavigation = false;
      if (footerDockNavigationTimer) {
        window.clearTimeout(footerDockNavigationTimer);
        footerDockNavigationTimer = undefined;
      }
      if (document.body.classList.contains('footer-dock-expanded')) {
        footerDockMode = 'manual-closed';
        manualFooterDockScrollY = window.scrollY;
        document.body.classList.remove('footer-dock-expanded');
        return;
      }
      footerDockMode = 'manual-open';
      manualFooterDockScrollY = window.scrollY;
      document.body.classList.add('footer-dock-expanded');
    };
    const goToPageStart = (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      const keepDockOpen = document.body.classList.contains('footer-dock-expanded');
      footerDockPinnedDuringNavigation = keepDockOpen;
      footerDockMode = keepDockOpen ? 'manual-open' : 'manual-closed';
      manualFooterDockScrollY = window.scrollY;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (footerDockNavigationTimer) window.clearTimeout(footerDockNavigationTimer);
      footerDockNavigationTimer = window.setTimeout(() => {
        footerDockPinnedDuringNavigation = false;
        footerDockNavigationTimer = undefined;
        footerDockMode = keepDockOpen ? 'manual-open' : 'manual-closed';
        manualFooterDockScrollY = window.scrollY;
        document.body.classList.toggle('footer-dock-expanded', keepDockOpen);
      }, 1000);
    };
    const onFooterBrandKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      goToPageStart(event);
    };
    const onFooterBackgroundClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || footerBrand?.contains(target)) return;
      if (target.closest('a, button, input, select, textarea, [role="button"]')) return;
      if (!canExpandFooterDock()) return;
      toggleFooterDock(event);
    };
    if (footerBrand) {
      footerBrand.setAttribute('role', 'button');
      footerBrand.setAttribute('tabindex', '0');
      footerBrand.setAttribute('aria-label', 'Ir para o início');
      footerBrand.addEventListener('click', goToPageStart);
      footerBrand.addEventListener('keydown', onFooterBrandKeyDown);
    }
    footerElement?.addEventListener('click', onFooterBackgroundClick);

    const handleScroll = () => {
      for (const section of sections) {
        const element = document.getElementById(section);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= 200 && rect.bottom >= 200) {
          if (activeSectionRef.current !== section) {
            activeSectionRef.current = section;
          }
          document.querySelectorAll('[data-nav-link]').forEach((link) => {
            const el = link as HTMLElement;
            const base = el.getAttribute('data-base-class') || '';
            const active = el.getAttribute('data-active-class') || '';
            const isActive = el.getAttribute('data-nav-link') === section;
            el.className = `${base}${isActive ? ` ${active}` : ''}`.trim();
          });
          break;
        }
      }
      updateScrollNoteParallax();
      updateFooterDockState();
    };
    const handleResize = () => {
      updateScrollNotePositions();
      updateScrollNoteParallax();
      updateFooterDockState();
      updateHeroProfileContactLabel();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.setTimeout(updateScrollNotePositions, 0);
    window.setTimeout(() => {
      updateScrollNotePositions();
      updateScrollNoteParallax();
      updateFooterDockState();
    }, 600);
    const footerDockInterval = window.setInterval(updateFooterDockState, 120);
    handleScroll();
    updateFooterDockState();
    updateScrollNotePositions();
    updateScrollNoteParallax();

    const scrollButtons = document.querySelectorAll('[data-scroll-to]');
    const mobileMenu = document.querySelector('[data-mobile-menu]') as HTMLElement | null;
    const mobilePanel = document.querySelector('[data-mobile-panel]') as HTMLElement | null;
    const mobileBackdrop = document.querySelector('[data-mobile-backdrop]') as HTMLElement | null;
    const menuToggle = document.querySelector('[data-menu-toggle]') as HTMLElement | null;
    const iconOpen = document.querySelector('[data-icon-open]') as HTMLElement | null;
    const iconClose = document.querySelector('[data-icon-close]') as HTMLElement | null;
    let menuOpen = false;

    const setMenuState = (open: boolean) => {
      menuOpen = open;
      if (!mobileMenu || !mobilePanel) return;
      if (open) {
        mobileMenu.classList.remove('opacity-0', 'invisible');
        mobileMenu.classList.add('opacity-100', 'visible');
        mobilePanel.classList.remove('-translate-y-4', 'opacity-0');
        mobilePanel.classList.add('translate-y-0', 'opacity-100');
        if (iconOpen) iconOpen.classList.add('hidden');
        if (iconClose) iconClose.classList.remove('hidden');
      } else {
        mobileMenu.classList.add('opacity-0', 'invisible');
        mobileMenu.classList.remove('opacity-100', 'visible');
        mobilePanel.classList.add('-translate-y-4', 'opacity-0');
        mobilePanel.classList.remove('translate-y-0', 'opacity-100');
        if (iconOpen) iconOpen.classList.remove('hidden');
        if (iconClose) iconClose.classList.add('hidden');
      }
    };

    const onMenuToggleClick = () => setMenuState(!menuOpen);
    const onMobileBackdropClick = () => setMenuState(false);

    if (menuToggle) {
      menuToggle.addEventListener('click', onMenuToggleClick);
    }
    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', onMobileBackdropClick);
    }
    const scrollButtonHandlers = new Map<Element, EventListener>();
    scrollButtons.forEach((btn) => {
      const onScrollButtonClick = (event: Event) => {
        event.preventDefault();
        const target = (btn as HTMLElement).getAttribute('data-scroll-to');
        if (!target) return;
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
        setMenuState(false);
      };
      scrollButtonHandlers.set(btn, onScrollButtonClick);
      btn.addEventListener('click', onScrollButtonClick);
    });

    const accordionToggles = document.querySelectorAll('[data-accordion-toggle]');
    const setAccordionState = (panelId: string, open: boolean) => {
      const panel = document.querySelector(`[data-accordion-panel=\"${panelId}\"]`) as HTMLElement | null;
      const downIcon = document.querySelector(`[data-accordion-icon=\"down\"][data-accordion-for=\"${panelId}\"]`) as HTMLElement | null;
      const upIcon = document.querySelector(`[data-accordion-icon=\"up\"][data-accordion-for=\"${panelId}\"]`) as HTMLElement | null;
      if (!panel) return;
      const maxClass = panel.getAttribute('data-accordion-max') || 'max-h-40';
      if (open) {
        panel.classList.remove('max-h-0', 'opacity-0');
        panel.classList.add(maxClass, 'opacity-100');
        if (downIcon) downIcon.classList.add('hidden');
        if (upIcon) upIcon.classList.remove('hidden');
      } else {
        panel.classList.add('max-h-0', 'opacity-0');
        panel.classList.remove(maxClass, 'opacity-100');
        if (downIcon) downIcon.classList.remove('hidden');
        if (upIcon) upIcon.classList.add('hidden');
      }
    };

    document.querySelectorAll('[data-accordion-group="skills-categories"]').forEach((item) => {
      const id = item.getAttribute('data-accordion-item');
      if (id) setAccordionState(id, id === 'skills-cat-2');
    });

    const toggleAccordionById = (panelId: string, contextEl?: HTMLElement) => {
      const item = (contextEl?.closest('[data-accordion-item]') as HTMLElement | null) || null;
      const group = item?.getAttribute('data-accordion-group');
      const panel = document.querySelector(`[data-accordion-panel=\"${panelId}\"]`) as HTMLElement | null;
      if (!panel) return;
      const isOpen = !panel.classList.contains('max-h-0');
      if (group) {
        document.querySelectorAll(`[data-accordion-group=\"${group}\"]`).forEach((el) => {
          const id = (el as HTMLElement).getAttribute('data-accordion-item');
          if (id) setAccordionState(id, false);
        });
      }
      setAccordionState(panelId, !isOpen);
    };

    const accordionToggleHandlers = new Map<Element, EventListener>();
    accordionToggles.forEach((toggle) => {
      const onAccordionToggleClick = () => {
        const panelId = (toggle as HTMLElement).getAttribute('data-accordion-toggle');
        if (!panelId) return;
        toggleAccordionById(panelId, toggle as HTMLElement);
      };
      accordionToggleHandlers.set(toggle, onAccordionToggleClick);
      toggle.addEventListener('click', onAccordionToggleClick);
    });

    const clickAnywhereAccordionItems = document.querySelectorAll('[data-accordion-item][data-accordion-click-anywhere=\"true\"]');
    const clickAnywhereAccordionHandlers = new Map<Element, EventListener>();
    clickAnywhereAccordionItems.forEach((item) => {
      const onClickAnywhereAccordionClick = (event: Event) => {
        const target = event.target as HTMLElement;
        if (!target) return;
        if (target.closest('[data-accordion-toggle]')) return;
        if (target.closest('[data-accordion-panel]')) return;
        if (target.closest('a,button,input,textarea,select,label')) return;
        const panelId = (item as HTMLElement).getAttribute('data-accordion-item');
        if (!panelId) return;
        toggleAccordionById(panelId, item as HTMLElement);
      };
      clickAnywhereAccordionHandlers.set(item, onClickAnywhereAccordionClick);
      item.addEventListener('click', onClickAnywhereAccordionClick);
    });

    const tabTriggers = document.querySelectorAll('[data-tab-trigger]');
    const setTabActive = (group: string, target: string) => {
      document.querySelectorAll(`[data-tab-trigger][data-tab-group=\"${group}\"]`).forEach((trigger) => {
        const el = trigger as HTMLElement;
        const id = el.getAttribute('data-tab-trigger');
        const isActive = id === target;
        const activeClass = el.getAttribute('data-active-class') || '';
        const inactiveClass = el.getAttribute('data-inactive-class') || '';
        el.className = `${isActive ? activeClass : inactiveClass}`.trim();
        el.querySelectorAll('[data-active-class]').forEach((child) => {
          const c = child as HTMLElement;
          const active = c.getAttribute('data-active-class') || '';
          const inactive = c.getAttribute('data-inactive-class') || '';
          c.className = `${isActive ? active : inactive}`.trim();
        });
      });
      document.querySelectorAll(`[data-tab-panel][data-tab-group=\"${group}\"]`).forEach((panel) => {
        const el = panel as HTMLElement;
        const id = el.getAttribute('data-tab-panel');
        el.classList.toggle('hidden', id !== target);
      });
    };

    const tabTriggerHandlers = new Map<Element, EventListener>();
    tabTriggers.forEach((trigger) => {
      const group = (trigger as HTMLElement).getAttribute('data-tab-group');
      const target = (trigger as HTMLElement).getAttribute('data-tab-trigger');
      if (!group || !target) return;
      const onTabTriggerClick = () => setTabActive(group, target);
      tabTriggerHandlers.set(trigger, onTabTriggerClick);
      trigger.addEventListener('click', onTabTriggerClick);
    });

    const tabGroups = new Set<string>();
    tabTriggers.forEach((trigger) => {
      const group = (trigger as HTMLElement).getAttribute('data-tab-group');
      if (group) tabGroups.add(group);
    });
    tabGroups.forEach((group) => {
      const defaultTrigger = document.querySelector(`[data-tab-trigger][data-tab-group=\"${group}\"][data-tab-default=\"true\"]`) as HTMLElement | null;
      const firstTrigger = document.querySelector(`[data-tab-trigger][data-tab-group=\"${group}\"]`) as HTMLElement | null;
      const target = defaultTrigger?.getAttribute('data-tab-trigger') || firstTrigger?.getAttribute('data-tab-trigger');
      if (target) setTabActive(group, target);
    });

    const langButtons = document.querySelectorAll('[data-lang-file]');
    const onLangClick = (evt: Event) => {
      const file = (evt.currentTarget as HTMLElement).getAttribute('data-lang-file');
      if (!file) return;
      const normalized = normalizeStringsFile(file) || DEFAULT_STRINGS_FILE;
      if (normalized === stringsFileRef.current) {
        return;
      }
      if (langTimer.current) window.clearTimeout(langTimer.current);
      setIsLangTransition(true);
      langTimer.current = window.setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, normalized);
        setStringsFile(normalized);
      }, 180);
    };
    langButtons.forEach((btn) => btn.addEventListener('click', onLangClick));

    const copyButtons = document.querySelectorAll('[data-copy-value]');
    const copyTimeouts = new Map<Element, number>();
    const onCopyClick = async (evt: Event) => {
      const button = evt.currentTarget as HTMLElement;
      const value = button.getAttribute('data-copy-value');
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
      } catch (err) {
        console.warn('[JSON-SITE] Clipboard write failed', err);
      }
      const copyIcon = button.querySelector('[data-copy-icon=\"copy\"]') as HTMLElement | null;
      const checkIcon = button.querySelector('[data-copy-icon=\"check\"]') as HTMLElement | null;
      if (copyIcon) copyIcon.classList.add('hidden');
      if (checkIcon) checkIcon.classList.remove('hidden');
      const existing = copyTimeouts.get(button);
      if (existing) window.clearTimeout(existing);
      const timeout = window.setTimeout(() => {
        if (copyIcon) copyIcon.classList.remove('hidden');
        if (checkIcon) checkIcon.classList.add('hidden');
        copyTimeouts.delete(button);
      }, 2000);
      copyTimeouts.set(button, timeout);
    };
    copyButtons.forEach((btn) => btn.addEventListener('click', onCopyClick));

    const docLinks = document.querySelectorAll('a[download], a[data-open-inline]');
    const onDocClick = (evt: Event) => {
      const link = evt.currentTarget as HTMLAnchorElement;
      const href = link.getAttribute('href');
      if (!href) return;
      const resolved = toPublicUrlIfRelative(href) || href;
      const shouldOpenInline = parseBooleanAttr(
        link,
        'data-open-inline',
        link.hasAttribute('download')
      );
      if (!shouldOpenInline) {
        evt.preventDefault();
        const target = link.getAttribute('target') || '_blank';
        if (target === '_self') {
          window.location.href = resolved;
          return;
        }
        window.open(resolved, target, 'noopener,noreferrer');
        return;
      }
      evt.preventDefault();
      const title =
        link.getAttribute('data-doc-title') ||
        link.textContent?.trim() ||
        strings?.strings?.['ui.viewer.title'] ||
        'Documento';
      const downloadName = link.getAttribute('download') || undefined;
      const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(href);
      setDocViewer({ url: resolved, title, downloadName, isImage });
    };
    docLinks.forEach((link) => link.addEventListener('click', onDocClick));

    if (config.meta?.pwa?.enabled && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(toPublicUrl('sw.js'), { scope: import.meta.env.BASE_URL })
        .then((registration) => registration.update())
        .catch((err) => {
        console.warn('[JSON-SITE] Service worker registration failed', err);
      });
    }

    return () => {
      revealObserver.disconnect();
      skillObserver.disconnect();
      heroRingObserver.disconnect();
      if (heroProfileContactTrigger) {
        heroProfileContactTrigger.removeEventListener('click', openHeroProfileContact);
        heroProfileContactTrigger.removeEventListener('keydown', onHeroProfileContactKeyDown);
      }
      window.clearInterval(footerDockInterval);
      if (footerDockNavigationTimer) window.clearTimeout(footerDockNavigationTimer);
      if (footerBrand) {
        footerBrand.removeEventListener('click', goToPageStart);
        footerBrand.removeEventListener('keydown', onFooterBrandKeyDown);
      }
      footerElement?.removeEventListener('click', onFooterBackgroundClick);
      document.body.classList.remove('footer-dock-expanded');
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (noteParallaxFrame) window.cancelAnimationFrame(noteParallaxFrame);
      langButtons.forEach((btn) => btn.removeEventListener('click', onLangClick));
      copyButtons.forEach((btn) => btn.removeEventListener('click', onCopyClick));
      if (menuToggle) {
        menuToggle.removeEventListener('click', onMenuToggleClick);
      }
      if (mobileBackdrop) {
        mobileBackdrop.removeEventListener('click', onMobileBackdropClick);
      }
      scrollButtons.forEach((btn) => {
        const handler = scrollButtonHandlers.get(btn);
        if (handler) btn.removeEventListener('click', handler);
      });
      accordionToggles.forEach((toggle) => {
        const handler = accordionToggleHandlers.get(toggle);
        if (handler) toggle.removeEventListener('click', handler);
      });
      clickAnywhereAccordionItems.forEach((item) => {
        const handler = clickAnywhereAccordionHandlers.get(item);
        if (handler) item.removeEventListener('click', handler);
      });
      tabTriggers.forEach((trigger) => {
        const handler = tabTriggerHandlers.get(trigger);
        if (handler) trigger.removeEventListener('click', handler);
      });
      if (langTimer.current) window.clearTimeout(langTimer.current);
      copyTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      docLinks.forEach((link) => link.removeEventListener('click', onDocClick));
    };
  }, [config, strings, classPresetTree]);

  useEffect(() => {
    if (!docViewer) return;
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setDocViewer(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [docViewer]);

  if (!config || !strings || classPresetTree === null) return null;
  const getUiString = (key: string, fallback: string) =>
    strings.strings?.[key] ?? fallback;
  const classPresets = classPresetMap;
  const objects = config.objects || {};
  const getNodeKey = (node: { id?: string; ref?: string }, fallback: string | number) =>
    node.id || node.ref || fallback;

  return (
    <div className={`lang-fade ${isLangTransition ? 'is-fading' : ''} min-h-screen bg-[#fcfcfd] text-[#0f172a]`}>
      <header id="site-header">
        {(config.layout?.header || []).map((node, idx) =>
          renderNode(node, getNodeKey(node, `header-${idx}`), strings.strings, classPresets, objects)
        )}
      </header>
      <main id="main">
        {(config.pages || []).map((page, pIdx) =>
          (page.sections || []).map((section, sIdx) =>
            (section.nodes || []).map((node, nIdx) =>
              renderNode(
                node,
                getNodeKey(node, `${pIdx}-${sIdx}-${nIdx}`),
                strings.strings,
                classPresets,
                objects
              )
            )
          )
        )}
      </main>
      <ScrollNotes positions={sectionNotePositions} strings={strings.strings} />
      <footer id="site-footer">
        {(config.layout?.footer || []).map((node, idx) =>
          renderNode(node, getNodeKey(node, `footer-${idx}`), strings.strings, classPresets, objects)
        )}
        <nav className="footer-doc-links" aria-label="Documentos profissionais">
          {FOOTER_DOCUMENT_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              download={link.download}
              data-open-inline="true"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </footer>
      <div className="floating">
        {(config.layout?.floating || []).map((node, idx) =>
          renderNode(node, getNodeKey(node, `floating-${idx}`), strings.strings, classPresets, objects)
        )}
      </div>
      {docViewer && (
        <div className="doc-viewer-root">
          <button
            type="button"
            aria-label={getUiString('ui.viewer.close', 'Close')}
            className="doc-viewer-backdrop"
            onClick={() => setDocViewer(null)}
          />
          <div className="doc-viewer-dialog">
            <div className="doc-viewer-header">
              <div className="text-sm font-semibold text-[#0f172a]">
                {docViewer.title}
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
                  href={docViewer.url}
                  download={docViewer.downloadName}
                >
                  {getUiString('ui.viewer.download', 'Download')}
                </a>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0] transition-colors"
                  onClick={() => setDocViewer(null)}
                >
                  {getUiString('ui.viewer.close', 'Close')}
                </button>
              </div>
            </div>
            <div className="doc-viewer-content">
              {docViewer.isImage ? (
                <img
                  src={docViewer.url}
                  alt={docViewer.title}
                  className="doc-viewer-media"
                />
              ) : (
                <iframe
                  title={docViewer.title}
                  src={docViewer.url}
                  className="doc-viewer-frame"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
