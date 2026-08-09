/**
 * Truncates text cleanly at word boundaries instead of cutting off mid-word.
 * E.g., "All values within reference ranges" at limit 20
 * returns "All values within..." instead of "All values within ref..."
 *
 * @param {string} text - The input text.
 * @param {number} [maxLength=70] - Maximum desired character length.
 * @param {string} [ellipsis='...'] - Ellipsis string to append.
 * @returns {string} Truncated string at the last complete word.
 */
export function truncateAtWordBoundary(text, maxLength = 70, ellipsis = '...') {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const slice = trimmed.slice(0, maxLength);
  const lastSpaceIndex = slice.lastIndexOf(' ');

  if (lastSpaceIndex > 0) {
    const cleanWords = slice.slice(0, lastSpaceIndex).replace(/[,;:\s.]+$/, '');
    return `${cleanWords}${ellipsis}`;
  }

  return `${slice.trim()}${ellipsis}`;
}

/**
 * Formats a canonical database report ID consistently across all screens.
 * E.g., formatReportId(4) -> "#RPT-0004"
 *
 * @param {number|string} id - The underlying integer database report ID.
 * @returns {string} The canonical formatted report ID string.
 */
export function formatReportId(id) {
  if (id === null || id === undefined) return '—';
  return `#RPT-${String(id).padStart(4, '0')}`;
}

