import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite } from '../csrf';

const req = (method: string, headers: Record<string, string> = {}) =>
  new NextRequest('https://styleiq.example/api/user/outfits', { method, headers });

describe('isCrossSiteWrite (CSRF check)', () => {
  it('allows same-origin writes and all reads', () => {
    expect(isCrossSiteWrite(req('POST', { origin: 'https://styleiq.example' }))).toBe(false);
    expect(isCrossSiteWrite(req('GET', { origin: 'https://evil.example' }))).toBe(false);
  });

  it('blocks writes from another origin', () => {
    expect(isCrossSiteWrite(req('POST', { origin: 'https://evil.example' }))).toBe(true);
    expect(isCrossSiteWrite(req('DELETE', { origin: 'https://styleiq.example.evil.com' }))).toBe(true);
    expect(isCrossSiteWrite(req('POST', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSiteWrite(req('POST', { origin: 'null' }))).toBe(true);
  });

  it('lets non-browser clients without an Origin through', () => {
    expect(isCrossSiteWrite(req('POST'))).toBe(false);
  });
});
