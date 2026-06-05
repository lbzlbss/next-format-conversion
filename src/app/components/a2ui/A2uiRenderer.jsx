'use client';

import { Button, Tag } from 'antd';
import { DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { resolveDataPath } from '../../lib/a2ui/resolve-path.js';

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} dataModel
 */
function resolveProp(value, dataModel) {
  if (value != null && typeof value === 'object' && 'path' in value) {
    return resolveDataPath(dataModel, /** @type {{ path: string }} */ (value).path);
  }
  return value;
}

/**
 * @param {import('../../lib/a2ui/build-tool-result-surface.js').A2uiComponentNode} node
 * @param {Map<string, import('../../lib/a2ui/build-tool-result-surface.js').A2uiComponentNode>} index
 * @param {Record<string, unknown>} dataModel
 * @param {'page' | 'float'} variant
 */
function renderNode(node, index, dataModel, variant) {
  if (!node) return null;

  const childId = typeof node.child === 'string' ? node.child : null;
  const childIds = Array.isArray(node.children) ? node.children : [];
  const renderChild = (id) => {
    const child = index.get(id);
    return child ? renderNode(child, index, dataModel, variant) : null;
  };

  switch (node.component) {
    case 'Card': {
      const isError = node.variant === 'error';
      return (
        <div
          className={`mt-2 rounded-xl border px-3 py-3 text-xs ${
            isError
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-mf-border bg-mf-canvas text-mf-text'
          }`}
        >
          {childId ? renderChild(childId) : null}
        </div>
      );
    }
    case 'Column':
      return (
        <div className="flex flex-col gap-2">
          {childIds.map((id) => (
            <div key={id}>{renderChild(id)}</div>
          ))}
        </div>
      );
    case 'Text': {
      const text = String(resolveProp(node.text, dataModel) ?? '');
      const v = node.variant;
      if (v === 'h4') {
        return <div className="font-semibold text-mf-text">{text}</div>;
      }
      if (v === 'muted') {
        return <div className="text-mf-muted">{text}</div>;
      }
      return <div className="whitespace-pre-wrap break-words">{text}</div>;
    }
    case 'Tag': {
      const text = String(resolveProp(node.text, dataModel) ?? '');
      const color = node.color === 'green' ? 'green' : 'default';
      return <Tag color={color}>{text}</Tag>;
    }
    case 'Image': {
      const src = resolveProp(node.src, dataModel);
      if (!src || typeof src !== 'string') return null;
      const maxH = variant === 'float' ? 'max-h-32' : 'max-h-48';
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={String(node.alt || '')}
          className={`mb-1 w-full rounded-lg object-contain bg-black/5 ${maxH}`}
        />
      );
    }
    case 'Button': {
      const text = String(resolveProp(node.text, dataModel) ?? '按钮');
      const href = resolveProp(node.href, dataModel);
      const isPrimary = node.variant === 'primary';
      if (href && typeof href === 'string') {
        return (
          <Button
            type={isPrimary ? 'primary' : 'default'}
            size="small"
            className={isPrimary ? '!bg-mf-cta !border-mf-cta' : ''}
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {text}
          </Button>
        );
      }
      return (
        <Button type={isPrimary ? 'primary' : 'default'} size="small">
          {text}
        </Button>
      );
    }
    case 'DownloadLink': {
      const url = resolveProp(node.url, dataModel);
      const fileName = resolveProp(node.fileName, dataModel);
      if (!url || typeof url !== 'string') return null;
      const name = typeof fileName === 'string' ? fileName : 'download';
      return (
        <Button
          type="primary"
          size="small"
          icon={<DownloadOutlined />}
          className="!bg-mf-cta !border-mf-cta"
          onClick={() => {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }}
        >
          下载 {name}
        </Button>
      );
    }
    case 'Progress': {
      const text = String(resolveProp(node.text, dataModel) ?? '处理中…');
      return (
        <div className="flex items-center gap-2 text-mf-muted">
          <LoadingOutlined />
          <span>{text}</span>
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * @param {{
 *   surface: import('../../lib/a2ui/build-tool-result-surface.js').A2uiSurfaceState,
 *   variant?: 'page' | 'float',
 * }} props
 */
export default function A2uiRenderer({ surface, variant = 'page' }) {
  if (!surface?.components?.length) return null;

  const index = new Map(surface.components.map((c) => [c.id, c]));
  const root = index.get(surface.rootId) || surface.components[0];

  return <div className="a2ui-surface">{renderNode(root, index, surface.dataModel, variant)}</div>;
}
