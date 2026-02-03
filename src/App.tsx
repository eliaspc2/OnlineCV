import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { renderNode } from './renderer';
import { validateConfig, type Config } from './validator';

const STORAGE_KEY = 'json-site-lang';
const DEFAULT_STRINGS_FILE = '/data/uk-en.json';

type StringsBundle = {
  lang?: string;
  strings: Record<string, string>;
};

const normalizeStringsFile = (value?: string | null) => {
  if (!value) return null;
  let file = value;
  if (!file.endsWith('.json')) file = `${file}.json`;
  file = file.replace(/^\//, '');
  file = file.replace(/^data\//, '');
  return `/data/${file}`;
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
    createHeadEl('link', { rel: 'icon', href: `/${favicon.icon}`, ...(type ? { type } : {}) });
  }
  if (favicon?.appleTouchIcon) {
    createHeadEl('link', { rel: 'apple-touch-icon', href: `/${favicon.appleTouchIcon}` });
  }
  if (favicon?.maskIcon) {
    createHeadEl('link', {
      rel: 'mask-icon',
      href: `/${favicon.maskIcon}`,
      ...(favicon.color ? { color: favicon.color } : {})
    });
  }

  if (pwa?.enabled) {
    const pwaName = getString(pwa.nameKey, pwa.name);
    const pwaShort = getString(pwa.shortNameKey, pwa.shortName);
    const pwaDesc = getString(pwa.descriptionKey, pwa.description);
    const manifest = {
      name: pwaName || meta?.title || 'JSON Site',
      short_name: pwaShort || meta?.title || 'JSON Site',
      description: pwaDesc || description || meta?.description,
      start_url: pwa.startUrl || './',
      scope: pwa.scope || './',
      display: pwa.display || 'standalone',
      orientation: pwa.orientation,
      theme_color: pwa.themeColor,
      background_color: pwa.backgroundColor,
      icons: (pwa.icons || []).map((icon) => ({
        src: icon.src?.startsWith('assets/') ? `/${icon.src}` : icon.src,
        sizes: icon.sizes || 'any',
        type: icon.type,
        purpose: icon.purpose
      }))
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);
    manifestUrlRef.current = url;
    createHeadEl('link', { rel: 'manifest', href: url });
  }
};

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [stringsFile, setStringsFile] = useState(getInitialStringsFile());
  const [strings, setStrings] = useState<StringsBundle | null>(null);
  const [isLangTransition, setIsLangTransition] = useState(false);
  const langTimer = useRef<number | null>(null);
  const manifestUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/data/config.json');
      if (!res.ok) throw new Error('Failed to load data/config.json');
      const data = (await res.json()) as Config;
      setConfig(data);
    };

    load().catch((err) => console.error('[JSON-SITE]', err));
  }, []);

  useEffect(() => {
    if (!stringsFile) return;
    const load = async () => {
      const res = await fetch(stringsFile.startsWith('/') ? stringsFile : `/${stringsFile}`);
      if (!res.ok) throw new Error(`Failed to load ${stringsFile}`);
      const data = (await res.json()) as StringsBundle;
      setStrings(data);
    };

    load().catch((err) => console.error('[JSON-SITE]', err));
  }, [stringsFile]);

  useEffect(() => {
    if (!config) return;

    const result = validateConfig(config);
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
          if (level) bar.style.width = `${level}%`;
        });
      },
      { threshold: 0.3 }
    );

    skillBars.forEach((bar) => skillObserver.observe(bar));

    const handleScroll = () => {
      const sections = ['hero', 'about', 'experience', 'skills', 'mindset', 'now', 'contact'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= 200 && rect.bottom >= 200) {
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
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

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

    if (menuToggle) {
      menuToggle.addEventListener('click', () => setMenuState(!menuOpen));
    }
    if (mobileBackdrop) {
      mobileBackdrop.addEventListener('click', () => setMenuState(false));
    }
    scrollButtons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const target = (btn as HTMLElement).getAttribute('data-scroll-to');
        if (!target) return;
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
        setMenuState(false);
      });
    });

    const scrollTopButtons = document.querySelectorAll('[data-scroll-top]');
    scrollTopButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
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

    accordionToggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const panelId = (toggle as HTMLElement).getAttribute('data-accordion-toggle');
        if (!panelId) return;
        const item = (toggle as HTMLElement).closest('[data-accordion-item]') as HTMLElement | null;
        const group = item?.getAttribute('data-accordion-group');
        const panel = document.querySelector(`[data-accordion-panel=\"${panelId}\"]`) as HTMLElement | null;
        if (!panel) return;
        const isOpen = panel.classList.contains('max-h-40');
        if (group) {
          document.querySelectorAll(`[data-accordion-group=\"${group}\"]`).forEach((el) => {
            const id = (el as HTMLElement).getAttribute('data-accordion-item');
            if (id) setAccordionState(id, false);
          });
        }
        setAccordionState(panelId, !isOpen);
      });
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

    tabTriggers.forEach((trigger) => {
      const group = (trigger as HTMLElement).getAttribute('data-tab-group');
      const target = (trigger as HTMLElement).getAttribute('data-tab-trigger');
      if (!group || !target) return;
      trigger.addEventListener('click', () => setTabActive(group, target));
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
      if (langTimer.current) window.clearTimeout(langTimer.current);
      setIsLangTransition(true);
      langTimer.current = window.setTimeout(() => {
        const normalized = normalizeStringsFile(file) || DEFAULT_STRINGS_FILE;
        localStorage.setItem(STORAGE_KEY, normalized);
        setStringsFile(normalized);
      }, 180);
    };
    langButtons.forEach((btn) => btn.addEventListener('click', onLangClick));

    const brandIcon = document.querySelector('[data-brand-button]');
    let clicks = 0;
    let timer: number | null = null;
    const clickIndicator = document.querySelector('[data-brand-count]') as HTMLElement | null;
    const brandBox = document.querySelector('[data-brand-box]') as HTMLElement | null;
    const adminOverlay = document.querySelector('[data-admin-overlay]') as HTMLElement | null;

    const onBrandClick = () => {
      clicks += 1;
      if (timer) window.clearTimeout(timer);
      if (clicks >= 3) {
        clicks = 0;
        if (clickIndicator) clickIndicator.classList.add('hidden');
        if (adminOverlay) adminOverlay.classList.remove('hidden');
        setTimeout(() => {
          window.location.href = '/editor.html';
        }, 500);
        return;
      }
      if (clickIndicator) {
        clickIndicator.textContent = String(clicks);
        clickIndicator.classList.remove('hidden');
        clickIndicator.classList.add('flex');
      }
      if (brandBox) {
        brandBox.classList.add('bg-blue-600', 'scale-110');
        brandBox.classList.remove('bg-[#3b82f6]/10');
      }
      timer = window.setTimeout(() => {
        clicks = 0;
        if (clickIndicator) clickIndicator.classList.add('hidden');
        if (brandBox) {
          brandBox.classList.remove('bg-blue-600', 'scale-110');
          brandBox.classList.add('bg-[#3b82f6]/10');
        }
      }, 700);
    };

    if (brandIcon) brandIcon.addEventListener('click', onBrandClick);

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

    if (config.meta?.pwa?.enabled && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[JSON-SITE] Service worker registration failed', err);
      });
    }

    return () => {
      revealObserver.disconnect();
      skillObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
      langButtons.forEach((btn) => btn.removeEventListener('click', onLangClick));
      copyButtons.forEach((btn) => btn.removeEventListener('click', onCopyClick));
      if (menuToggle) {
        menuToggle.removeEventListener('click', () => undefined);
      }
      if (mobileBackdrop) {
        mobileBackdrop.removeEventListener('click', () => undefined);
      }
      scrollButtons.forEach((btn) => {
        btn.removeEventListener('click', () => undefined);
      });
      scrollTopButtons.forEach((btn) => {
        btn.removeEventListener('click', () => undefined);
      });
      if (brandIcon) brandIcon.removeEventListener('click', onBrandClick);
      if (timer) window.clearTimeout(timer);
      copyTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [config, strings]);

  useEffect(() => {
    if (!config) return;
    if (langTimer.current) window.clearTimeout(langTimer.current);
    langTimer.current = window.setTimeout(() => {
      setIsLangTransition(false);
    }, 200);
  }, [config]);

  if (!config || !strings) return null;

  return (
    <div className={`lang-fade ${isLangTransition ? 'is-fading' : ''} min-h-screen bg-[#fcfcfd] text-[#0f172a]`}>
      <header id="site-header">
        {(config.layout?.header || []).map((node, idx) => renderNode(node, idx, strings.strings))}
      </header>
      <main id="main">
        {(config.pages || []).map((page, pIdx) =>
          (page.sections || []).map((section, sIdx) =>
            (section.nodes || []).map((node, nIdx) =>
              renderNode(node, `${pIdx}-${sIdx}-${nIdx}`, strings.strings)
            )
          )
        )}
      </main>
      <footer id="site-footer">
        {(config.layout?.footer || []).map((node, idx) => renderNode(node, idx, strings.strings))}
      </footer>
      <div className="floating">
        {(config.layout?.floating || []).map((node, idx) =>
          renderNode(node, idx, strings.strings)
        )}
      </div>
    </div>
  );
}
