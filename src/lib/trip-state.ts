import type { Itinerary, Day, HotelStay, TripItem } from '../types/itinerary';

/**
 * Returns the current local date as YYYY-MM-DD in the given IANA timezone.
 * Uses Intl.DateTimeFormat with en-CA locale (natively emits YYYY-MM-DD).
 */
export function getTripLocalDate(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Classifies the trip as upcoming, live, or completed.
 * Uses string comparison on YYYY-MM-DD — safe because format is identical.
 */
export function getTripStatus(
  trip: Itinerary,
  now: Date = new Date(),
): 'upcoming' | 'live' | 'completed' {
  const localDate = getTripLocalDate(trip.timezone, now);
  if (localDate < trip.startDate) return 'upcoming';
  if (localDate > trip.endDate) return 'completed';
  return 'live';
}

export function isLiveTrip(trip: Itinerary, now: Date = new Date()): boolean {
  return getTripStatus(trip, now) === 'live';
}

/**
 * Returns the Day whose `date` matches the trip-local date, or undefined.
 */
export function getCurrentDay(trip: Itinerary, now: Date = new Date()): Day | undefined {
  const localDate = getTripLocalDate(trip.timezone, now);
  return trip.days.find(d => d.date === localDate);
}

export function getCurrentDayNumber(
  trip: Itinerary,
  now: Date = new Date(),
): number | undefined {
  return getCurrentDay(trip, now)?.dayNumber;
}

/**
 * Resolves `?day=` query param to concrete days + active filter label.
 *
 * Resolution rules (see spec for Rule D, E):
 *   null | ""           → { days: all, filter: 'all' }
 *   "today" live+match  → { days: [currentDay], filter: 'today' }
 *   "today" else        → { days: all, filter: 'all' }
 *   numeric N, exists   → { days: [day], filter: N }
 *   numeric N, missing  → { days: all, filter: 'all' }
 *   other string        → { days: all, filter: 'all' }
 */
/**
 * Returns the hotel stay the traveler is sleeping at on the night of `date`.
 * A stay is active if checkinDate <= date < checkoutDate.
 * On checkout day the condition fails (<), so departure days return null.
 * On a checkout + new check-in day, the new stay's checkinDate == date satisfies <=.
 */
export function getActiveStayForNight(stays: HotelStay[], date: string): HotelStay | null {
  return stays.find(s => s.checkinDate <= date && date < s.checkoutDate) ?? null;
}

/**
 * Generates virtual TripItem objects for hotel check-in/checkout events on `date`.
 * Check-in items carry full hotel details; checkout items carry only startTime.
 */
export function generateHotelTimelineItems(stays: HotelStay[], date: string): TripItem[] {
  const items: TripItem[] = [];
  for (const stay of stays) {
    if (stay.checkinDate === date) {
      items.push({
        id: `stay-${stay.id}-checkin`,
        type: 'hotel',
        title: `${stay.title} — Check-in`,
        status: stay.status,
        startTime: stay.checkinTime,
        location: stay.location,
        address: stay.address,
        lat: stay.lat,
        lng: stay.lng,
        vendor: stay.vendor,
        confirmationNumber: stay.confirmationNumber,
        notes: stay.notes,
      });
    }
    if (stay.checkoutDate === date) {
      items.push({
        id: `stay-${stay.id}-checkout`,
        type: 'hotel',
        title: `${stay.title} — Checkout`,
        status: stay.status,
        startTime: stay.checkoutTime,
      });
    }
  }
  return items;
}

/**
 * Returns TripItem-like objects for hotel map pins.
 * date=null → show all stays (used when filter is 'all').
 * date=YYYY-MM-DD → show stays where checkinDate <= date <= checkoutDate
 *   (inclusive on checkoutDate so the hotel pin remains visible on departure day).
 */
export function getHotelMapItems(stays: HotelStay[], date: string | null): TripItem[] {
  const visibleStays = date === null
    ? stays
    : stays.filter(s => s.checkinDate <= date && date <= s.checkoutDate);

  return visibleStays
    .filter(s => s.lat !== undefined && s.lng !== undefined)
    .map(s => ({
      id: `stay-${s.id}-pin`,
      type: 'hotel' as const,
      title: s.title,
      status: s.status,
      location: s.location,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
    }));
}

export function getVisibleDays(
  trip: Itinerary,
  dayParam: string | null,
  now: Date = new Date(),
): { days: Day[]; filter: 'all' | 'today' | number } {
  if (!dayParam) return { days: trip.days, filter: 'all' };

  if (dayParam === 'today') {
    if (!isLiveTrip(trip, now)) return { days: trip.days, filter: 'all' };
    const currentDay = getCurrentDay(trip, now);
    if (!currentDay) return { days: trip.days, filter: 'all' };
    return { days: [currentDay], filter: 'today' };
  }

  const n = Number(dayParam);
  if (isNaN(n)) return { days: trip.days, filter: 'all' };

  const matched = trip.days.filter(d => d.dayNumber === n);
  if (matched.length === 0) return { days: trip.days, filter: 'all' };

  return { days: matched, filter: n };
}
