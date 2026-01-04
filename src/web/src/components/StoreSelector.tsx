interface StoreSelectorProps {
  value: string | null;
  onChange: (store: string | null) => void;
  label?: string;
}

const stores = [
  { value: '', label: 'None' },
  { value: 'Steam', label: 'Steam' },
  { value: 'Epic Games', label: 'Epic Games' },
  { value: 'GOG', label: 'GOG' },
  { value: 'Origin', label: 'Origin' },
  { value: 'Ubisoft Connect', label: 'Ubisoft Connect' },
  { value: 'Other', label: 'Other' },
];

function StoreSelector({ value, onChange, label = 'Store' }: StoreSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {stores.map((store) => (
          <option key={store.value} value={store.value}>
            {store.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default StoreSelector;
