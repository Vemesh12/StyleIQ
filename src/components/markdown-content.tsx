import { Fragment, type ReactNode } from 'react';

// Minimal, safe Markdown for admin-written guides. Output is built as React
// elements (never raw HTML), so guide content can't inject markup or script.
// Supported: ## / ### headings, - or * bullet lists, 1. numbered lists,
// > quotes, **bold**, *italic*, `code`, and [links](https://...).

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

// Absolute http(s) URLs, in-page anchors, and site paths. A path must not
// start with "//" or "/\" — browsers treat those as protocol-relative links
// to another host, not internal pages.
function safeHref(url: string): string | null {
  return /^(https?:\/\/|\/(?![/\\])|#)/i.test(url) ? url : null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          key={key}
          href={href}
          className="text-amber-700 dark:text-amber-400 underline underline-offset-2"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
        >
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block =
  | { kind: 'h'; level: 2 | 3 | 4; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'p'; text: string };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join(' ') });
    if (list) blocks.push(list);
    paragraph = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (heading) {
      flush();
      // The page title is the h1, so `#` and `##` both become h2.
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4;
      blocks.push({ kind: 'h', level, text: heading[2] });
    } else if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (paragraph.length || (list && list.kind !== kind)) flush();
      list ??= { kind, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (quote) {
      flush();
      blocks.push({ kind: 'quote', text: quote[1] });
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function MarkdownContent({ source }: { source: string }) {
  return (
    <>
      {parseBlocks(source).map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case 'h': {
            const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
            const size = block.level === 2 ? 'text-2xl' : block.level === 3 ? 'text-xl' : 'text-lg';
            return (
              <Tag key={key} className={`${size} font-bold text-slate-900 dark:text-white pt-2`}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case 'ul':
          case 'ol': {
            const Tag = block.kind;
            return (
              <Tag key={key} className={`${block.kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-6 space-y-1.5`}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={key} className="border-l-4 border-amber-500 pl-4 italic text-slate-600 dark:text-zinc-400">
                {renderInline(block.text, key)}
              </blockquote>
            );
          default:
            return <p key={key}>{renderInline(block.text, key)}</p>;
        }
      })}
    </>
  );
}

/** Reading time at ~200 words per minute (min 1). */
export function readingMinutes(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
