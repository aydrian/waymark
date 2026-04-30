import type { Itinerary, Day, HotelStay, TripItem, TransportLeg, RentalCarReservation } from '@itsaydrian/waymark-shared/types';

export type GeneratedItem = TripItem & {
  _legType?: 'departure' | 'arrival' | 'transit' | 'pickup' | 'dropoff';
  _transportType?: 'flight' | 'train' | 'ferry' | 'bus' | 'other';
  _tzAbbr?: string;
  _sortMs?: number; // UTC ms timestamp — used for correct ordering across timezones
  _costPerDay?: number; // rental cars: cost per day for display
};

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

/**
 * Converts a local date+time in a given IANA timezone to a UTC millisecond timestamp.
 *
 * Approach: treat the local date+time as a UTC probe, format that probe in the target
 * timezone to get the displayed local date+time, then compute the full date+time
 * difference (including date changes) and apply it as a correction. This correctly
 * handles large UTC offsets (e.g. JST +9) and dateline crossings where the hour-only
 * approach fails.
 */
function localDateTimeToMs(date: string, time: string | undefined, timezone: string): number {
  if (!time || time.trim() === '') {
    // Return a timestamp based only on the date (start of day in UTC)
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }
  const approxUTC = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(approxUTC);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const displayH = parseInt(get('hour'), 10) % 24; // handle rare "24" hour edge case
  const displayM = parseInt(get('minute'), 10);
  const displayYear = parseInt(get('year'), 10);
  const displayMonth = parseInt(get('month'), 10);
  const displayDay = parseInt(get('day'), 10);

  const [tYear, tMonth, tDay] = date.split('-').map(Number);
  const [tH, tM] = time.split(':').map(Number);

  // Compare full date+time values (using UTC epoch as neutral reference for arithmetic)
  const displayMs = Date.UTC(displayYear, displayMonth - 1, displayDay, displayH, displayM);
  const targetMs = Date.UTC(tYear, tMonth - 1, tDay, tH, tM);

  // correction = targetLocal - displayedLocal; true UTC = probe + correction
  return approxUTC.getTime() + (targetMs - displayMs);
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getTimezoneAbbr(timezone: string, date: string, time: string | undefined): string {
  if (!time || time.trim() === '') {
    return '';
  }
  const dt = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(dt);
  return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
}

const TRANSIT_LABELS: Record<TransportLeg['type'], string> = {
  flight: 'In flight',
  train: 'In transit',
  ferry: 'In transit',
  bus: 'In transit',
  other: 'In transit',
};

/**
 * Generates synthetic timeline items for a given date from a list of TransportLeg entries.
 * Each leg produces up to 3 items: departure (on departureDate), in-transit block, and
 * arrival (on arrivalDate). Overnight legs split naturally across days.
 */
export function getTransportItemsForDay(legs: TransportLeg[], date: string): GeneratedItem[] {
  const items: GeneratedItem[] = [];

  for (const leg of legs) {
    const depMs = localDateTimeToMs(leg.departureDate, leg.departureTime, leg.departureTimezone);
    const arrMs = localDateTimeToMs(leg.arrivalDate, leg.arrivalTime, leg.arrivalTimezone);
    const hasTimes = leg.departureTime && leg.arrivalTime;
    const durationMs = arrMs - depMs;
    const transitLabel = hasTimes
      ? `${TRANSIT_LABELS[leg.type]} · ${formatDuration(durationMs)}`
      : TRANSIT_LABELS[leg.type];
    const sameDay = leg.departureDate === leg.arrivalDate;

    if (leg.departureDate === date) {
      const depTzAbbr = getTimezoneAbbr(leg.departureTimezone, leg.departureDate, leg.departureTime);
      const noteParts = [leg.seat ? `Seat: ${leg.seat}` : undefined, leg.notes]
        .filter(Boolean).join('\n');

      items.push({
        id: `transport-${leg.id}-departure`,
        type: 'transport',
        title: `${leg.title} — Departure`,
        status: leg.status,
        startTime: leg.departureTime || undefined,
        location: leg.departureLocation,
        lat: leg.departureLat,
        lng: leg.departureLng,
        vendor: leg.vendor,
        confirmationNumber: leg.confirmationNumber,
        notes: noteParts || undefined,
        cost: leg.cost,
        _legType: 'departure',
        _transportType: leg.type,
        _tzAbbr: depTzAbbr,
        _sortMs: depMs,
      });

      if (sameDay && hasTimes) {
        items.push({
          id: `transport-${leg.id}-transit`,
          type: 'transport',
          title: transitLabel,
          status: leg.status,
          startTime: leg.departureTime,
          _legType: 'transit',
          _transportType: leg.type,
          _sortMs: depMs + 1, // sorts immediately after departure
        });
      }
    }

    if (leg.arrivalDate === date) {
      if (!sameDay && hasTimes) {
        // Overnight: in-transit block at top of arrival day
        items.push({
          id: `transport-${leg.id}-transit`,
          type: 'transport',
          title: transitLabel,
          status: leg.status,
          startTime: '00:00',
          _legType: 'transit',
          _transportType: leg.type,
          _sortMs: depMs + 1,
        });
      }

      const arrTzAbbr = getTimezoneAbbr(leg.arrivalTimezone, leg.arrivalDate, leg.arrivalTime);

      items.push({
        id: `transport-${leg.id}-arrival`,
        type: 'transport',
        title: `${leg.title} — Arrival`,
        status: leg.status,
        startTime: leg.arrivalTime || undefined,
        location: leg.arrivalLocation,
        lat: leg.arrivalLat,
        lng: leg.arrivalLng,
        _legType: 'arrival',
        _transportType: leg.type,
        _tzAbbr: arrTzAbbr,
        _sortMs: arrMs,
      });
    }
  }

  return items;
}

/**
 * Returns GeneratedItem map pins for transport legs.
 * date=null → show all departure and arrival pins.
 * date=YYYY-MM-DD → show departure pin if departureDate matches, arrival pin if arrivalDate matches.
 */
export function getTransportMapItems(legs: TransportLeg[], date: string | null): GeneratedItem[] {
  const items: GeneratedItem[] = [];
  for (const leg of legs) {
    if (leg.departureLat !== undefined && leg.departureLng !== undefined) {
      if (date === null || leg.departureDate === date) {
        items.push({
          id: `transport-${leg.id}-dep-pin`,
          type: 'transport',
          title: leg.departureLocation ?? leg.title,
          status: leg.status,
          location: leg.departureLocation,
          lat: leg.departureLat,
          lng: leg.departureLng,
          _legType: 'departure',
          _transportType: leg.type,
        });
      }
    }
    if (leg.arrivalLat !== undefined && leg.arrivalLng !== undefined) {
      if (date === null || leg.arrivalDate === date) {
        items.push({
          id: `transport-${leg.id}-arr-pin`,
          type: 'transport',
          title: leg.arrivalLocation ?? leg.title,
          status: leg.status,
          location: leg.arrivalLocation,
          lat: leg.arrivalLat,
          lng: leg.arrivalLng,
          _legType: 'arrival',
          _transportType: leg.type,
        });
      }
    }
  }
  return items;
}

/**
 * Generates synthetic timeline items for a given date from a list of RentalCarReservation entries.
 * Each reservation produces a pickup item (on pickupDate) and a dropoff item (on dropoffDate).
 */
export function getRentalCarItemsForDay(
  rentals: RentalCarReservation[],
  date: string,
): GeneratedItem[] {
  const items: GeneratedItem[] = [];

  for (const rental of rentals) {
    if (rental.pickupDate === date) {
      const [pY, pM, pD] = rental.pickupDate.split('-').map(Number);
      const [dY, dM, dD] = rental.dropoffDate.split('-').map(Number);
      const days = Math.round(
        (Date.UTC(dY, dM - 1, dD) - Date.UTC(pY, pM - 1, pD)) / 86400000,
      );
      const costPerDay =
        rental.cost != null && days > 0 ? Math.round(rental.cost / days) : undefined;

      const noteParts = [
        rental.carClass ? `Class: ${rental.carClass}` : undefined,
        rental.notes,
      ].filter(Boolean).join('\n');

      items.push({
        id: `rental-${rental.id}-pickup`,
        type: 'transport',
        title: `${rental.title} — Pick-up`,
        status: rental.status,
        startTime: rental.pickupTime || undefined,
        location: rental.pickupLocation,
        lat: rental.pickupLat,
        lng: rental.pickupLng,
        vendor: rental.vendor,
        confirmationNumber: rental.confirmationNumber,
        notes: noteParts || undefined,
        cost: rental.cost,
        _legType: 'pickup',
        _tzAbbr: getTimezoneAbbr(rental.pickupTimezone, rental.pickupDate, rental.pickupTime),
        _sortMs: localDateTimeToMs(rental.pickupDate, rental.pickupTime, rental.pickupTimezone),
        _costPerDay: costPerDay,
      });
    }

    if (rental.dropoffDate === date) {
      const isOneWay =
        rental.pickupLocation != null &&
        rental.dropoffLocation != null &&
        rental.pickupLocation !== rental.dropoffLocation;

      items.push({
        id: `rental-${rental.id}-dropoff`,
        type: 'transport',
        title: `${rental.title} — Drop-off`,
        status: rental.status,
        startTime: rental.dropoffTime || undefined,
        location: rental.dropoffLocation,
        lat: rental.dropoffLat,
        lng: rental.dropoffLng,
        notes: isOneWay ? 'One-way rental' : undefined,
        _legType: 'dropoff',
        _tzAbbr: getTimezoneAbbr(rental.dropoffTimezone, rental.dropoffDate, rental.dropoffTime),
        _sortMs: localDateTimeToMs(rental.dropoffDate, rental.dropoffTime, rental.dropoffTimezone),
      });
    }
  }

  return items;
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
