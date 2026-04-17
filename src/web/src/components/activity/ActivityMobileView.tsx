import { Download } from '../../api/client';
import { MobileCard, MobileCardButton } from '../MobileCard';
import { formatBytes, formatSpeed, formatETA } from '../../utils/formatters';
import { getStatusInfo, isPaused, getDownloadId } from './types';

interface ActivityMobileViewProps {
  downloads: Download[];
  onPause: (id: string, client: 'qbittorrent' | 'sabnzbd') => void;
  onResume: (id: string, client: 'qbittorrent' | 'sabnzbd') => void;
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
        const statusInfo = getStatusInfo(download);
        const dlId = getDownloadId(download);
        const fields = [
          { label: 'Size', value: formatBytes(download.size) },
          { label: 'ETA', value: formatETA(download.eta) },
          {
            label: 'Down',
            value: <span className="text-green-400">{formatSpeed(download.downloadSpeed)}</span>,
          },
        ];
        if (download.client === 'qbittorrent') {
          fields.push({
            label: 'Up',
            value: <span className="text-blue-400">{formatSpeed(download.uploadSpeed || 0)}</span>,
          });
        }
        if (download.client === 'sabnzbd') {
          fields.push({
            label: 'Client',
            value: <span className="text-purple-400">SABnzbd</span>,
          });
        }
        return (
          <MobileCard
            key={dlId}
            title={download.name}
            status={statusInfo}
            progress={download.progress * 100}
            fields={fields}
            actions={
              <>
                {isPaused(download) ? (
                  <MobileCardButton onClick={() => onResume(dlId, download.client)} variant="primary">
                    Resume
                  </MobileCardButton>
                ) : (
                  <MobileCardButton onClick={() => onPause(dlId, download.client)}>Pause</MobileCardButton>
                )}
                {download.client === 'qbittorrent' && (
                  <MobileCardButton onClick={() => onImport(download)} disabled={!!download.gameId}>
                    Import
                  </MobileCardButton>
                )}
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
