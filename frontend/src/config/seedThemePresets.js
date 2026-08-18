import { THEME_PRESETS } from './themePresets';
export function seedThemePresets() {
  return THEME_PRESETS.map((p, i) => ({
    id:`preset-${p.slug}`,
    name:p.name, nameEn:p.nameEn,
    description:p.description,
    slug:p.slug,
    theme:p.theme,
    isActive:i===0,
    sortOrder:i,
    createdAt:'2024-01-01T00:00:00Z',
    updatedAt:'2024-01-01T00:00:00Z',
    _id:`preset-${p.slug}`
  }));
}
