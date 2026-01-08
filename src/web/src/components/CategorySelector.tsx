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

  // Get the parent category ID for a given category (e.g., 4050 -> 4000)
  const getParentId = (categoryId: number): number => {
    return Math.floor(categoryId / 1000) * 1000;
  };

  // Check if a category is a parent (ends in 000)
  const isParentCategory = (categoryId: number): boolean => {
    return categoryId % 1000 === 0;
  };

  // Get all subcategory IDs for a parent within a group
  const getSubcategoryIds = (parentId: number, group: CategoryGroup): number[] => {
    return group.categories
      .filter((cat) => !isParentCategory(cat.id) && getParentId(cat.id) === parentId)
      .map((cat) => cat.id);
  };

  // Find which group a category belongs to
  const findGroupForCategory = (categoryId: number): CategoryGroup | undefined => {
    return categoryGroups.find((group) =>
      group.categories.some((cat) => cat.id === categoryId)
    );
  };

  // Check if a category should appear selected (either directly or via parent)
  const isCategoryEffectivelySelected = (categoryId: number): boolean => {
    if (selectedCategories.includes(categoryId)) return true;
    // Check if parent is selected
    const parentId = getParentId(categoryId);
    return selectedCategories.includes(parentId);
  };

  const toggleCategory = (categoryId: number) => {
    const group = findGroupForCategory(categoryId);
    if (!group) return;

    setSelectedCategories((prev) => {
      const isCurrentlySelected = prev.includes(categoryId);
      const parentId = getParentId(categoryId);
      const isParent = isParentCategory(categoryId);

      if (isParent) {
        // Toggling a parent category
        const subcategoryIds = getSubcategoryIds(categoryId, group);
        if (isCurrentlySelected) {
          // Unselect parent and all subcategories
          return prev.filter((id) => id !== categoryId && !subcategoryIds.includes(id));
        } else {
          // Select parent and all subcategories (for visual feedback)
          const newSelected = prev.filter((id) => !subcategoryIds.includes(id));
          return [...newSelected, categoryId, ...subcategoryIds];
        }
      } else {
        // Toggling a subcategory
        const parentSelected = prev.includes(parentId);

        if (parentSelected) {
          // Parent is selected - unselect parent and toggle this subcategory off
          // Add all other subcategories that were implicitly selected
          const subcategoryIds = getSubcategoryIds(parentId, group);
          const otherSubcategories = subcategoryIds.filter((id) => id !== categoryId);
          return [...prev.filter((id) => id !== parentId), ...otherSubcategories];
        } else {
          // Normal toggle
          if (isCurrentlySelected) {
            return prev.filter((id) => id !== categoryId);
          } else {
            return [...prev, categoryId];
          }
        }
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
              const isSelected = isCategoryEffectivelySelected(category.id);
              const isParent = isParentCategory(category.id);

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
