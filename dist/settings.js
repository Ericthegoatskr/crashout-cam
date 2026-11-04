export const SETTINGS_KEY = 'crashout-settings-v2';

// Migrate sensitivity preferences, but retire the old forced switch delay.
export function restoreSettings(defaults, saved = {}, legacy = {}) {
  const config = structuredClone(defaults);
  const preferences = { ...legacy, ...saved };
  for (const key of ['smileThreshold', 'jawThreshold']) {
    if (Number.isFinite(preferences[key]) && preferences[key] >= 0.2 && preferences[key] <= 0.8) config[key] = preferences[key];
  }
  if ([0, 150, 300, 500].includes(saved?.holdMs)) config.holdMs = saved.holdMs;
  return config;
}
