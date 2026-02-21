/**
 * @param {string} key
 * @param {string} fallback
 * @param {string|string[]|undefined} substitutions
 * @param {(key: string, substitutions?: string|string[]) => string} [messageGetter]
 */
export function translateMessage(key, fallback, substitutions = undefined, messageGetter = undefined) {
  const getter =
    messageGetter ||
    (typeof chrome !== "undefined" && chrome.i18n?.getMessage
      ? chrome.i18n.getMessage.bind(chrome.i18n)
      : null);
  if (getter) {
    const translated = getter(key, substitutions);
    if (translated) {
      return translated;
    }
  }
  return fallback || key;
}

/**
 * @param {string} key
 * @param {string} fallback
 * @param {string|string[]} [substitutions]
 */
export function t(key, fallback, substitutions = undefined) {
  return translateMessage(key, fallback, substitutions);
}
