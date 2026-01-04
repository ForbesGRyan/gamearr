interface StoreIconProps {
  store: string | null | undefined;
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

function StoreIcon({ store, className = '' }: StoreIconProps) {
  if (!store) {
    return null;
  }

  const storeLower = store.toLowerCase();
  const config = storeConfig[storeLower] || storeConfig.other;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
      title={config.name}
    >
      {config.shortName}
    </span>
  );
}

export default StoreIcon;
