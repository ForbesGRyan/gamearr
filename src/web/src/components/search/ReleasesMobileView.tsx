import { Release } from '../../api/client';
import { MobileCard, MobileCardButton } from '../MobileCard';
import { formatBytes, formatRelativeDate } from '../../utils/formatters';

// Common Prowlarr category mappings
const CATEGORY_NAMES: Record<number, string> = {
  4000: 'PC',
  4010: 'PC/0day',
  4020: 'PC/ISO',
  4030: 'PC/Mac',
  4040: 'PC/iOS',
  4050: 'PC/Android',
  4060: 'PC/Games',
  1000: 'Console',
  1010: 'Console/NDS',
  1020: 'Console/PSP',
  1030: 'Console/Wii',
  1040: 'Console/Xbox',
  1050: 'Console/Xbox 360',
  1060: 'Console/Wiiware',
  1070: 'Console/Xbox One',
  1080: 'Console/PS3',
  1090: 'Console/PS4',
  1100: 'Console/PSVita',
  1110: 'Console/Switch',
  1120: 'Console/PS5',
  1130: 'Console/Xbox X',
};

function getCategoryName(categories?: number[]): string {
  if (!categories || categories.length === 0) return '-';
  for (const cat of categories) {
    if (CATEGORY_NAMES[cat]) {
      return CATEGORY_NAMES[cat];
    }
  }
  return `Cat: ${categories[0]}`;
}

function getSeederStatus(seeders: number): { label: string; color: 'green' | 'yellow' | 'red' } {
  if (seeders >= 20) {
    return { label: `${seeders} seeders`, color: 'green' };
  } else if (seeders >= 5) {
    return { label: `${seeders} seeders`, color: 'yellow' };
  }
  return { label: `${seeders} seeders`, color: 'red' };
}

interface ReleasesMobileViewProps {
  releases: Release[];
  onGrab: (release: Release) => void;
}

function ReleasesMobileView({ releases, onGrab }: ReleasesMobileViewProps) {
  return (
    <div className="md:hidden space-y-3">
      {releases.map((release) => {
        const seederStatus = getSeederStatus(release.seeders);
        return (
          <MobileCard
            key={release.guid}
            title={release.title}
            subtitle={release.indexer}
            status={seederStatus}
            fields={[
              { label: 'Size', value: formatBytes(release.size) },
              { label: 'Category', value: getCategoryName(release.categories) },
              { label: 'Age', value: formatRelativeDate(release.publishedAt) },
              {
                label: 'Quality',
                value: release.quality || '-',
              },
            ]}
            actions={
              <MobileCardButton onClick={() => onGrab(release)} variant="primary">
                Grab
              </MobileCardButton>
            }
          />
        );
      })}
    </div>
  );
}

export default ReleasesMobileView;
