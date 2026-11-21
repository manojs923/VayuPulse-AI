/**
 * @file sanitize.ts
 * @description Safe string sanitization utilities avoiding control regexes.
 */

export function stripControlChars(input: string, replacement = ''): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    out += isControl ? replacement : ch;
  }
  return out;
}
