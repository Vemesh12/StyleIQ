// JSON.stringify does not escape `<`, so a value containing `</script>` would
// close the JSON-LD script tag and let the rest run as HTML. Escaping these
// characters as unicode keeps the JSON identical once parsed.
const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  [String.fromCharCode(0x2028)]: '\\u2028',
  [String.fromCharCode(0x2029)]: '\\u2029',
};
const UNSAFE = new RegExp(`[${Object.keys(ESCAPES).join('')}]`, 'g');

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, (ch) => ESCAPES[ch]);
}
