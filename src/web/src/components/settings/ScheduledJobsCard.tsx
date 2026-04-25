import { useToast } from '../../contexts/ToastContext';
import { useScheduledJobs, useRunScheduledJob } from '../../queries/jobs';
import { useNow } from '../../hooks/useNow';
import type { ScheduledJob } from '../../api/client';

const KIND_BADGE: Record<ScheduledJob['kind'], string> = {
  cron: 'bg-purple-700 text-purple-100',
  interval: 'bg-blue-700 text-blue-100',
  continuous: 'bg-green-700 text-green-100',
};

function relativePast(unixSec: number | null, nowMs: number): string {
  if (unixSec === null) return 'never';
  const diff = Math.max(0, Math.floor(nowMs / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function relativeFuture(unixSec: number | null, nowMs: number): string {
  if (unixSec === null) return '—';
  const diff = Math.floor(unixSec - nowMs / 1000);
  if (diff <= 0) return 'imminent';
  if (diff < 60) return `in ${diff}s`;
  if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `in ${Math.floor(diff / 3600)}h`;
  return `in ${Math.floor(diff / 86400)}d`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default function ScheduledJobsCard() {
  const { addToast } = useToast();
  const jobsQuery = useScheduledJobs();
  const runMutation = useRunScheduledJob();
  const now = useNow(1000);

  const jobs = jobsQuery.data ?? [];

  const handleRun = async (job: ScheduledJob) => {
    try {
      await runMutation.mutateAsync(job.name);
      addToast(`Triggered "${job.name}"`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Run failed';
      addToast(msg, 'error');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 md:mb-4">
        <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Scheduled Jobs
          <span className="text-sm font-normal text-gray-400">({jobs.length})</span>
        </h3>
        {jobsQuery.isFetching && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" aria-label="Refreshing" />
        )}
      </div>

      {jobsQuery.isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          <p>No jobs registered.</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto pr-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium hidden md:table-cell">Schedule</th>
                <th className="py-2 font-medium">Last Run</th>
                <th className="py-2 font-medium">Next Run</th>
                <th className="py-2 font-medium hidden lg:table-cell">Duration</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {jobs.map((job) => {
                const nextLabel = job.running ? 'running…' : relativeFuture(job.nextRunAt, now);
                return (
                  <tr key={job.name} className="hover:bg-gray-750">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${KIND_BADGE[job.kind]}`}>
                          {job.kind}
                        </span>
                        <span className="font-mono text-xs">{job.name}</span>
                        {job.running && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-600 text-white animate-pulse">
                            running
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-gray-300 hidden md:table-cell">{job.schedule}</td>
                    <td className="py-2 text-gray-300">{relativePast(job.lastRunAt, now)}</td>
                    <td className="py-2 text-gray-300 tabular-nums">{nextLabel}</td>
                    <td className="py-2 text-gray-400 hidden lg:table-cell">{formatDuration(job.lastDurationMs)}</td>
                    <td className="py-2 text-right">
                      {job.triggerable ? (
                        <button
                          onClick={() => handleRun(job)}
                          disabled={runMutation.isPending || job.running}
                          className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
                        >
                          Run now
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
