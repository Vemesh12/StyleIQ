import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent, readingMinutes } from '../markdown-content';

const render = (source: string) => renderToStaticMarkup(<MarkdownContent source={source} />);

describe('MarkdownContent', () => {
  it('renders headings, emphasis and lists', () => {
    const html = render('## Fit first\n\nWear **tailored** and *slim*.\n\n- One\n- Two\n\n1. Buy\n2. Tailor');
    expect(html).toContain('<h2');
    expect(html).toContain('<strong>tailored</strong>');
    expect(html).toContain('<em>slim</em>');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html.match(/<li>/g)).toHaveLength(4);
  });

  it('never renders unsafe links or raw HTML', () => {
    const html = render('[evil](javascript:alert(1)) [safe](https://example.com)\n\n<script>alert(1)</script>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('noopener');
    expect(html).not.toContain('<script>');
  });
});

describe('readingMinutes', () => {
  it('estimates ~200 words per minute, minimum 1', () => {
    expect(readingMinutes('word '.repeat(1000))).toBe(5);
    expect(readingMinutes('hi')).toBe(1);
  });
});
