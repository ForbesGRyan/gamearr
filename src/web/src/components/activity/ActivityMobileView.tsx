import { Download } from '../../api/client';
import { MobileCard, MobileCardButton } from '../MobileCard';
import { formatBytes, formatSpeed, formatETA } from '../../utils/formatters';
import { getStatusInfo, isPaused } from './types';

interface ActivityMobileViewProps {
  downloads: Download[];
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onImport: (download: Download) => void;
  onDelete: (download: Download) => void;
}

function ActivityMobileView({
  downloads,
  onPause,
  onResume,
  onImport,
  onDelete,
}: ActivityMobileViewProps) {
  return (
    <div className="md:hidden space-y-3">
      {downloads.map((download) => {
        const statusInfo = getStatusInfo(download.state);
        return (
          <MobileCard
            key={download.hash}
            title={download.name}
            status={statusInfo}
            progress={download.progress * 100}
            fields={[
              { label: 'Size', value: formatBytes(download.size) },
              { label: 'ETA', value: formatETA(download.eta) },
              {
                label: 'Down',
                value: <span className="text-green-400">{formatSpeed(download.downloadSpeed)}</span>,
              },
              {
                label: 'Up',
                value: <span className="text-blue-400">{formatSpeed(download.uploadSpeed)}</span>,
              },
            ]}
            actions={
              <>
                {isPaused(download.state) ? (
                  <MobileCardButton onClick={() => onResume(download.hash)} variant="primary">
                    Resume
                  </MobileCardButton>
                ) : (
                  <MobileCardButton onClick={() => onPause(download.hash)}>Pause</MobileCardButton>
                )}
                <MobileCardButton onClick={() => onImport(download)} disabled={!!download.gameId}>
                  Import
                </MobileCardButton>
                <MobileCardButton onClick={() => onDelete(download)} variant="danger">
                  Delete
                </MobileCardButton>
              </>
            }
          />
        );
      })}
    </div>
  );
}

export default ActivityMobileView;
