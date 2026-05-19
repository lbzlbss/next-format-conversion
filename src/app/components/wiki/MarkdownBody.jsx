'use client';

import { slugifyHeading } from './markdown-utils';

/**
 * @param {{ markdown: string, skipFirstH1?: boolean }} props
 */
export default function MarkdownBody({ markdown, skipFirstH1 = true }) {
  const lines = markdown.split('\n');
  const nodes = [];
  let i = 0;
  let skippedH1 = false;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isTableStart(lines, i)) {
      const { node, nextIndex } = parseTable(lines, i, key);
      nodes.push(node);
      i = nextIndex;
      key += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      if (skipFirstH1 && !skippedH1) {
        skippedH1 = true;
      } else {
        nodes.push(
          <h1 key={key++} className="wiki-h1">
            {formatInline(line.slice(2))}
          </h1>,
        );
      }
    } else if (line.startsWith('### ')) {
      const text = line.slice(4);
      const id = slugifyHeading(text);
      nodes.push(
        <h3 key={key++} id={id} className="wiki-h3 scroll-mt-24">
          {formatInline(text)}
        </h3>,
      );
    } else if (line.startsWith('## ')) {
      const text = line.slice(3);
      const id = slugifyHeading(text);
      nodes.push(
        <h2 key={key++} id={id} className="wiki-h2 scroll-mt-24">
          {formatInline(text)}
        </h2>,
      );
    } else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      nodes.push(
        <ul key={key++} className="wiki-ul">
          {items.map((item, idx) => (
            <li key={idx}>{formatInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i += 1;
      }
      nodes.push(
        <ol key={key++} className="wiki-ol">
          {items.map((item, idx) => (
            <li key={idx}>{formatInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    } else if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={key++} className="wiki-blockquote">
          {formatInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line.trim() === '') {
      nodes.push(<div key={key++} className="h-3" aria-hidden />);
    } else {
      nodes.push(
        <p key={key++} className="wiki-p">
          {formatInline(line)}
        </p>,
      );
    }
    i += 1;
  }

  return <article className="wiki-prose">{nodes}</article>;
}

function isTableStart(lines, i) {
  const line = lines[i];
  const next = lines[i + 1];
  return line?.includes('|') && next && /^\|?[\s-:|]+\|/.test(next);
}

function parseTable(lines, start, key) {
  const headerCells = splitTableRow(lines[start]);
  let i = start + 2;
  const bodyRows = [];
  while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
    bodyRows.push(splitTableRow(lines[i]));
    i += 1;
  }
  return {
    nextIndex: i,
    node: (
      <div key={key} className="wiki-table-wrap">
        <table className="wiki-table">
          <thead>
            <tr>
              {headerCells.map((cell, idx) => (
                <th key={idx}>{formatInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ridx) => (
              <tr key={ridx}>
                {row.map((cell, cidx) => (
                  <td key={cidx}>{formatInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  };
}

function splitTableRow(line) {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
}

function formatInline(text) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-mf-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="wiki-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
