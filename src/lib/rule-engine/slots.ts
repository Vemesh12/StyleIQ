// Which "slot" each garment type belongs to — shared by the item picker and
// the outfit-finder (quick pick / daily suggestion), so a single item of a
// given slot is treated consistently everywhere: only one worn at a time for
// top/bottom/footwear/layer, but accessories (belt/tie/watch/pocket square)
// can stack.
export const SLOT_TYPES: Record<string, string[]> = {
  top: ['shirt', 'tshirt', 'polo'],
  bottom: ['trouser'],
  footwear: ['shoe'],
  layer: ['jacket', 'sweater', 'cardigan', 'hoodie', 'knitwear'],
  accessory: ['belt', 'tie', 'pocket-square', 'watch', 'accessory'],
};

export const EXCLUSIVE_SLOTS = new Set(['top', 'bottom', 'footwear', 'layer']);

export function slotForType(typeSlug: string): string {
  for (const [slot, types] of Object.entries(SLOT_TYPES)) {
    if (types.includes(typeSlug)) return slot;
  }
  return 'accessory';
}
