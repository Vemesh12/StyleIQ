import type { Slot } from './core';

// Which "slot" each garment type belongs to — shared by every scoring flow,
// so a single item of a given slot is treated consistently everywhere: only
// one worn at a time for top/bottom/footwear/layer, but accessories
// (belt/tie/watch/pocket square) can stack.
export const SLOT_TYPES: Record<Slot, string[]> = {
  top: ['shirt', 'tshirt', 'polo'],
  bottom: ['trouser'],
  footwear: ['shoe'],
  layer: ['jacket', 'sweater', 'cardigan', 'hoodie', 'knitwear'],
  accessory: ['belt', 'tie', 'pocket-square', 'watch', 'accessory'],
};

export const EXCLUSIVE_SLOTS = new Set<Slot>(['top', 'bottom', 'footwear', 'layer']);

export function slotForType(typeSlug: string): Slot {
  for (const [slot, types] of Object.entries(SLOT_TYPES) as [Slot, string[]][]) {
    if (types.includes(typeSlug)) return slot;
  }
  return 'accessory';
}
