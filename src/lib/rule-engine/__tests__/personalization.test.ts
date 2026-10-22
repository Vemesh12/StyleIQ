import { describe, expect, it } from 'vitest';
import { colorMatchesTerm, judgeColorForProfile, judgeFitForBody, judgePatternForBody } from '../personalization';
import { C } from './fixtures';

describe('colorMatchesTerm', () => {
  it.each([
    [C.olive, 'Earth Tones', true],
    [{ name: 'Emerald', hex: '#046307', family: 'Green' }, 'Jewel Tones', true],
    [C.skyBlue, 'Cool Blue', true],
    [C.navy, 'Cool Blue', false], // navy is a wardrobe neutral
    [C.navy, 'Jewel Tones', false],
    [C.white, 'Icy Gray', false],
    [{ name: 'Light Grey', hex: '#C8CCD0', family: 'Neutral', isNeutral: true }, 'Icy Gray', true],
    [C.darkBrown, 'Brown', true],
    [{ name: 'Tangerine', hex: '#F28500', family: 'Orange' }, 'tan', false], // whole words only
    [{ name: 'Navy Blue', hex: '#1B2A4A', family: 'Blue' }, 'navy blue', true],
  ])('%o vs "%s" -> %s', (color, term, expected) => {
    expect(colorMatchesTerm(color, term)).toBe(expected);
  });
});

describe('judgeColorForProfile', () => {
  const warm = {
    recommendedClothingColors: 'Earth Tones, Olive, Coral, Peach, Mustard, Warm Red',
    avoidClothingColors: 'Cool Blue, Icy Gray, Jewel Tones',
  };

  it('recommends earth tones and avoids cool blues for a warm undertone', () => {
    expect(judgeColorForProfile(C.olive, warm)).toBe('recommended');
    expect(judgeColorForProfile(C.skyBlue, warm)).toBe('avoid');
  });

  it('leaves classic neutrals neutral', () => {
    expect(judgeColorForProfile(C.white, warm)).toBe('neutral');
    expect(judgeColorForProfile(C.navy, warm)).toBe('neutral');
  });
});

describe('body guidance', () => {
  it('maps body proportion to menswear fits', () => {
    expect(judgeFitForBody('Tailored Fit', 'top', 'Rectangle')).toBe('recommended');
    expect(judgeFitForBody('Skinny Fit', 'bottom', 'Triangle')).toBe('avoid');
    expect(judgeFitForBody('Skinny Fit', 'top', 'Triangle')).toBe('neutral'); // rule is bottoms-only
    expect(judgeFitForBody('Slim Fit', 'top', 'Unknown Shape')).toBe('neutral');
  });

  it('reads the dataset\'s pattern advice', () => {
    expect(judgePatternForBody('striped', 'top', 'Vertical Stripes', false)).toBe('recommended');
    expect(judgePatternForBody('floral', 'top', 'Subtle Prints', false)).toBe('avoid');
    expect(judgePatternForBody('herringbone', 'layer', 'Diagonal Lines', false)).toBe('recommended');
  });
});
