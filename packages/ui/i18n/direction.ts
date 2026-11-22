/**
 * Reading direction of a document from its own text.
 *
 * A plan written in Arabic with English terms sprinkled in ("الـ fork",
 * `inline code`, URLs) is still an Arabic document: count the letters of the
 * prose (code, inline code, links' targets and HTML left out) and call it
 * right-to-left when right-to-left letters are the larger share.
 */

// Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic, Arabic
// Supplement/Extended, and the Arabic presentation forms.
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/g;
const LTR_LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/g;

type TextBlock = { type: string; content: string };

function prose(text: string): string {
  return text
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/\]\([^)]*\)/g, ']') // link targets
    .replace(/https?:\/\/\S+/g, ' ') // bare URLs
    .replace(/<[^>]+>/g, ' '); // inline HTML tags
}

export function detectTextDirection(blocks: readonly TextBlock[]): 'rtl' | 'ltr' {
  let rtl = 0;
  let ltr = 0;
  for (const b of blocks) {
    if (b.type === 'code' || b.type === 'math' || b.type === 'hr' || b.type === 'html') continue;
    const text = prose(b.content || '');
    rtl += text.match(RTL_LETTER)?.length ?? 0;
    ltr += text.match(LTR_LETTER)?.length ?? 0;
    // Plenty of evidence already: stop scanning long documents.
    if (rtl + ltr > 4000) break;
  }
  return rtl > ltr ? 'rtl' : 'ltr';
}
