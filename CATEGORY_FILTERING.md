# Category Filtering Feature - Complete! ✅

## Overview
Added comprehensive category filtering system for Prowlarr searches, allowing users to select which categories (PC Games, Console Games, etc.) to include in their searches.

---

## ✅ Backend Implementation

### 1. Category Definitions (`src/shared/categories.ts`)

**Available Categories:**
- **PC Categories (4000+):**
  - 4000: PC (All)
  - 4010: PC/0day
  - 4020: PC/ISO
  - 4030: PC/Mac
  - 4040: PC/Mobile-Other
  - **4050: PC/Games** (Default)
  - 4060: PC/Mobile-iOS
  - 4070: PC/Mobile-Android

- **Console Categories (1000+):**
  - 1000: Console (All)
  - 1010: NDS
  - 1020: PSP
  - 1030: Wii
  - 1040: Xbox
  - 1050: Xbox 360
  - 1060: Wii U
  - 1070: Xbox One
  - 1080: PS3
  - 1090: PS4
  - 1110: 3DS
  - 1120: PS Vita
  - 1130: Nintendo Switch
  - 1140: Xbox Series X/S
  - 1180: PS5

### 2. Settings Management

**SettingsRepository.ts**
- `get(key)` - Get setting value
- `getJSON<T>(key)` - Get setting as parsed JSON
- `set(key, value)` - Set setting value
- `setJSON(key, value)` - Set setting as JSON
- `delete(key)` - Delete setting
- `getAll()` - Get all settings

**SettingsService.ts**
- `getProwlarrCategories()` - Get selected categories (defaults to [4050])
- `setProwlarrCategories(categories)` - Save selected categories
- `getSetting(key)` / `setSetting(key, value)` - Generic setting management
- `getAllSettings()` - Get all settings (hides sensitive values)

### 3. API Endpoints (`src/server/routes/settings.ts`)

**New Endpoints:**
- `GET /api/v1/settings` - Get all settings
- `PUT /api/v1/settings` - Update settings
- `GET /api/v1/settings/categories` - Get available categories and groups
- `GET /api/v1/settings/categories/selected` - Get currently selected categories
- `PUT /api/v1/settings/categories` - Update selected categories

**Features:**
- Validation of category IDs
- Default to PC/Games (4050) if not configured
- Grouped categories for UI display

### 4. IndexerService Integration

**Updated Methods:**
- `searchForGame()` - Uses configured categories instead of hardcoded
- `manualSearch()` - Uses configured categories instead of hardcoded

**How It Works:**
```typescript
// Before (hardcoded):
categories: [4050]

// After (dynamic from database):
const categories = await settingsService.getProwlarrCategories();
categories: categories
```

---

## ✅ Frontend Implementation

### 1. CategorySelector Component (`src/web/src/components/CategorySelector.tsx`)

**Features:**
- Displays all available categories grouped by type (PC/Console)
- Checkbox selection for each category
- Shows category ID and description
- Highlights parent categories (that include all subcategories)
- Visual feedback for selected categories
- Save/Reset buttons
- Shows count of selected categories
- Success/error messages

**UI Elements:**
- Color-coded selected categories (blue highlight)
- Parent category badges (purple "Includes all subcategories")
- Category IDs displayed for reference
- Helpful descriptions for each category

### 2. Settings Page Integration

Added CategorySelector component between Prowlarr settings and Indexer Status sections.

### 3. API Client Updates (`src/web/src/api/client.ts`)

**New Methods:**
- `getSettings()` - Fetch all settings
- `updateSettings(settings)` - Update settings
- `getCategories()` - Get available categories
- `getSelectedCategories()` - Get current selection
- `updateCategories(categories)` - Save category selection

---

## 🎯 Features Delivered

### User-Facing Features:
1. ✅ Select multiple categories for searches
2. ✅ Visual category browser with descriptions
3. ✅ Parent categories (e.g., "Console (All)") include subcategories
4. ✅ Default to PC/Games only
5. ✅ Persistent category preferences (stored in database)
6. ✅ Real-time save/reset functionality
7. ✅ Clear visual feedback

### Technical Features:
1. ✅ Database-backed settings storage
2. ✅ Torznab/Newznab standard category IDs
3. ✅ Validation of category selections
4. ✅ Default fallback to PC/Games
5. ✅ RESTful API for category management
6. ✅ Shared category definitions (backend + frontend)

---

## 📁 Files Created/Modified

**New Files:**
```
src/shared/categories.ts
src/server/repositories/SettingsRepository.ts
src/server/services/SettingsService.ts
src/web/src/components/CategorySelector.tsx
```

**Modified Files:**
```
src/server/routes/settings.ts (fully implemented)
src/server/services/IndexerService.ts (use dynamic categories)
src/web/src/api/client.ts (added settings methods)
src/web/src/pages/Settings.tsx (added CategorySelector)
```

---

## 🎨 UI/UX Highlights

### Visual Design:
1. **Grouped Display** - Categories organized by type (PC/Console)
2. **Color Coding:**
   - Selected: Blue background with blue border
   - Unselected: Gray background
   - Hover: Lighter gray
3. **Information Badges:**
   - Purple badge for parent categories
   - Gray tag for category IDs
4. **Status Messages:**
   - Green for success
   - Red for errors
5. **Interactive Feedback:**
   - Disabled state for save button
   - Loading states
   - Selection counter

### User Experience:
1. **Smart Defaults** - PC/Games (4050) selected by default
2. **Clear Descriptions** - Each category explains what it includes
3. **Easy Selection** - Click anywhere on the card to toggle
4. **Reset Option** - Quickly revert changes
5. **Validation** - Requires at least one category

---

## 🔧 Configuration

### Default Configuration:
```json
{
  "prowlarr_categories": [4050]
}
```

### Example Multi-Category Setup:
```json
{
  "prowlarr_categories": [4050, 1130, 1140, 1180]
}
```
This would search:
- PC/Games (4050)
- Nintendo Switch (1130)
- Xbox Series X/S (1140)
- PlayStation 5 (1180)

---

## 📊 Category ID Reference

### Most Common Game Categories:
- **4050** - PC Games (Default, Recommended)
- **1130** - Nintendo Switch
- **1140** - Xbox Series X/S
- **1180** - PlayStation 5
- **1090** - PlayStation 4
- **1070** - Xbox One

### Parent Categories (Include All Subcategories):
- **4000** - All PC content
- **1000** - All Console content

---

## 🚀 How Users Configure Categories

1. **Navigate to Settings** page
2. **Scroll to "Search Categories"** section
3. **Review available categories** grouped by type
4. **Check/uncheck categories** to include/exclude
5. **Click "Save Categories"** button
6. **Categories are now used** for all searches

### Tips:
- Select **parent categories** (e.g., 4000) to include all subcategories
- Select **specific categories** (e.g., 4050) for focused searches
- Select **multiple platforms** if you have multi-platform indexers
- **At least one category** must be selected

---

## 🔄 How It Works

### Search Flow:
1. User initiates search (game card or manual search)
2. Backend calls `settingsService.getProwlarrCategories()`
3. Database returns saved category IDs (or default [4050])
4. Prowlarr search includes these categories in the API call
5. Only matching content is returned

### Category Filtering:
```
Without filtering:
├── PC Games ✓
├── TV Shows ✗ (returned but unwanted)
├── Movies ✗ (returned but unwanted)
└── Books ✗ (returned but unwanted)

With category filtering (4050):
└── PC Games only ✓
```

---

## ⚠️ Important Notes

1. **Category Support Varies:**
   - Not all indexers support all categories
   - Some indexers may not respect category filters
   - Results depend on indexer capabilities

2. **Parent Categories:**
   - Selecting "PC (All)" (4000) includes ALL PC subcategories
   - May return software, ISOs, etc., not just games

3. **Console Categories:**
   - Useful if you want ROM/ISO downloads
   - Different indexers specialize in different platforms

4. **Persistence:**
   - Category preferences are saved to the database
   - Persists across server restarts
   - Global setting (applies to all searches)

---

## 📚 References

Category IDs follow the Torznab/Newznab standard:
- [Categories - Newznab API](https://inhies.github.io/Newznab-API/categories/)
- [Prowlarr Search | Servarr Wiki](https://wiki.servarr.com/prowlarr/search)
- [Torznab Specification](https://torznab.github.io/spec-1.3-draft/torznab/Specification-v1.3.html)

---

**Category Filtering: ✅ COMPLETE**

Users now have full control over which content types appear in their search results!
