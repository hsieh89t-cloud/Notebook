import { describe, it, expect } from 'vitest';
import {
  normalizeList,
  normalizeItem,
  anyId,
  parseDateNum,
  nowTaipeiStr,
  extractMetaFromContent,
} from '../scripts/notebook-utils.js';

describe('normalizeList', () => {
  it('returns arrays untouched', () => {
    const list = [1, 2, 3];
    expect(normalizeList(list)).toBe(list);
  });

  it('supports wrapped payloads', () => {
    expect(normalizeList({ items: [1] })).toEqual([1]);
    expect(normalizeList({ data: [2] })).toEqual([2]);
    expect(normalizeList({ rows: [3] })).toEqual([3]);
  });

  it('falls back to empty array', () => {
    expect(normalizeList(null)).toEqual([]);
    expect(normalizeList({})).toEqual([]);
  });
});

describe('normalizeItem', () => {
  it('unwraps single item containers', () => {
    expect(normalizeItem({ item: { id: 1 } })).toEqual({ id: 1 });
    expect(normalizeItem({ data: { id: 2 } })).toEqual({ id: 2 });
  });

  it('returns primitives unchanged', () => {
    expect(normalizeItem(null)).toBeNull();
    expect(normalizeItem({ id: 3 })).toEqual({ id: 3 });
  });
});

describe('anyId', () => {
  it('picks up id variants', () => {
    expect(anyId({ id: 'abc' })).toBe('abc');
    expect(anyId({ noteId: '123' })).toBe('123');
    expect(anyId({ 筆記ID: '456' })).toBe('456');
  });
});

describe('parseDateNum', () => {
  it('parses ISO strings', () => {
    const value = parseDateNum('2024-01-01T00:00:00');
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThan(0);
  });

  it('parses zh-TW patterns', () => {
    const value = parseDateNum('2024/01/01 12:34:56');
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThan(0);
  });

  it('returns -1 for invalid dates', () => {
    expect(parseDateNum('not-a-date')).toBe(-1);
  });
});

describe('nowTaipeiStr', () => {
  it('formats provided date in Taipei timezone', () => {
    const base = new Date('2024-01-01T00:00:00Z');
    expect(nowTaipeiStr(base)).toBe('2024-01-01 08:00:00');
  });
});

describe('extractMetaFromContent', () => {
  it('extracts title, category and tags', () => {
    const text = '標題：專案\n分類：工作\n標籤：重要,待辦\n內容';
    expect(extractMetaFromContent(text)).toEqual({
      title: '專案',
      category: '工作',
      tags: '重要,待辦',
      autoTitle: '專案',
    });
  });

  it('falls back to first 8 characters when no title', () => {
    const text = '沒有標題只有內容';
    expect(extractMetaFromContent(text)).toEqual({
      title: '',
      category: '',
      tags: '',
      autoTitle: '沒有標題只有內容',
    });
  });
});
