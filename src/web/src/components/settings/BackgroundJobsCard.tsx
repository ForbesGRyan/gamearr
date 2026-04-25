import { useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useTasks, useRetryTask, useDeleteTask } from '../../queries/tasks';
import { useNow } from '../../hooks/useNow';
import type { Task, TaskStatus } from '../../api/client';

const STATUS_FILTERS: ReadonlyArray<{ label: string; value: TaskStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Running', value: 'running' },
  { label: 'Done', value: 'done' },
  { label: 'Dead', value: 'dead' },
];

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending: 'bg-gray-600 text-gray-100',
  running: 'bg-blue-600 text-white',
  done: 'bg-green-700 text-green-100',
  dead: 'bg-red-700 text-red-100',
};

const DELETE_TOOLTIP =
  'Pending: cancels the task. Dead: clears the failure record. Done tasks are kept as an audit log and auto-archived after 7 days.';

function relativeAge(unixSec: number, nowMs: number): string {
  const diff = Math.max(0, Math.floor(nowMs / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function summarizeStatuses(tasks: Task[]): string {
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const order: TaskStatus[] = ['running', 'pending', 'dead', 'done'];
  return order
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${s}`)
    .join(' · ');
}

export default function BackgroundJobsCard() {
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const params = statusFilter === 'all' ? { limit: 100 } : { status: statusFilter, limit: 100 };
  const tasksQuery = useTasks(params);
  const retryMutation = useRetryTask();
  const deleteMutation = useDeleteTask();
  const now = useNow(1000);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = map.get(t.kind) ?? [];
      arr.push(t);
      map.set(t.kind, arr);
    }
    return [...map.entries()]
      .map(([kind, items]) => ({ kind, items }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }, [tasks]);

  const handleRetry = async (task: Task) => {
    try {
      await retryMutation.mutateAsync(task.id);
      addToast(`Re-queued task #${task.id}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      addToast(msg, 'error');
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      await deleteMutation.mutateAsync(task.id);
      addToast(`Deleted task #${task.id}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      addToast(msg, 'error');
    }
  };

  const toggleGroup = (kind: string) =>
    setCollapsed((prev) => ({ ...prev, [kind]: !prev[kind] }));

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 md:mb-4">
        <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Tasks Log
          <span className="text-sm font-normal text-gray-400">
            ({tasks.length}{tasks.length === 100 ? '+' : ''})
          </span>
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            aria-label="Filter tasks by status"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {tasksQuery.isFetching && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" aria-label="Refreshing" />
          )}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          <p>No tasks{statusFilter === 'all' ? ' yet' : ` with status "${statusFilter}"`}.</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
          {grouped.map(({ kind, items }) => {
            // Default collapsed; click to expand and see history.
            const isCollapsed = collapsed[kind] ?? true;
            // Backend returns ORDER BY id DESC, so items[0] is the most recent.
            const latest = items[0];
            return (
              <div key={kind} className="border border-gray-700 rounded">
                <button
                  type="button"
                  onClick={() => toggleGroup(kind)}
                  className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-750 hover:bg-gray-700 rounded-t text-left text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg
                      className={`w-4 h-4 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-mono truncate">{kind}</span>
                    <span className="text-gray-400 flex-shrink-0">({items.length})</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto min-w-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_BADGE[latest.status]}`}>
                      {latest.status}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{relativeAge(latest.updatedAt, now)}</span>
                    {latest.lastError && (
                      <span
                        className="text-xs text-red-400 truncate max-w-[180px] hidden md:inline"
                        title={latest.lastError}
                      >
                        {latest.lastError}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 hidden lg:inline border-l border-gray-600 pl-2 ml-1">
                      {summarizeStatuses(items)}
                    </span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="px-3 py-1 font-medium">Status</th>
                          <th className="px-3 py-1 font-medium">Attempts</th>
                          <th className="px-3 py-1 font-medium hidden lg:table-cell">Last Error</th>
                          <th className="px-3 py-1 font-medium hidden md:table-cell">Updated</th>
                          <th className="px-3 py-1 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {items.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-750">
                            <td className="px-3 py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[t.status]}`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-gray-300">
                              {t.attempts}/{t.maxAttempts}
                            </td>
                            <td
                              className="px-3 py-1.5 text-gray-400 hidden lg:table-cell max-w-xs truncate"
                              title={t.lastError ?? ''}
                            >
                              {t.lastError ?? '—'}
                            </td>
                            <td className="px-3 py-1.5 text-gray-400 hidden md:table-cell">
                              {relativeAge(t.updatedAt, now)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <div className="flex gap-2 justify-end">
                                {t.status === 'dead' && (
                                  <button
                                    onClick={() => handleRetry(t)}
                                    disabled={retryMutation.isPending}
                                    className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
                                  >
                                    Retry
                                  </button>
                                )}
                                {(t.status === 'pending' || t.status === 'dead') && (
                                  <button
                                    onClick={() => handleDelete(t)}
                                    disabled={deleteMutation.isPending}
                                    title={DELETE_TOOLTIP}
                                    className="px-2 py-0.5 text-xs bg-gray-600 hover:bg-gray-500 rounded transition disabled:opacity-50"
                                  >
                                    {t.status === 'pending' ? 'Cancel' : 'Delete'}
                                  </button>
                                )}
                                {(t.status === 'done' || t.status === 'running') && (
                                  <span className="text-xs text-gray-500">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
