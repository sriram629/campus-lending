export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function body(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Send a JSON object.');
  return value;
}

export function text(data, key, max = 120) {
  if (typeof data[key] !== 'string' || !data[key].trim() || data[key].trim().length > max) {
    fail(400, `${key.replaceAll('_', ' ')} must contain 1–${max} characters.`);
  }
  return data[key].trim();
}

export function id(value) {
  if (typeof value === 'boolean' || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    fail(400, 'Record IDs must be positive whole numbers.');
  }
  return Number(value);
}

export function ids(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) fail(400, 'Select between 1 and 20 items.');
  const result = value.map(id);
  if (new Set(result).size !== result.length) fail(400, 'An item cannot be selected twice.');
  return result.sort((a, b) => a - b);
}

export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Enter a valid date.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (value < '1000-01-01' || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(400, 'Enter a valid date.');
  }
  return value;
}

export function notes(value = '') {
  if (typeof value !== 'string' || value.length > 1000) fail(400, 'Notes must contain at most 1000 characters.');
  return value.trim();
}
