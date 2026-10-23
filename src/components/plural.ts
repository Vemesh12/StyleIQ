// English plural for garment type names and other labels:
// "Accessory" -> "Accessories", "Watch" -> "Watches", "Knitwear" -> "Knitwear".
const UNCOUNTABLE = /(wear|clothing)$/i;

export function pluralize(word: string, count?: number): string {
  if (count === 1 || !word || UNCOUNTABLE.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (/(ss|x|z|ch|sh)$/i.test(word)) return word + 'es';
  if (/s$/i.test(word)) return word; // already plural ("Shoes", "Jeans")
  return word + 's';
}
