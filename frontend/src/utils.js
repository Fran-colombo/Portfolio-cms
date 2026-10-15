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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function emptyToNull(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function displayHost(url) {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function groupByCategory(pages) {
  const groups = new Map();
  for (const page of pages) {
    const key = page.category || 'General';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(page);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
}
