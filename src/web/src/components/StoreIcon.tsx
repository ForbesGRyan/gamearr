export interface GameStoreInfo {
  name: string;
  slug: string;
  storeGameId?: string | null;
}

interface StoreIconProps {
  /** Single store name (legacy) or slug */
  store?: string | null | undefined;
  /** Array of store info objects (preferred) */
  stores?: GameStoreInfo[];
  className?: string;
}

const storeConfig: Record<
  string,
  { name: string; bgColor: string; textColor: string; shortName: string }
> = {
  steam: {
    name: 'Steam',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    shortName: 'Steam',
  },
  epic: {
    name: 'Epic Games',
    bgColor: 'bg-gray-800',
    textColor: 'text-white',
    shortName: 'Epic',
  },
  'epic games': {
    name: 'Epic Games',
    bgColor: 'bg-gray-800',
    textColor: 'text-white',
    shortName: 'Epic',
  },
  gog: {
    name: 'GOG',
    bgColor: 'bg-purple-600',
    textColor: 'text-white',
    shortName: 'GOG',
  },
  origin: {
    name: 'Origin',
    bgColor: 'bg-orange-600',
    textColor: 'text-white',
    shortName: 'Origin',
  },
  ea: {
    name: 'EA App',
    bgColor: 'bg-orange-600',
    textColor: 'text-white',
    shortName: 'EA',
  },
  ubisoft: {
    name: 'Ubisoft Connect',
    bgColor: 'bg-indigo-600',
    textColor: 'text-white',
    shortName: 'Ubisoft',
  },
  'ubisoft connect': {
    name: 'Ubisoft Connect',
    bgColor: 'bg-indigo-600',
    textColor: 'text-white',
    shortName: 'Ubisoft',
  },
  other: {
    name: 'Other',
    bgColor: 'bg-gray-600',
    textColor: 'text-white',
    shortName: 'Other',
  },
};

function StoreIcon({ store, stores, className = '' }: StoreIconProps) {
  // Prefer stores array if provided
  if (stores && stores.length > 0) {
    return (
      <span className="inline-flex items-center gap-1">
        {stores.map((storeInfo, index) => {
          const slugLower = storeInfo.slug.toLowerCase();
          const config = storeConfig[slugLower] || storeConfig.other;
          return (
            <span
              key={storeInfo.slug + index}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
              title={storeInfo.name}
            >
              {config.shortName}
            </span>
          );
        })}
      </span>
    );
  }

  // Fallback to legacy store string
  if (!store) {
    return null;
  }

  // Handle multiple comma-separated stores (legacy)
  const storeList = store.split(',').map(s => s.trim());

  return (
    <span className="inline-flex items-center gap-1">
      {storeList.map((storeName, index) => {
        const storeLower = storeName.toLowerCase();
        const config = storeConfig[storeLower] || storeConfig.other;
        return (
          <span
            key={index}
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
            title={config.name}
          >
            {config.shortName}
          </span>
        );
      })}
    </span>
  );
}

export default StoreIcon;
