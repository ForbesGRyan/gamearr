interface StoreSelectorProps {
  value: string[];
  onChange: (stores: string[]) => void;
  label?: string;
}

export const AVAILABLE_STORES = [
  { value: 'Steam', label: 'Steam' },
  { value: 'Epic Games', label: 'Epic Games' },
  { value: 'GOG', label: 'GOG' },
  { value: 'Origin', label: 'Origin' },
  { value: 'Ubisoft Connect', label: 'Ubisoft Connect' },
  { value: 'Other', label: 'Other' },
];

function StoreSelector({ value, onChange, label = 'Digital Stores' }: StoreSelectorProps) {
  const toggleStore = (storeName: string) => {
    if (value.includes(storeName)) {
      onChange(value.filter((s) => s !== storeName));
    } else {
      onChange([...value, storeName]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_STORES.map((store) => {
          const isSelected = value.includes(store.value);
          return (
            <button
              key={store.value}
              type="button"
              onClick={() => toggleStore(store.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {store.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StoreSelector;
