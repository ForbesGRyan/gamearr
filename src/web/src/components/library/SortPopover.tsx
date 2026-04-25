import { useEffect, useRef } from 'react';
import type { Table } from '@tanstack/react-table';
import type { GameRow } from './libraryColumns';

interface SortPopoverProps {
  table: Table<GameRow>;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

export const SORT_OPTIONS: Array<{ id: string; desc: boolean; label: string; group: string }> = [
  { id: 'title', desc: false, label: 'Title (A-Z)', group: 'Title' },
  { id: 'title', desc: true, label: 'Title (Z-A)', group: 'Title' },
  { id: 'year', desc: true, label: 'Year (Newest)', group: 'Year' },
  { id: 'year', desc: false, label: 'Year (Oldest)', group: 'Year' },
  { id: 'rating', desc: true, label: 'Rating (Highest)', group: 'Rating' },
  { id: 'rating', desc: false, label: 'Rating (Lowest)', group: 'Rating' },
  { id: 'monitored', desc: false, label: 'Monitored first', group: 'Monitored' },
  { id: 'monitored', desc: true, label: 'Unmonitored first', group: 'Monitored' },
  { id: 'stores', desc: false, label: 'Store (A-Z)', group: 'Store' },
  { id: 'stores', desc: true, label: 'Store (Z-A)', group: 'Store' },
  { id: 'status', desc: false, label: 'Wanted first', group: 'Status' },
  { id: 'status', desc: true, label: 'Downloaded first', group: 'Status' },
];

export function getSortLabel(sortId: string | undefined, desc: boolean): string {
  const found = SORT_OPTIONS.find((o) => o.id === (sortId ?? 'title') && o.desc === desc);
  return found?.label ?? 'Title (A-Z)';
}

export function SortPopover({ table, open, onClose, anchorRef }: SortPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const pop = popoverRef.current;
      const anchor = anchorRef.current;
      const target = e.target as Node;
      if (pop?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = table.getState().sorting[0];
  const currentId = current?.id ?? 'title';
  const currentDesc = current?.desc ?? false;

  return (
    <div
      ref={popoverRef}
      role="menu"
      aria-label="Sort games"
      className="absolute z-30 mt-2 right-0 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 max-h-[70vh] overflow-y-auto"
    >
      {SORT_OPTIONS.map((opt) => {
        const active = opt.id === currentId && opt.desc === currentDesc;
        return (
          <button
            key={`${opt.id}-${opt.desc}`}
            role="menuitemradio"
            aria-checked={active}
            type="button"
            onClick={() => {
              table.setSorting([{ id: opt.id, desc: opt.desc }]);
              onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition ${
              active ? 'bg-blue-600/20 text-blue-200' : 'text-gray-200 hover:bg-gray-700'
            }`}
          >
            <span>{opt.label}</span>
            {active && (
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
