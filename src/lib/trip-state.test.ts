import { describe, it, expect } from 'bun:test';
import {
  getTripLocalDate,
  getTripStatus,
  isLiveTrip,
  getCurrentDay,
  getCurrentDayNumber,
  getVisibleDays,
} from './trip-state';
import type { Itinerary, Day } from '../types/itinerary';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeDay(dayNumber: number, date: string): Day {
  return { date, dayNumber, title: `Day ${dayNumber}`, items: [] };
}

function makeTrip(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: 'a8k3m2q9',
    title: 'Amalfi Coast & Rome',
    startDate: '2026-03-22',
    endDate: '2026-03-28',
    timezone: 'Europe/Rome',
    destinations: ['Naples', 'Rome'],
    pinSalt: 'deadbeefcafebabedeadbeefcafebabe',
    pinHash: '643bf561dd676254c08d60701376ce3e9e638b80210a3f1c3ae0cee0c0ca0ccd',
    updatedAt: '2026-03-25T12:00:00Z',
    days: [
      makeDay(1, '2026-03-22'),
      makeDay(2, '2026-03-23'),
      makeDay(3, '2026-03-24'),
      makeDay(4, '2026-03-25'),
      makeDay(5, '2026-03-26'),
      makeDay(6, '2026-03-27'),
      makeDay(7, '2026-03-28'),
    ],
    ...overrides,
  };
}

// 2026-03-25 noon UTC → Europe/Rome (UTC+1 in March) = 13:00 local → date "2026-03-25"
const NOW_DAY4 = new Date('2026-03-25T12:00:00Z');
// 2026-03-21 22:00 UTC → Europe/Rome = 23:00 local → date "2026-03-21" (before trip)
const NOW_BEFORE = new Date('2026-03-21T22:00:00Z');
// 2026-03-29 10:00 UTC → after endDate "2026-03-28"
const NOW_AFTER = new Date('2026-03-29T10:00:00Z');

// ---------------------------------------------------------------------------
// getTripLocalDate
// ---------------------------------------------------------------------------

describe('getTripLocalDate', () => {
  it('returns YYYY-MM-DD in the given timezone', () => {
    expect(getTripLocalDate('Europe/Rome', NOW_DAY4)).toBe('2026-03-25');
  });

  it('returns UTC date when timezone is UTC', () => {
    expect(getTripLocalDate('UTC', NOW_DAY4)).toBe('2026-03-25');
  });

  it('timezone boundary: UTC 23:30 is next day in UTC+1 (Europe/Rome)', () => {
    const lateUtc = new Date('2026-03-25T23:30:00Z');
    expect(getTripLocalDate('Europe/Rome', lateUtc)).toBe('2026-03-26');
    expect(getTripLocalDate('UTC', lateUtc)).toBe('2026-03-25');
  });

  it('timezone boundary: UTC 00:30 is previous day in UTC-4 (America/New_York)', () => {
    const earlyUtc = new Date('2026-03-25T00:30:00Z');
    // America/New_York is EDT (UTC-4) on March 25, 2026 (DST started March 8)
    expect(getTripLocalDate('America/New_York', earlyUtc)).toBe('2026-03-24');
  });
});

// ---------------------------------------------------------------------------
// getTripStatus
// ---------------------------------------------------------------------------

describe('getTripStatus', () => {
  const trip = makeTrip();

  it('returns "live" within startDate..endDate', () => {
    expect(getTripStatus(trip, NOW_DAY4)).toBe('live');
  });

  it('returns "live" on startDate (inclusive)', () => {
    const onStart = new Date('2026-03-22T10:00:00Z');
    expect(getTripStatus(trip, onStart)).toBe('live');
  });

  it('returns "live" on endDate (inclusive)', () => {
    const onEnd = new Date('2026-03-28T10:00:00Z');
    expect(getTripStatus(trip, onEnd)).toBe('live');
  });

  it('returns "upcoming" before startDate', () => {
    expect(getTripStatus(trip, NOW_BEFORE)).toBe('upcoming');
  });

  it('returns "completed" after endDate', () => {
    expect(getTripStatus(trip, NOW_AFTER)).toBe('completed');
  });

  it('uses trip timezone — UTC day before startDate but local day = startDate → "live"', () => {
    // 2026-03-21T23:30:00Z → Europe/Rome (UTC+1) = 2026-03-22T00:30 → "2026-03-22" = startDate
    const crossMidnightStart = new Date('2026-03-21T23:30:00Z');
    expect(getTripStatus(trip, crossMidnightStart)).toBe('live');
  });

  it('uses trip timezone — UTC = endDate but local day = endDate+1 → "completed"', () => {
    // 2026-03-28T23:30:00Z → Europe/Rome (UTC+1) = 2026-03-29T00:30 → "2026-03-29" (after endDate)
    const crossMidnightEnd = new Date('2026-03-28T23:30:00Z');
    expect(getTripStatus(trip, crossMidnightEnd)).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// isLiveTrip
// ---------------------------------------------------------------------------

describe('isLiveTrip', () => {
  const trip = makeTrip();

  it('returns true when live', () => {
    expect(isLiveTrip(trip, NOW_DAY4)).toBe(true);
  });

  it('returns false when upcoming', () => {
    expect(isLiveTrip(trip, NOW_BEFORE)).toBe(false);
  });

  it('returns false when completed', () => {
    expect(isLiveTrip(trip, NOW_AFTER)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCurrentDay
// ---------------------------------------------------------------------------

describe('getCurrentDay', () => {
  const trip = makeTrip();

  it('returns the Day matching the trip-local date', () => {
    const day = getCurrentDay(trip, NOW_DAY4);
    expect(day).toBeDefined();
    expect(day!.dayNumber).toBe(4);
    expect(day!.date).toBe('2026-03-25');
  });

  it('returns undefined before trip starts', () => {
    expect(getCurrentDay(trip, NOW_BEFORE)).toBeUndefined();
  });

  it('returns undefined after trip ends', () => {
    expect(getCurrentDay(trip, NOW_AFTER)).toBeUndefined();
  });

  it('returns undefined when itinerary has a gap on the current date', () => {
    const gapTrip = makeTrip({
      days: [
        makeDay(1, '2026-03-22'),
        makeDay(2, '2026-03-23'),
        makeDay(3, '2026-03-24'),
        // 2026-03-25 intentionally missing
        makeDay(4, '2026-03-26'),
        makeDay(5, '2026-03-27'),
        makeDay(6, '2026-03-28'),
      ],
    });
    expect(getCurrentDay(gapTrip, NOW_DAY4)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getCurrentDayNumber
// ---------------------------------------------------------------------------

describe('getCurrentDayNumber', () => {
  const trip = makeTrip();

  it('returns the dayNumber of the current day', () => {
    expect(getCurrentDayNumber(trip, NOW_DAY4)).toBe(4);
  });

  it('returns undefined when no current day', () => {
    expect(getCurrentDayNumber(trip, NOW_BEFORE)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getVisibleDays
// ---------------------------------------------------------------------------

describe('getVisibleDays', () => {
  const trip = makeTrip();

  it('null → all days, filter "all"', () => {
    const { days, filter } = getVisibleDays(trip, null, NOW_DAY4);
    expect(days).toHaveLength(7);
    expect(filter).toBe('all');
  });

  it('empty string → all days, filter "all"', () => {
    const { days, filter } = getVisibleDays(trip, '', NOW_DAY4);
    expect(days).toHaveLength(7);
    expect(filter).toBe('all');
  });

  it('"today" + live + match → [currentDay], filter "today"', () => {
    const { days, filter } = getVisibleDays(trip, 'today', NOW_DAY4);
    expect(days).toHaveLength(1);
    expect(days[0].dayNumber).toBe(4);
    expect(filter).toBe('today');
  });

  it('"today" + not live (upcoming) → all days, filter "all" [Rule D]', () => {
    const { days, filter } = getVisibleDays(trip, 'today', NOW_BEFORE);
    expect(days).toHaveLength(7);
    expect(filter).toBe('all');
  });

  it('"today" + not live (completed) → all days, filter "all" [Rule D]', () => {
    const { days, filter } = getVisibleDays(trip, 'today', NOW_AFTER);
    expect(days).toHaveLength(7);
    expect(filter).toBe('all');
  });

  it('"today" + live but no matching day → all days, filter "all" [Rule D]', () => {
    const noMatchTrip = makeTrip({
      days: [
        makeDay(1, '2026-03-22'),
        makeDay(2, '2026-03-23'),
        makeDay(3, '2026-03-24'),
        // 2026-03-25 absent
        makeDay(4, '2026-03-26'),
        makeDay(5, '2026-03-27'),
        makeDay(6, '2026-03-28'),
      ],
    });
    const { days, filter } = getVisibleDays(noMatchTrip, 'today', NOW_DAY4);
    expect(days).toHaveLength(6);
    expect(filter).toBe('all');
  });

  it('numeric day exists → [matchedDay], filter = N', () => {
    const { days, filter } = getVisibleDays(trip, '2', NOW_DAY4);
    expect(days).toHaveLength(1);
    expect(days[0].dayNumber).toBe(2);
    expect(filter).toBe(2);
  });

  it('numeric day does not exist → all days, filter "all" [Rule E]', () => {
    const { days, filter } = getVisibleDays(trip, '99', NOW_DAY4);
    expect(days).toHaveLength(7);
    expect(filter).toBe('all');
  });

  it('non-numeric string → all days, filter "all"', () => {
    const { days, filter } = getVisibleDays(trip, 'banana', NOW_DAY4);
    expect(days).toHaveLength(7);
    expect(filter).toBe('all');
  });

  it('timezone boundary: late UTC resolves to next local day', () => {
    // 2026-03-25T23:30Z → Europe/Rome (UTC+1) = 2026-03-26 00:30 → Day 5
    const lateUtc = new Date('2026-03-25T23:30:00Z');
    const { days, filter } = getVisibleDays(trip, 'today', lateUtc);
    expect(days).toHaveLength(1);
    expect(days[0].dayNumber).toBe(5);
    expect(filter).toBe('today');
  });
});
