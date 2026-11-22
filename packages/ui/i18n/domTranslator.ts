/**
 * Arabic translation layer for the Plannotator chrome.
 *
 * The UI is a large React tree whose strings are written inline in English.
 * Rather than threading a `t()` call through thousands of call sites, this
 * layer watches the DOM and swaps whole English strings (text nodes and the
 * `title` / `aria-label` / `placeholder` attributes) for their Arabic entry in
 * the dictionary. Only exact, whole-string matches are translated, so
 * sentences we have no entry for stay in English instead of being half
 * translated.
 *
 * React stays the owner of every node: we only rewrite `nodeValue` or an
 * attribute in place. When React later writes a new English value, the
 * observer sees it, records it as the new original and translates it again.
 * Switching back to English restores every original.
 *
 * Never translated: the text of the document being reviewed, code, diffs,
 * editors, terminals and anything under `[data-no-i18n]`. Inside the
 * document card only the interface parts are translated: badges, actions,
 * question cards and anything else the UI marks as not part of the text
 * (`data-print-hide`, `annotation-exclude`, `data-pinpoint-ignore`,
 * `data-doc-chrome`).
 */
import { AR, AR_PATTERNS, AR_CONTEXT } from './ar';
import { getLocale, subscribeLocale, applyDocumentLocale, refreshLocaleFromStorage, type Locale } from './locale';

const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'] as const;

const DOC_ROOT = '[data-doc-text-root]';
const DOC_CHROME = [
  '[data-doc-chrome]',
  '[data-print-hide]',
  '.annotation-exclude',
  '[data-pinpoint-ignore]',
  '[data-question-key]',
].join(',');

const SKIP_SELECTOR = [
  '[data-no-i18n]',
  'pre',
  'code',
  'kbd',
  'textarea',
  'script',
  'style',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '.xterm',
  '.webtui-shell',
  '.cm-editor',
  '.monaco-editor',
  '.katex',
  'svg text',
].join(',');

type TextRecord = { orig: string; tr: string };
const textRecords = new WeakMap<Text, TextRecord>();
const attrRecords = new WeakMap<Element, Map<string, TextRecord>>();

let observer: MutationObserver | null = null;
let started = false;

function lookup(raw: string, el?: Element | null): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 160) return null;
  // Fast reject: nothing to translate in strings without Latin letters.
  if (!/[A-Za-z]/.test(trimmed)) return null;
  let hit: string | undefined;
  // The same English word can need different Arabic by place ("Open" is a
  // verb on a button, an adjective on a question's status tag).
  if (el) {
    for (const [selector, dict] of AR_CONTEXT) {
      if (dict[trimmed] !== undefined && safeClosest(el, selector)) {
        hit = dict[trimmed];
        break;
      }
    }
  }
  if (hit === undefined) hit = AR[trimmed];
  if (hit === undefined) {
    // Labels often end in an ellipsis or colon that the dictionary omits.
    const m = /^(.*?)(\s*(?:\.\.\.|…|:))$/.exec(trimmed);
    if (m && AR[m[1]] !== undefined) hit = AR[m[1]] + m[2].trim().replace('...', '…');
  }
  if (hit === undefined) {
    for (const [re, fn] of AR_PATTERNS) {
      const m = re.exec(trimmed);
      if (m) {
        hit = fn(m);
        break;
      }
    }
  }
  if (hit === undefined) return null;
  // Keep the surrounding whitespace React put around the words.
  const lead = raw.slice(0, raw.length - raw.trimStart().length);
  const trail = raw.slice(raw.trimEnd().length);
  return lead + hit + trail;
}

function safeClosest(el: Element, selector: string): Element | null {
  try {
    return el.closest(selector);
  } catch {
    return null;
  }
}

function isSkipped(el: Element | null): boolean {
  if (!el) return true;
  if (safeClosest(el, SKIP_SELECTOR)) return true;
  const root = safeClosest(el, DOC_ROOT);
  if (!root) return false;
  // Inside the document card: only interface parts are translated.
  const chrome = safeClosest(el, DOC_CHROME);
  return !(chrome && root.contains(chrome));
}

function translateText(node: Text): void {
  const value = node.nodeValue ?? '';
  const rec = textRecords.get(node);
  if (rec && value === rec.tr) return; // our own write
  if (isSkipped(node.parentElement)) return;
  const tr = lookup(value, node.parentElement);
  if (tr === null) {
    if (rec) textRecords.delete(node);
    return;
  }
  textRecords.set(node, { orig: value, tr });
  node.nodeValue = tr;
}

function translateAttr(el: Element, name: string): void {
  const value = el.getAttribute(name);
  if (value === null) return;
  let map = attrRecords.get(el);
  const rec = map?.get(name);
  if (rec && value === rec.tr) return;
  if (isSkipped(el)) return;
  const tr = lookup(value, el);
  if (tr === null) {
    map?.delete(name);
    return;
  }
  if (!map) {
    map = new Map();
    attrRecords.set(el, map);
  }
  map.set(name, { orig: value, tr });
  el.setAttribute(name, tr);
}

/** Free text fields follow the direction of what is typed in them. */
function autoDirField(el: Element): void {
  if (el.hasAttribute('dir')) return;
  if (el.tagName === 'TEXTAREA') {
    el.setAttribute('dir', 'auto');
  } else if (el.tagName === 'INPUT') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'text' || type === 'search') el.setAttribute('dir', 'auto');
  }
}

function walk(root: Node, translate: boolean): void {
  if (root.nodeType === Node.TEXT_NODE) {
    if (translate) translateText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  const start = root as Element;
  if (start.nodeType === Node.ELEMENT_NODE) {
    autoDirField(start);
    if (translate && safeClosest(start, SKIP_SELECTOR)) return;
  }
  const doc = root.ownerDocument ?? document;
  const tw = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        autoDirField(el);
        if (translate && (el.matches(SKIP_SELECTOR))) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  if (!translate) {
    // Still visit every element so text fields get dir="auto".
    while (tw.nextNode()) { /* acceptNode does the work */ }
    return;
  }
  if (start.nodeType === Node.ELEMENT_NODE) for (const a of ATTRS) translateAttr(start, a);
  let n: Node | null;
  while ((n = tw.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else for (const a of ATTRS) translateAttr(n as Element, a);
  }
}

function restoreAll(): void {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = tw.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      const rec = textRecords.get(n as Text);
      if (rec) {
        if (n.nodeValue === rec.tr) n.nodeValue = rec.orig;
        textRecords.delete(n as Text);
      }
    } else {
      const map = attrRecords.get(n as Element);
      if (map) {
        for (const [name, rec] of map) {
          if ((n as Element).getAttribute(name) === rec.tr) (n as Element).setAttribute(name, rec.orig);
        }
        attrRecords.delete(n as Element);
      }
    }
  }
}

function onMutations(records: MutationRecord[]): void {
  const translate = getLocale() === 'ar';
  for (const r of records) {
    if (r.type === 'characterData') {
      if (translate) translateText(r.target as Text);
    } else if (r.type === 'attributes') {
      if (translate && r.attributeName) {
        translateAttr(r.target as Element, r.attributeName);
      }
    } else {
      r.addedNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          if (translate) translateText(n as Text);
        } else {
          walk(n, translate);
        }
      });
    }
  }
  // Drop the records produced by our own writes.
  observer?.takeRecords();
}

function apply(locale: Locale): void {
  applyDocumentLocale(locale);
  if (!document.body) return;
  if (locale === 'ar') {
    walk(document.body, true);
  } else {
    restoreAll();
  }
  observer?.takeRecords();
}

/**
 * Start the translation layer once per page. Safe to call repeatedly and in
 * non-browser hosts (no-op there).
 */
export function ensureI18n(): void {
  if (started) return;
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  started = true;
  refreshLocaleFromStorage();
  const begin = () => {
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });
    apply(getLocale());
    subscribeLocale(() => apply(getLocale()));
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });
}

/** Translate one string directly (for code that builds strings outside React). */
export function translateString(s: string): string {
  if (getLocale() !== 'ar') return s;
  return lookup(s) ?? s;
}
