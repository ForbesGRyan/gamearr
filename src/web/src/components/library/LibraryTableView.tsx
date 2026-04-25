import { flexRender, type Table } from '@tanstack/react-table';
import type { GameRow } from './libraryColumns';

interface LibraryTableViewProps {
  table: Table<GameRow>;
}

function ariaSort(dir: false | 'asc' | 'desc'): 'none' | 'ascending' | 'descending' {
  if (dir === 'asc') return 'ascending';
  if (dir === 'desc') return 'descending';
  return 'none';
}

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (!dir) return <span className="text-gray-500 ml-1">{'↕'}</span>;
  return <span className="text-blue-400 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

const COLUMN_TH_CLASS: Record<string, string> = {
  select: 'w-10 px-3 py-3',
  title: 'text-left px-4 py-3 font-medium',
  year: 'text-left px-4 py-3 font-medium w-20',
  rating: 'text-left px-4 py-3 font-medium w-20',
  genres: 'text-left px-4 py-3 font-medium w-40',
  monitored: 'text-center px-2 py-3 font-medium w-12',
  stores: 'text-left px-4 py-3 font-medium w-24',
  status: 'text-left px-4 py-3 font-medium w-28',
  actions: 'text-right px-4 py-3 font-medium w-32',
};

const COLUMN_TD_CLASS: Record<string, string> = {
  select: 'px-3 py-3',
  title: 'px-4 py-3',
  year: 'px-4 py-3',
  rating: 'px-4 py-3',
  genres: 'px-4 py-3',
  monitored: 'px-2 py-3 text-center',
  stores: 'px-4 py-3',
  status: 'px-4 py-3',
  actions: 'px-4 py-3',
};

export function LibraryTableView({ table }: LibraryTableViewProps) {
  return (
    <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-700">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                const baseCls = COLUMN_TH_CLASS[header.column.id] ?? 'text-left px-4 py-3 font-medium';
                const interactive = sortable
                  ? `cursor-pointer hover:bg-gray-600 transition select-none`
                  : '';
                const activeSort = sortDir ? 'text-blue-300' : '';
                const cls = `${baseCls} ${interactive} ${activeSort}`.trim();
                return (
                  <th
                    key={header.id}
                    className={cls}
                    aria-sort={ariaSort(sortDir)}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    title={sortable ? 'Click to sort' : undefined}
                  >
                    <span className="inline-flex items-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortable && <SortIndicator dir={sortDir} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-700">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`hover:bg-gray-700/50 transition ${row.getIsSelected() ? 'bg-blue-900/30' : ''}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={COLUMN_TD_CLASS[cell.column.id] ?? 'px-4 py-3'}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
