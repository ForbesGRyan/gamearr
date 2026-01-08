import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

interface Category {
  id: number;
  name: string;
  description: string;
}

interface CategoryGroup {
  name: string;
  categories: Category[];
}

function CategorySelector() {
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCategories();

    // Cleanup timeout on unmount
    return () => {
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
    };
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load available categories
      const categoriesResponse = await api.getCategories();
      if (categoriesResponse.success && categoriesResponse.data) {
        setCategoryGroups(categoriesResponse.data.groups);
      }

      // Load selected categories
      const selectedResponse = await api.getSelectedCategories();
      if (selectedResponse.success && selectedResponse.data) {
        setSelectedCategories(selectedResponse.data);
      }
    } catch (err) {
      setError('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await api.updateCategories(selectedCategories);
      if (response.success) {
        setSaveMessage('Categories saved successfully!');
        // Clear any existing timeout before setting a new one
        if (saveMessageTimeoutRef.current) {
          clearTimeout(saveMessageTimeoutRef.current);
        }
        saveMessageTimeoutRef.current = setTimeout(() => setSaveMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
      } else {
        setError(response.error || 'Failed to save categories');
      }
    } catch (err) {
      setError('Failed to save categories');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    loadCategories();
    setSaveMessage(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Search Categories</h3>
        <p className="text-gray-400">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-2">Search Categories</h3>
      <p className="text-gray-400 mb-4 text-sm">
        Select which categories to include when searching for game releases. By default, only PC Games (4050) is selected.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="mb-4 p-3 bg-green-900 bg-opacity-50 border border-green-700 rounded text-green-200 text-sm">
          {saveMessage}
        </div>
      )}

      {categoryGroups.map((group) => (
        <div key={group.name} className="mb-6">
          <h4 className="text-lg font-semibold mb-3 text-blue-400">{group.name}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {group.categories.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              const isParent = category.id % 1000 === 0; // Parent categories end in 000

              return (
                <label
                  key={category.id}
                  className={`flex items-start p-3 rounded cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-900 bg-opacity-30 border border-blue-700'
                      : 'bg-gray-700 hover:bg-gray-650'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCategory(category.id)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                        {category.name}
                      </span>
                      <span className="text-xs text-gray-500">({category.id})</span>
                      {isParent && (
                        <span className="text-xs bg-purple-700 px-2 py-0.5 rounded">
                          Includes all subcategories
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{category.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={handleSave}
          disabled={isSaving || selectedCategories.length === 0}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Categories'}
        </button>
        <button
          onClick={handleReset}
          disabled={isSaving}
          className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded transition disabled:opacity-50"
        >
          Reset
        </button>
        <div className="flex-1 text-right text-sm text-gray-400 self-center">
          {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
        </div>
      </div>
    </div>
  );
}

export default CategorySelector;
