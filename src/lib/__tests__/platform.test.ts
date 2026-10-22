import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRecords } from '../csv';
import { validateEnv } from '../env';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded commas and line breaks', () => {
    const rows = parseCsv('name,notes\r\n"Shirt, white","He said ""hi""\nthen left"\n\nTee,plain\n');
    expect(rows).toEqual([
      ['name', 'notes'],
      ['Shirt, white', 'He said "hi"\nthen left'],
      ['Tee', 'plain'],
    ]);
  });

  it('strips an Excel byte-order mark and keys records by lower-case header', () => {
    const { headers, records } = parseCsvRecords(String.fromCharCode(0xfeff) + 'Name, Type\nOxford,shirt');
    expect(headers).toEqual(['name', 'type']);
    expect(records).toEqual([{ line: 2, values: { name: 'Oxford', type: 'shirt' } }]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a,"b\n')).toThrow(/unclosed/);
  });
});

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_SECRET: 'x'.repeat(40) };

  it('accepts a valid configuration and treats empty values as unset', () => {
    expect(validateEnv({ ...base, NEXT_PUBLIC_APP_URL: '', TRUSTED_PROXY_HOPS: '2' } as unknown as NodeJS.ProcessEnv).TRUSTED_PROXY_HOPS).toBe(2);
  });

  it('lists every problem at once', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://x', NEXT_PUBLIC_APP_URL: 'not a url' } as unknown as NodeJS.ProcessEnv)).toThrow(
      /DATABASE_URL must be a postgres[\s\S]*JWT_SECRET is required[\s\S]*NEXT_PUBLIC_APP_URL/
    );
  });

  it('requires both Upstash settings or neither', () => {
    expect(() => validateEnv({ ...base, UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' } as unknown as NodeJS.ProcessEnv)).toThrow(/both UPSTASH/);
  });
});
