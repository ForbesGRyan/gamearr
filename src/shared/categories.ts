// Prowlarr/Torznab/Newznab Category Definitions
// Based on the standard Torznab/Newznab categories

export interface Category {
  id: number;
  name: string;
  description: string;
}

// PC Categories (4000+)
export const PC_CATEGORIES: Category[] = [
  {
    id: 4000,
    name: 'PC (All)',
    description: 'All PC content (includes all subcategories)',
  },
  {
    id: 4010,
    name: 'PC/0day',
    description: 'PC software releases',
  },
  {
    id: 4020,
    name: 'PC/ISO',
    description: 'PC ISO files',
  },
  {
    id: 4030,
    name: 'PC/Mac',
    description: 'Mac software and games',
  },
  {
    id: 4040,
    name: 'PC/Mobile-Other',
    description: 'Other mobile content',
  },
  {
    id: 4050,
    name: 'PC/Games',
    description: 'PC games (recommended)',
  },
  {
    id: 4060,
    name: 'PC/Mobile-iOS',
    description: 'iOS apps and games',
  },
  {
    id: 4070,
    name: 'PC/Mobile-Android',
    description: 'Android apps and games',
  },
];

// Console Categories (1000+)
export const CONSOLE_CATEGORIES: Category[] = [
  {
    id: 1000,
    name: 'Console (All)',
    description: 'All console content',
  },
  {
    id: 1010,
    name: 'Console/NDS',
    description: 'Nintendo DS',
  },
  {
    id: 1020,
    name: 'Console/PSP',
    description: 'PlayStation Portable',
  },
  {
    id: 1030,
    name: 'Console/Wii',
    description: 'Nintendo Wii',
  },
  {
    id: 1040,
    name: 'Console/Xbox',
    description: 'Xbox',
  },
  {
    id: 1050,
    name: 'Console/Xbox 360',
    description: 'Xbox 360',
  },
  {
    id: 1060,
    name: 'Console/Wii U',
    description: 'Nintendo Wii U',
  },
  {
    id: 1070,
    name: 'Console/Xbox One',
    description: 'Xbox One',
  },
  {
    id: 1080,
    name: 'Console/PS3',
    description: 'PlayStation 3',
  },
  {
    id: 1090,
    name: 'Console/PS4',
    description: 'PlayStation 4',
  },
  {
    id: 1110,
    name: 'Console/3DS',
    description: 'Nintendo 3DS',
  },
  {
    id: 1120,
    name: 'Console/PS Vita',
    description: 'PlayStation Vita',
  },
  {
    id: 1130,
    name: 'Console/Switch',
    description: 'Nintendo Switch',
  },
  {
    id: 1140,
    name: 'Console/Xbox Series X',
    description: 'Xbox Series X/S',
  },
  {
    id: 1180,
    name: 'Console/PS5',
    description: 'PlayStation 5',
  },
];

// All available categories
export const ALL_CATEGORIES: Category[] = [
  ...PC_CATEGORIES,
  ...CONSOLE_CATEGORIES,
];

// Default categories (PC Games only)
export const DEFAULT_CATEGORIES = [4050];

// Get category by ID
export function getCategoryById(id: number): Category | undefined {
  return ALL_CATEGORIES.find((cat) => cat.id === id);
}

// Get category name by ID
export function getCategoryName(id: number): string {
  const category = getCategoryById(id);
  return category ? category.name : `Category ${id}`;
}

// Category groups for UI
export const CATEGORY_GROUPS = [
  {
    name: 'PC',
    categories: PC_CATEGORIES,
  },
  {
    name: 'Console',
    categories: CONSOLE_CATEGORIES,
  },
];
