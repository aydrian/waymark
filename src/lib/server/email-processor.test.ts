import { describe, it, expect, afterEach, mock } from 'bun:test';
import { processEmail, extractJson } from './email-processor';
import type { ProcessEmailInput, EmailProcessorEnv } from './email-processor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRIP_SUMMARY = {
  id: 'abc12345',
  title: 'Europe Trip',
  startDate: '2026-06-01',
  endDate: '2026-06-15',
  destinations: ['Paris', 'Rome'],
  travelers: ['Aydrian'],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const FULL_TRIP = {
  id: 'abc12345',
  title: 'Europe Trip',
  startDate: '2026-06-01',
  endDate: '2026-06-15',
  timezone: 'Europe/Paris',
  destinations: ['Paris', 'Rome'],
  travelers: ['Aydrian'],
  days: [],
  stays: [],
  transportLegs: [],
  pinSalt: 'salt',
  pinHash: 'hash',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const EMAIL_INPUT: ProcessEmailInput = {
  emailId: 'email_abc123',
  sender: 'airline@example.com',
  subject: 'Your flight confirmation',
};

const TRANSPORT_LEG_AI_RESPONSE = JSON.stringify({
  type: 'transport_leg',
  tripId: 'abc12345',
  data: {
    title: 'AA 100 JFK→CDG',
    transportType: 'flight',
    status: 'booked',
    departureDate: '2026-06-01',
    departureTime: '22:00',
    departureTimezone: 'America/New_York',
    departureLocation: 'JFK',
    arrivalDate: '2026-06-02',
    arrivalTime: '11:30',
    arrivalTimezone: 'Europe/Paris',
    arrivalLocation: 'CDG',
    vendor: 'American Airlines',
    confirmationNumber: 'XYZ123',
  },
});

const HOTEL_STAY_AI_RESPONSE = JSON.stringify({
  type: 'hotel_stay',
  tripId: 'abc12345',
  data: {
    title: 'Hotel Le Marais',
    status: 'booked',
    checkinDate: '2026-06-02',
    checkoutDate: '2026-06-07',
    location: 'Paris',
    address: '10 Rue de Bretagne, 75003 Paris',
    confirmationNumber: 'HTL456',
  },
});

const RENTAL_CAR_AI_RESPONSE = JSON.stringify({
  type: 'rental_car',
  tripId: 'abc12345',
  data: {
    title: 'Enterprise Compact',
    status: 'booked',
    pickupDate: '2026-06-02',
    pickupTime: '10:00',
    pickupTimezone: 'Europe/Paris',
    pickupLocation: 'CDG Airport',
    dropoffDate: '2026-06-07',
    dropoffTime: '09:00',
    dropoffTimezone: 'Europe/Paris',
    dropoffLocation: 'CDG Airport',
    carClass: 'Compact',
    vendor: 'Enterprise',
    confirmationNumber: 'ENT789',
  },
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeResendFetchMock(emailText: string, status = 200) {
  return ((url: string) => {
    if (String(url).includes('api.resend.com/emails')) {
      const body = JSON.stringify({
        id: 'email_abc123',
        subject: 'Your flight confirmation',
        from: 'airline@example.com',
        to: ['waymark@agent.itsaydrian.com'],
        text: emailText,
        html: null,
      });
      return Promise.resolve(new Response(body, { status }));
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as typeof fetch;
}

function makeKvMock(putMock = mock(async () => {})) {
  const tripData = JSON.stringify(FULL_TRIP);
  return {
    get: async (key: string) => {
      if (key === `trip:${TRIP_SUMMARY.id}`) return tripData;
      if (key === 'trip:') return null; // list prefix guard
      return null;
    },
    put: putMock,
    list: async () => ({
      keys: [{ name: `trip:${TRIP_SUMMARY.id}` }],
    }),
  } as unknown as KVNamespace;
}

function makeAiMock(responseText: string) {
  return {
    run: mock(async () => ({ response: responseText })),
  } as unknown as Ai;
}

// ---------------------------------------------------------------------------
// extractJson unit tests
// ---------------------------------------------------------------------------

describe('extractJson', () => {
  it('returns plain JSON as-is', () => {
    expect(extractJson('{"type":"no_match"}')).toBe('{"type":"no_match"}');
  });

  it('strips ```json ... ``` fences', () => {
    const fenced = '```json\n{"type":"no_match"}\n```';
    expect(extractJson(fenced)).toBe('{"type":"no_match"}');
  });

  it('strips ``` ... ``` fences without language tag', () => {
    const fenced = '```\n{"type":"no_match"}\n```';
    expect(extractJson(fenced)).toBe('{"type":"no_match"}');
  });
});

// ---------------------------------------------------------------------------
// processEmail integration tests
// ---------------------------------------------------------------------------

describe('processEmail', () => {
  it('happy path — transport leg parsed and written to KV', async () => {
    const putMock = mock(async () => {});
    const kv = makeKvMock(putMock);
    const env: EmailProcessorEnv = {
      AI: makeAiMock(TRANSPORT_LEG_AI_RESPONSE),
      RESEND_API_KEY: 'test-key',
      TRIPS: kv,
    };
    globalThis.fetch = makeResendFetchMock('Flight confirmation details...');

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: true, status: 'updated', tripId: 'abc12345' });
    expect(putMock).toHaveBeenCalledTimes(1);
    const savedTrip = JSON.parse(putMock.mock.calls[0][1] as string);
    expect(savedTrip.transportLegs).toHaveLength(1);
    expect(savedTrip.transportLegs[0].title).toBe('AA 100 JFK→CDG');
    expect(savedTrip.transportLegs[0].id).toBeTruthy();
  });

  it('happy path — hotel stay parsed and written to KV', async () => {
    const putMock = mock(async () => {});
    const kv = makeKvMock(putMock);
    const env: EmailProcessorEnv = {
      AI: makeAiMock(HOTEL_STAY_AI_RESPONSE),
      RESEND_API_KEY: 'test-key',
      TRIPS: kv,
    };
    globalThis.fetch = makeResendFetchMock('Hotel booking confirmation...');

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: true, status: 'updated', tripId: 'abc12345' });
    expect(putMock).toHaveBeenCalledTimes(1);
    const savedTrip = JSON.parse(putMock.mock.calls[0][1] as string);
    expect(savedTrip.stays).toHaveLength(1);
    expect(savedTrip.stays[0].title).toBe('Hotel Le Marais');
    expect(savedTrip.stays[0].id).toBeTruthy();
  });

  it('happy path — rental car parsed and written to KV', async () => {
    const putMock = mock(async () => {});
    const kv = makeKvMock(putMock);
    const env: EmailProcessorEnv = {
      AI: makeAiMock(RENTAL_CAR_AI_RESPONSE),
      RESEND_API_KEY: 'test-key',
      TRIPS: kv,
    };
    globalThis.fetch = makeResendFetchMock('Rental car confirmation details...');

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: true, status: 'updated', tripId: 'abc12345' });
    expect(putMock).toHaveBeenCalledTimes(1);
    const savedTrip = JSON.parse(putMock.mock.calls[0][1] as string);
    expect(savedTrip.rentalCars).toHaveLength(1);
    expect(savedTrip.rentalCars[0].title).toBe('Enterprise Compact');
    expect(savedTrip.rentalCars[0].id).toBeTruthy();
  });

  it('no_match — KV is not written', async () => {
    const putMock = mock(async () => {});
    const kv = makeKvMock(putMock);
    const env: EmailProcessorEnv = {
      AI: makeAiMock(JSON.stringify({ type: 'no_match', tripId: null })),
      RESEND_API_KEY: 'test-key',
      TRIPS: kv,
    };
    globalThis.fetch = makeResendFetchMock('Some unrelated email...');

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: true, status: 'no_match' });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('fetch_error — Resend returns 404', async () => {
    globalThis.fetch = makeResendFetchMock('', 404);
    const env: EmailProcessorEnv = {
      AI: makeAiMock(''),
      RESEND_API_KEY: 'test-key',
      TRIPS: makeKvMock(),
    };

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: false, status: 'fetch_error' });
  });

  it('ai_error — AI returns garbage text', async () => {
    globalThis.fetch = makeResendFetchMock('Email body...');
    const env: EmailProcessorEnv = {
      AI: makeAiMock('Sorry, I cannot process this request.'),
      RESEND_API_KEY: 'test-key',
      TRIPS: makeKvMock(),
    };

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: false, status: 'ai_error' });
  });

  it('validation_error — AI returns valid JSON but wrong schema', async () => {
    globalThis.fetch = makeResendFetchMock('Email body...');
    const env: EmailProcessorEnv = {
      AI: makeAiMock(JSON.stringify({ type: 'transport_leg', tripId: 'abc12345', data: {} })),
      RESEND_API_KEY: 'test-key',
      TRIPS: makeKvMock(),
    };

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: false, status: 'validation_error' });
  });

  it('handles AI response wrapped in markdown fences', async () => {
    const putMock = mock(async () => {});
    const kv = makeKvMock(putMock);
    const fencedResponse = `\`\`\`json\n${TRANSPORT_LEG_AI_RESPONSE}\n\`\`\``;
    const env: EmailProcessorEnv = {
      AI: makeAiMock(fencedResponse),
      RESEND_API_KEY: 'test-key',
      TRIPS: kv,
    };
    globalThis.fetch = makeResendFetchMock('Flight details...');

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: true, status: 'updated', tripId: 'abc12345' });
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('no_match — AI matched a tripId that does not exist in KV', async () => {
    const kv = {
      get: async () => null,
      put: mock(async () => {}),
      list: async () => ({ keys: [] }),
    } as unknown as KVNamespace;
    const env: EmailProcessorEnv = {
      AI: makeAiMock(TRANSPORT_LEG_AI_RESPONSE),
      RESEND_API_KEY: 'test-key',
      TRIPS: kv,
    };
    globalThis.fetch = makeResendFetchMock('Flight details...');

    const result = await processEmail(EMAIL_INPUT, env);

    expect(result).toEqual({ ok: false, status: 'no_match' });
  });
});
