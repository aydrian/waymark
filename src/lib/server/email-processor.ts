import { z } from 'zod';
import { getTrip, putTrip, listTrips } from '../kv';
import { ItemStatusSchema } from '../../types/itinerary';

export interface ProcessEmailInput {
  emailId: string;
  sender: string;
  subject: string;
}

export interface EmailProcessorEnv {
  AI: Ai;
  RESEND_API_KEY: string;
  TRIPS: KVNamespace;
}

export type ProcessEmailStatus =
  | 'updated'
  | 'no_match'
  | 'ai_error'
  | 'fetch_error'
  | 'validation_error';

export interface ProcessEmailResult {
  ok: boolean;
  status: ProcessEmailStatus;
  tripId?: string;
}

// ---------------------------------------------------------------------------
// Resend email response shape (GET /emails/{id})
// ---------------------------------------------------------------------------
const ResendEmailSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// AI output schemas
// ---------------------------------------------------------------------------
const AiTransportLegSchema = z.object({
  title: z.string(),
  transportType: z.enum(['flight', 'train', 'ferry', 'bus', 'other']),
  status: ItemStatusSchema,
  departureDate: z.string(),
  departureTime: z.string(),
  departureTimezone: z.string(),
  departureLocation: z.string().optional(),
  arrivalDate: z.string(),
  arrivalTime: z.string(),
  arrivalTimezone: z.string(),
  arrivalLocation: z.string().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  seat: z.string().optional(),
  notes: z.string().optional(),
});

const AiHotelStaySchema = z.object({
  title: z.string(),
  status: ItemStatusSchema,
  checkinDate: z.string(),
  checkinTime: z.string().optional(),
  checkoutDate: z.string(),
  checkoutTime: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

const AiRentalCarSchema = z.object({
  title: z.string(),
  status: ItemStatusSchema,
  pickupDate: z.string(),
  pickupTime: z.string(),
  pickupTimezone: z.string(),
  pickupLocation: z.string().optional(),
  dropoffDate: z.string(),
  dropoffTime: z.string(),
  dropoffTimezone: z.string(),
  dropoffLocation: z.string().optional(),
  carClass: z.string().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

const AiOutputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('transport_leg'), tripId: z.string(), data: AiTransportLegSchema }),
  z.object({ type: z.literal('hotel_stay'), tripId: z.string(), data: AiHotelStaySchema }),
  z.object({ type: z.literal('rental_car'), tripId: z.string(), data: AiRentalCarSchema }),
  z.object({
    type: z.literal('no_match'),
    tripId: z.string().nullable().optional(),
    data: z.unknown().optional(),
  }),
]);

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a travel assistant that extracts booking information from emails.
You will be given:
1. An email (subject + plain-text body)
2. A list of existing trips as JSON

Your task:
- Identify which trip this email is a confirmation for.
- Extract the booking details.
- Respond ONLY with a single JSON object. No explanation, no markdown, no code fences.

Match a trip by comparing dates, destinations, or title mentioned in the email to the trip list.
If no trip matches, set "type" to "no_match".

Output schema:
{
  "type": "transport_leg" | "hotel_stay" | "rental_car" | "no_match",
  "tripId": "<id from the trips list, or null if no_match>",
  "data": { ... }
}

For type "transport_leg", data fields:
  title (string, required) — e.g. "AA 123 JFK→CDG"
  transportType ("flight"|"train"|"ferry"|"bus"|"other", required)
  status ("booked"|"quoted"|"pending"|"canceled", required)
  departureDate (YYYY-MM-DD, required)
  departureTime (HH:MM, required)
  departureTimezone (IANA timezone, required) — infer from airport/city if not explicit
  departureLocation (string, optional)
  arrivalDate (YYYY-MM-DD, required)
  arrivalTime (HH:MM, required)
  arrivalTimezone (IANA timezone, required)
  arrivalLocation (string, optional)
  vendor (string, optional) — airline or rail operator name
  confirmationNumber (string, optional)
  seat (string, optional)
  notes (string, optional)

For type "hotel_stay", data fields:
  title (string, required) — hotel name
  status ("booked"|"quoted"|"pending"|"canceled", required)
  checkinDate (YYYY-MM-DD, required)
  checkinTime (HH:MM, optional)
  checkoutDate (YYYY-MM-DD, required)
  checkoutTime (HH:MM, optional)
  location (string, optional) — city or neighborhood
  address (string, optional)
  vendor (string, optional) — same as title usually
  confirmationNumber (string, optional)
  notes (string, optional)

For type "rental_car", data fields:
  title (string, required) — e.g. "Enterprise Compact at CDG"
  status ("booked"|"quoted"|"pending"|"canceled", required)
  pickupDate (YYYY-MM-DD, required)
  pickupTime (HH:MM, required)
  pickupTimezone (IANA timezone, required) — infer from pickup city/airport if not explicit
  pickupLocation (string, optional) — pickup location name or airport code
  dropoffDate (YYYY-MM-DD, required)
  dropoffTime (HH:MM, required)
  dropoffTimezone (IANA timezone, required)
  dropoffLocation (string, optional) — dropoff location name or airport code
  carClass (string, optional) — e.g. "Economy", "Compact", "SUV", "Full Size"
  vendor (string, optional) — rental agency name e.g. "Enterprise", "Hertz", "Avis"
  confirmationNumber (string, optional)
  notes (string, optional)

Recognize rental car confirmation emails from agencies such as Enterprise, Hertz, Avis, Budget, National, Alamo, Dollar, Thrifty, Europcar, Sixt, and others.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strips markdown code fences that Mistral sometimes adds despite instructions. */
export function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function processEmail(
  input: ProcessEmailInput,
  processorEnv: EmailProcessorEnv,
): Promise<ProcessEmailResult> {
  // 1. Fetch full email from Resend
  const resendRes = await fetch(`https://api.resend.com/emails/${input.emailId}`, {
    headers: { Authorization: `Bearer ${processorEnv.RESEND_API_KEY}` },
  });

  if (!resendRes.ok) {
    console.error(`[email-processor] Resend fetch failed: ${resendRes.status}`);
    return { ok: false, status: 'fetch_error' };
  }

  const resendData = ResendEmailSchema.safeParse(await resendRes.json());
  if (!resendData.success) {
    console.error('[email-processor] Resend response schema mismatch', resendData.error.issues);
    return { ok: false, status: 'fetch_error' };
  }

  const emailText = resendData.data.text ?? '';

  // 2. List existing trips for AI context
  const trips = await listTrips(processorEnv.TRIPS);

  // 3. Build user message and call AI
  const userMessage = `Subject: ${input.subject}\n\nEmail body:\n${emailText}\n\nExisting trips:\n${JSON.stringify(trips, null, 2)}`;

  const aiResponse = await processorEnv.AI.run('@cf/mistralai/mistral-7b-instruct-v0.2', {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 800,
  });

  const rawText = (aiResponse as { response: string }).response;

  // 4. Parse and validate AI output
  let parsed: ReturnType<typeof AiOutputSchema.safeParse>;
  try {
    const json = extractJson(rawText);
    parsed = AiOutputSchema.safeParse(JSON.parse(json));
  } catch {
    console.error('[email-processor] AI response is not valid JSON:', rawText);
    return { ok: false, status: 'ai_error' };
  }

  if (!parsed.success) {
    console.error('[email-processor] AI output failed schema validation', parsed.error.issues);
    return { ok: false, status: 'validation_error' };
  }

  const aiOutput = parsed.data;

  // 5. Apply update
  if (aiOutput.type === 'no_match') {
    console.log(`[email-processor] email_id=${input.emailId} no trip matched`);
    return { ok: true, status: 'no_match' };
  }

  const trip = await getTrip(processorEnv.TRIPS, aiOutput.tripId);
  if (!trip) {
    console.warn(`[email-processor] AI matched tripId=${aiOutput.tripId} but trip not found in KV`);
    return { ok: false, status: 'no_match' };
  }

  if (aiOutput.type === 'transport_leg') {
    const leg = {
      id: crypto.randomUUID(),
      type: aiOutput.data.transportType,
      title: aiOutput.data.title,
      status: aiOutput.data.status,
      departureDate: aiOutput.data.departureDate,
      departureTime: aiOutput.data.departureTime,
      departureTimezone: aiOutput.data.departureTimezone,
      departureLocation: aiOutput.data.departureLocation,
      arrivalDate: aiOutput.data.arrivalDate,
      arrivalTime: aiOutput.data.arrivalTime,
      arrivalTimezone: aiOutput.data.arrivalTimezone,
      arrivalLocation: aiOutput.data.arrivalLocation,
      vendor: aiOutput.data.vendor,
      confirmationNumber: aiOutput.data.confirmationNumber,
      seat: aiOutput.data.seat,
      notes: aiOutput.data.notes,
    };
    trip.transportLegs = [...(trip.transportLegs ?? []), leg];
  } else if (aiOutput.type === 'rental_car') {
    const rental = {
      id: crypto.randomUUID(),
      title: aiOutput.data.title,
      status: aiOutput.data.status,
      pickupDate: aiOutput.data.pickupDate,
      pickupTime: aiOutput.data.pickupTime,
      pickupTimezone: aiOutput.data.pickupTimezone,
      pickupLocation: aiOutput.data.pickupLocation,
      dropoffDate: aiOutput.data.dropoffDate,
      dropoffTime: aiOutput.data.dropoffTime,
      dropoffTimezone: aiOutput.data.dropoffTimezone,
      dropoffLocation: aiOutput.data.dropoffLocation,
      carClass: aiOutput.data.carClass,
      vendor: aiOutput.data.vendor,
      confirmationNumber: aiOutput.data.confirmationNumber,
      notes: aiOutput.data.notes,
    };
    trip.rentalCars = [...(trip.rentalCars ?? []), rental];
  } else {
    const stay = {
      id: crypto.randomUUID(),
      title: aiOutput.data.title,
      status: aiOutput.data.status,
      checkinDate: aiOutput.data.checkinDate,
      checkinTime: aiOutput.data.checkinTime,
      checkoutDate: aiOutput.data.checkoutDate,
      checkoutTime: aiOutput.data.checkoutTime,
      location: aiOutput.data.location,
      address: aiOutput.data.address,
      vendor: aiOutput.data.vendor,
      confirmationNumber: aiOutput.data.confirmationNumber,
      notes: aiOutput.data.notes,
    };
    trip.stays = [...(trip.stays ?? []), stay];
  }

  trip.updatedAt = new Date().toISOString();
  await putTrip(processorEnv.TRIPS, trip);

  console.log(
    `[email-processor] email_id=${input.emailId} type=${aiOutput.type} tripId=${trip.id} status=updated`,
  );
  return { ok: true, status: 'updated', tripId: trip.id };
}
