'use client';

import { useEffect, useMemo, useState } from 'react';
import { CaretRightOutlined } from '@ant-design/icons';

/**
 * @param {{
 *   groups: Array<{ id: string, label: string, keys: string[], defaultOpen?: boolean }>,
 *   items: Array<{ key: string, label: string, icon: React.ReactNode }>,
 *   activeKey: string,
 *   onSelect: (key: string) => void,
 *   query?: string,
 * }} props
 */
export default function SidebarNav({ groups, items, activeKey, onSelect, query = '' }) {
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen !== false]))
  );

  useEffect(() => {
    const group = groups.find((g) => g.keys.includes(activeKey));
    if (group) {
      setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
    }
  }, [activeKey, groups]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((it) => it.label.toLowerCase().includes(q))
      : items;
    return groups
      .map((g) => ({
        ...g,
        items: filtered.filter((it) => g.keys.includes(it.key)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, items, query]);

  const toggle = (id) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {grouped.map((group) => {
        const open = openGroups[group.id] ?? true;
        return (
          <section key={group.id} className="mb-3">
            <button
              type="button"
              onClick={() => toggle(group.id)}
              className="mf-sidebar-group-trigger"
              aria-expanded={open}
            >
              <CaretRightOutlined
                className={`shrink-0 text-[10px] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
              />
              <span className="truncate">{group.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-[10px] font-normal normal-case text-mf-sidebar-muted">
                {group.items.length}
              </span>
            </button>
            {open ? (
              <div className="mt-1 flex flex-col gap-1">
                {group.items.map((it) => {
                  const isActive = it.key === activeKey;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => onSelect(it.key)}
                      className={['mf-sidebar-nav-btn', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                    >
                      <span className="mf-sidebar-nav-icon">{it.icon}</span>
                      <span className="truncate text-[15px] font-medium">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
