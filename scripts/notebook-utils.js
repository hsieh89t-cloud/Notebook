export function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Object.prototype.hasOwnProperty.call(data, 'data')) {
    return normalizeList(data.data);
  }
  return (
    data.items ||
    data.list ||
    data.records ||
    data.rows ||
    data.notes ||
    []
  );
}

export function normalizeItem(data) {
  if (!data) return data;
  if (data.item) return data.item;
  if (data.data && !Array.isArray(data.data)) return data.data;
  return data;
}

export function anyId(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();
    if (lower === 'id' || lower.endsWith('id')) return obj[key];
    if (/筆記.*id/i.test(key) || /note.*id/i.test(key)) return obj[key];
  }
  return obj.id;
}

export function parseDateNum(value) {
  if (!value) return -1;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  const match = String(value).match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})[ T]?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hour = Number(match[4] || '0');
    const minute = Number(match[5] || '0');
    const second = Number(match[6] || '0');
    return new Date(year, month, day, hour, minute, second).getTime();
  }
  return -1;
}

export function fmtDate(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/.test(trimmed)) {
      return trimmed.replace(/-/g, '/');
    }
  }
  try {
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('zh-TW', { hour12: false });
    }
  } catch (error) {
    // ignore and fall back to raw string
  }
  return typeof input === 'string' ? input : '';
}

export function nowTaipeiStr(baseDate = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const formatted = formatter.format(baseDate);
    const match = formatted.match(/(\d{4})[\/年\-](\d{2})[\/月\-](\d{2}).(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
    }
  } catch (error) {
    // ignore and fall back to manual conversion
  }
  const utcYear = baseDate.getUTCFullYear();
  const utcMonth = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(baseDate.getUTCDate()).padStart(2, '0');
  const hours = String((baseDate.getUTCHours() + 8) % 24).padStart(2, '0');
  const minutes = String(baseDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(baseDate.getUTCSeconds()).padStart(2, '0');
  return `${utcYear}-${utcMonth}-${utcDay} ${hours}:${minutes}:${seconds}`;
}

export function nowSheetStr(baseDate = new Date()) {
  return nowTaipeiStr(baseDate).replace(/-/g, '/');
}

export function extractMetaFromContent(text = '') {
  const meta = { title: '', category: '', tags: '', autoTitle: '' };
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const titleMatch = line.match(/^(?:標題|title)\s*[：: ]\s*(.+)$/i);
    if (titleMatch && !meta.title) {
      meta.title = titleMatch[1].trim();
      continue;
    }
    const categoryMatch = line.match(/^(?:分類|category)\s*[：: ]\s*(.+)$/i);
    if (categoryMatch && !meta.category) {
      meta.category = categoryMatch[1].trim();
      continue;
    }
    const tagsMatch = line.match(/^(?:標籤|tags?)\s*[：: ]\s*(.+)$/i);
    if (tagsMatch && !meta.tags) {
      meta.tags = tagsMatch[1].trim();
      continue;
    }
  }
  const fallback = lines.join('').replace(/\s+/g, '').slice(0, 8) || '（無標題）';
  meta.autoTitle = meta.title || fallback;
  return meta;
}

export default {
  normalizeList,
  normalizeItem,
  anyId,
  parseDateNum,
  fmtDate,
  nowTaipeiStr,
  nowSheetStr,
  extractMetaFromContent,
};
