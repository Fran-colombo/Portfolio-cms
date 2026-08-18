export function linesToArray(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function emptyToNull(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
