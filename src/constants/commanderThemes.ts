export const CUSTOM_THEME_ID = -1
export const CUSTOM_THEME_NAME = 'Custom Theme'

export function createCustomTheme(score = 0) {
  return {
    theme_id: CUSTOM_THEME_ID,
    name: CUSTOM_THEME_NAME,
    curated: true,
    score,
  }
}

export function isCustomThemeId(themeId: number | null | undefined): boolean {
  return themeId === CUSTOM_THEME_ID
}
