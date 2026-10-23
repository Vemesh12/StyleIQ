import { describe, expect, it } from 'vitest';
import { pluralize } from '../plural';

describe('pluralize', () => {
  it('handles the catalog garment types', () => {
    expect(pluralize('Accessory')).toBe('Accessories');
    expect(pluralize('Watch')).toBe('Watches');
    expect(pluralize('Shirt')).toBe('Shirts');
    expect(pluralize('Polo Shirt')).toBe('Polo Shirts');
    expect(pluralize('T-Shirt')).toBe('T-Shirts');
    expect(pluralize('Knitwear')).toBe('Knitwear');
    expect(pluralize('Tie')).toBe('Ties');
    expect(pluralize('Pocket Square')).toBe('Pocket Squares');
  });

  it('keeps words that are already plural and uses the count', () => {
    expect(pluralize('Shoes')).toBe('Shoes');
    expect(pluralize('Dress')).toBe('Dresses');
    expect(pluralize('Key')).toBe('Keys');
    expect(pluralize('Shirt', 1)).toBe('Shirt');
    expect(pluralize('Shirt', 0)).toBe('Shirts');
  });
});
