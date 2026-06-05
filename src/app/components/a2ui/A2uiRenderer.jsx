'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Select, Slider, Tag } from 'antd';
import { BookOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { resolveDataPath, setDataPath } from '../../lib/a2ui/resolve-path.js';

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
 * @param {boolean} interactive
 * @param {(path: string, value: unknown) => void} [onPatch]
 * @param {(action: string, dataModel: Record<string, unknown>) => void} [onAction]
 */
function renderNode(
  node,
  index,
  dataModel,
  variant,
  interactive,
  onPatch,
  onAction,
) {
  if (!node) return null;

  const childId = typeof node.child === 'string' ? node.child : null;
  const childIds = Array.isArray(node.children) ? node.children : [];
  const renderChild = (id) => {
    const child = index.get(id);
    return child
      ? renderNode(child, index, dataModel, variant, interactive, onPatch, onAction)
      : null;
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
        <div className={`flex flex-col gap-2 ${node.id === 'actions' ? 'mt-1 flex-row flex-wrap' : ''}`}>
          {childIds.map((id) => (
            <div key={id}>{renderChild(id)}</div>
          ))}
        </div>
      );
    case 'ParamForm':
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-mf-border/80 bg-mf-surface/50 p-3">
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
    case 'Slider': {
      const path = typeof node.path === 'string' ? node.path : '';
      const raw = path ? resolveDataPath(dataModel, path) : node.value;
      const value = typeof raw === 'number' ? raw : Number(raw) || 0;
      const min = typeof node.min === 'number' ? node.min : 0;
      const max = typeof node.max === 'number' ? node.max : 100;
      const step = typeof node.step === 'number' ? node.step : 1;
      const label = String(node.label || '');

      if (!interactive || !path || !onPatch) {
        return (
          <div className="text-mf-muted">
            {label}: {value}
          </div>
        );
      }

      return (
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-mf-text">
            <span>{label}</span>
            <span className="font-medium text-mf-cta">{value}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(v) => onPatch(path, v)}
            className="!mb-0"
          />
        </div>
      );
    }
    case 'Select': {
      const path = typeof node.path === 'string' ? node.path : '';
      const raw = path ? resolveDataPath(dataModel, path) : node.value;
      const value = raw == null ? '' : String(raw);
      const label = String(node.label || '');
      const options = Array.isArray(node.options) ? node.options : [];

      if (!interactive || !path || !onPatch) {
        const opt = options.find((o) => String(o.value) === value);
        return (
          <div className="text-mf-muted">
            {label}: {opt?.label || value || '—'}
          </div>
        );
      }

      return (
        <div>
          <div className="mb-1 text-[11px] text-mf-text">{label}</div>
          <Select
            size="small"
            className="w-full"
            value={value}
            options={options.map((o) => ({
              value: String(o.value),
              label: String(o.label),
            }))}
            onChange={(v) => onPatch(path, v)}
          />
        </div>
      );
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
      const actionName = typeof node.action === 'string' ? node.action : null;

      if (actionName && interactive && onAction) {
        return (
          <Button
            type={isPrimary ? 'primary' : 'default'}
            size="small"
            className={isPrimary ? '!bg-mf-cta !border-mf-cta' : ''}
            onClick={() => onAction(actionName, dataModel)}
          >
            {text}
          </Button>
        );
      }

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
    case 'WikiRef': {
      const slug = String(resolveProp(node.slug, dataModel) ?? '');
      const title = String(resolveProp(node.title, dataModel) ?? slug);
      if (!slug) return null;
      return (
        <Link
          href={`/wiki/${slug}`}
          className="inline-flex items-center gap-1 rounded-md bg-mf-accent-soft px-2 py-1 text-[11px] font-medium text-mf-accent-soft-fg hover:opacity-90"
        >
          <BookOutlined className="text-[10px]" />
          {title}
        </Link>
      );
    }
    case 'Divider':
      return <div className="my-1 border-t border-mf-border/70" />;
    case 'Alert': {
      const text = String(resolveProp(node.text, dataModel) ?? '');
      const isWarn = node.variant === 'warning';
      return (
        <div
          className={`rounded-lg px-2 py-1.5 text-[11px] ${
            isWarn
              ? 'border border-amber-200 bg-amber-50 text-amber-800'
              : 'border border-mf-border bg-mf-surface text-mf-muted'
          }`}
        >
          {text}
        </div>
      );
    }
    case 'Table': {
      if (variant === 'float') return null;
      const columns = Array.isArray(node.columns) ? node.columns : [];
      const rows = Array.isArray(node.rows) ? node.rows : [];
      if (!columns.length) return null;
      return (
        <div className="overflow-x-auto rounded-lg border border-mf-border">
          <table className="w-full min-w-[280px] text-left text-[11px]">
            <thead className="bg-mf-canvas text-mf-muted">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-2 py-1.5 font-medium">
                    {String(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-mf-border/60">
                  {(Array.isArray(row) ? row : []).map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 text-mf-text">
                      {String(cell ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'Steps': {
      const items = Array.isArray(node.items) ? node.items : [];
      return (
        <ol className="ml-4 list-decimal space-y-2 text-mf-text">
          {items.map((item, idx) => {
            if (!item || typeof item !== 'object') return null;
            const step = /** @type {Record<string, unknown>} */ (item);
            const title = String(resolveProp(step.title, dataModel) ?? '');
            const desc = String(resolveProp(step.description, dataModel) ?? '');
            return (
              <li key={idx} className="pl-1">
                {title ? <div className="font-medium">{title}</div> : null}
                {desc ? <div className="text-mf-muted">{desc}</div> : null}
              </li>
            );
          })}
        </ol>
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
 *   interactive?: boolean,
 *   onAction?: (action: string, dataModel: Record<string, unknown>) => void,
 * }} props
 */
export default function A2uiRenderer({
  surface,
  variant = 'page',
  interactive = false,
  onAction,
}) {
  const [dataModel, setDataModel] = useState(surface?.dataModel || {});

  useEffect(() => {
    setDataModel(surface?.dataModel || {});
  }, [surface]);

  const onPatch = useCallback((path, value) => {
    setDataModel((prev) => setDataPath(prev, path, value));
  }, []);

  const handleAction = useCallback(
    (actionName, model) => {
      onAction?.(actionName, model);
    },
    [onAction],
  );

  if (!surface?.components?.length) return null;

  const index = new Map(surface.components.map((c) => [c.id, c]));
  const root = index.get(surface.rootId) || surface.components[0];

  return (
    <div className="a2ui-surface">
      {renderNode(root, index, dataModel, variant, interactive, onPatch, handleAction)}
    </div>
  );
}
