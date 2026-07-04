import { weekStartOf } from '@/core/utils/date';

describe('weekStartOf', () => {
  it('should return Monday 00:00:00 local time', () => {
    const monday = new Date(2024, 0, 8, 15, 30, 45); // Mon Jan 8, 2024 3:30:45 PM
    const result = new Date(weekStartOf(monday.getTime()));

    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('should map Monday to same Monday', () => {
    const monday = new Date(2024, 0, 8, 10, 0, 0); // Mon Jan 8, 2024
    const result = weekStartOf(monday.getTime());
    const resultDate = new Date(result);

    expect(resultDate.getDay()).toBe(1);
    expect(resultDate.toDateString()).toBe(monday.toDateString());
  });

  it('should map Sunday to previous Monday', () => {
    const sunday = new Date(2024, 0, 7, 10, 0, 0); // Sun Jan 7, 2024
    const result = weekStartOf(sunday.getTime());
    const resultDate = new Date(result);

    expect(resultDate.getDay()).toBe(1); // Monday
    expect(resultDate.getDate()).toBe(1); // Jan 1, 2024 is Monday
  });

  it('should map Tuesday through Saturday to same week Monday', () => {
    const monday = new Date(2024, 0, 8, 0, 0, 0); // Mon Jan 8, 2024
    const mondayMs = weekStartOf(monday.getTime());

    for (let offset = 1; offset <= 6; offset++) {
      const day = new Date(monday);
      day.setDate(day.getDate() + offset);
      const result = weekStartOf(day.getTime());

      expect(result).toBe(mondayMs);
    }
  });

  it('should be idempotent', () => {
    const date = new Date(2024, 0, 15, 14, 30, 0); // Random date
    const first = weekStartOf(date.getTime());
    const second = weekStartOf(first);

    expect(second).toBe(first);
  });

  it('should differ by 7 days between consecutive weeks', () => {
    const week1 = new Date(2024, 0, 8, 0, 0, 0); // Mon Jan 8, 2024
    const week2 = new Date(2024, 0, 15, 0, 0, 0); // Mon Jan 15, 2024

    const ms1 = weekStartOf(week1.getTime());
    const ms2 = weekStartOf(week2.getTime());

    const diffMs = ms2 - ms1;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    expect(diffDays).toBe(7);
  });

  it('should handle time-of-day normalization', () => {
    const date1 = new Date(2024, 0, 10, 0, 0, 0); // Wed 00:00
    const date2 = new Date(2024, 0, 10, 23, 59, 59); // Wed 23:59:59

    const result1 = weekStartOf(date1.getTime());
    const result2 = weekStartOf(date2.getTime());

    expect(result1).toBe(result2);
  });

  it('should handle year boundaries', () => {
    const dec31 = new Date(2023, 11, 31, 10, 0, 0); // Sun Dec 31, 2023
    const jan1 = new Date(2024, 0, 1, 10, 0, 0); // Mon Jan 1, 2024

    const decResult = weekStartOf(dec31.getTime());
    const janResult = weekStartOf(jan1.getTime());

    // Dec 31 is Sunday, so it maps to previous Monday (Dec 25, 2023)
    // Jan 1 is Monday, so it maps to itself
    const decDate = new Date(decResult);
    const janDate = new Date(janResult);

    expect(decDate.getDay()).toBe(1);
    expect(janDate.getDay()).toBe(1);
    expect(decDate.getDate()).toBe(25);
    expect(janDate.getDate()).toBe(1);
  });

  it('should handle epoch timestamp 0', () => {
    const result = weekStartOf(0);
    const resultDate = new Date(result);

    // Epoch 0 is Thu Jan 1, 1970
    // Should map to Mon Dec 29, 1969
    expect(resultDate.getDay()).toBe(1);
  });
});
