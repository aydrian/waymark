/**
 * Seed sample itineraries into KV for local dev.
 *
 * Usage (live trip, primary):
 *   bun scripts/seed.ts > /tmp/trip.json
 *   wrangler kv key put --binding=TRIPS --local "trip:a8k3m2q9" --path /tmp/trip.json
 *
 * Usage (upcoming trip, secondary):
 *   bun scripts/seed.ts upcoming > /tmp/upcoming.json
 *   wrangler kv key put --binding=TRIPS --local "trip:z9x7v5t3" --path /tmp/upcoming.json
 *
 * PIN for both trips: use the verify endpoint at /api/trip-access/verify
 */

const LIVE_TRIP = {
  id: "a8k3m2q9",
  title: "Amalfi Coast & Rome",
  startDate: "2026-03-22",
  endDate: "2026-03-28",
  timezone: "Europe/Rome",
  summary: "A week exploring the Amalfi Coast and ending in Rome. Private transfers, boutique hotels, and curated dining experiences.",
  travelers: ["Alex Morgan", "Jordan Rivera"],
  destinations: ["Naples", "Positano", "Ravello", "Rome"],
  pinSalt: "deadbeefcafebabedeadbeefcafebabe",
  pinHash: "643bf561dd676254c08d60701376ce3e9e638b80210a3f1c3ae0cee0c0ca0ccd",
  updatedAt: "2026-03-25T12:00:00Z",
  notes: "All transfers are private. Hotel check-in is after 3pm. Emergency contact: Marco +39 333 1234567.",
  map: { centerLat: 40.628, centerLng: 14.485, zoom: 10 },
  days: [
    {
      date: "2026-03-22",
      dayNumber: 1,
      title: "Arrival in Naples → Positano",
      notes: "Flight arrives NCE 11:40. Private transfer meets you at arrivals, sign: WAYMARK.",
      items: [
        {
          id: "d1-flight",
          type: "transport",
          title: "Flight NCE → NAP",
          status: "booked",
          startTime: "09:15",
          endTime: "11:40",
          vendor: "ITA Airways",
          confirmationNumber: "ITA-88821",
          notes: "Seat 12A/12B. Bags included."
        },
        {
          id: "d1-transfer",
          type: "transfer",
          title: "Private transfer Naples Airport → Positano",
          status: "booked",
          startTime: "12:30",
          vendor: "Amalfi Transfers",
          confirmationNumber: "AT-5521",
          lat: 40.628,
          lng: 14.485,
          notes: "Driver: Marco. ~90 min drive."
        },
        {
          id: "d1-hotel",
          type: "hotel",
          title: "Le Sirenuse, Positano — Check-in",
          status: "booked",
          startTime: "15:00",
          location: "Via Cristoforo Colombo 30, Positano",
          lat: 40.6281,
          lng: 14.4843,
          vendor: "Le Sirenuse",
          confirmationNumber: "LS-2026-441",
          notes: "Junior Suite Sea View. Breakfast included."
        },
        {
          id: "d1-dinner",
          type: "restaurant",
          title: "Dinner at La Sponda",
          status: "booked",
          startTime: "20:00",
          location: "Le Sirenuse, Positano",
          notes: "Candlelit terrace. Dress code: smart casual."
        }
      ]
    },
    {
      date: "2026-03-23",
      dayNumber: 2,
      title: "Positano — Leisure Day",
      notes: "No fixed schedule. Beach chairs at Spiaggia Grande are pre-arranged.",
      items: [
        {
          id: "d2-beach",
          type: "activity",
          title: "Spiaggia Grande beach chairs (2 loungers + umbrella)",
          status: "booked",
          startTime: "10:00",
          endTime: "18:00",
          lat: 40.6275,
          lng: 14.4838,
          vendor: "Beach Club Positano",
          confirmationNumber: "BC-991"
        },
        {
          id: "d2-boat",
          type: "activity",
          title: "Private boat tour — Li Galli Islands",
          status: "quoted",
          startTime: "14:00",
          endTime: "17:30",
          vendor: "Positano Boat",
          notes: "Quote valid until May 1. Confirm by email."
        },
        {
          id: "d2-dinner",
          type: "restaurant",
          title: "Dinner at Il Tridente",
          status: "booked",
          startTime: "19:30",
          location: "Via Pasitea 242, Positano"
        }
      ]
    },
    {
      date: "2026-03-24",
      dayNumber: 3,
      title: "Ravello Day Trip",
      notes: "Transfer departs hotel at 9:30.",
      items: [
        {
          id: "d3-transfer-to",
          type: "transfer",
          title: "Transfer Positano → Ravello",
          status: "booked",
          startTime: "09:30",
          vendor: "Amalfi Transfers",
          confirmationNumber: "AT-5522"
        },
        {
          id: "d3-villa-rufolo",
          type: "activity",
          title: "Villa Rufolo — gardens & views",
          status: "booked",
          startTime: "11:00",
          location: "Piazza Vescovado, Ravello",
          lat: 40.6494,
          lng: 14.6121,
          notes: "Pre-purchased tickets attached in email."
        },
        {
          id: "d3-lunch",
          type: "restaurant",
          title: "Lunch at Ristorante Rossellinis",
          status: "booked",
          startTime: "13:00",
          location: "Via San Giovanni del Toro 28, Ravello"
        },
        {
          id: "d3-transfer-back",
          type: "transfer",
          title: "Transfer Ravello → Positano",
          status: "booked",
          startTime: "17:00",
          vendor: "Amalfi Transfers",
          confirmationNumber: "AT-5522"
        }
      ]
    },
    {
      date: "2026-03-25",
      dayNumber: 4,
      title: "Positano → Rome by Train",
      notes: "Pack the night before. Checkout at 11:00.",
      items: [
        {
          id: "d4-checkout",
          type: "hotel",
          title: "Le Sirenuse — Checkout",
          status: "booked",
          startTime: "11:00"
        },
        {
          id: "d4-transfer-naples",
          type: "transfer",
          title: "Transfer Positano → Naples Centrale",
          status: "booked",
          startTime: "11:30",
          vendor: "Amalfi Transfers",
          confirmationNumber: "AT-5523"
        },
        {
          id: "d4-train",
          type: "transport",
          title: "Frecciarossa Naples → Rome Termini",
          status: "booked",
          startTime: "14:05",
          endTime: "15:43",
          vendor: "Trenitalia",
          confirmationNumber: "FR-20264-8821",
          notes: "Carriage 6, seats 41/42."
        },
        {
          id: "d4-hotel-rome",
          type: "hotel",
          title: "Hotel de Russie, Rome — Check-in",
          status: "booked",
          startTime: "16:30",
          location: "Via del Babuino 9, Rome",
          lat: 41.9058,
          lng: 12.4781,
          vendor: "Hotel de Russie",
          confirmationNumber: "HDR-2026-112",
          notes: "Deluxe Garden Room. Breakfast included."
        },
        {
          id: "d4-dinner-rome",
          type: "restaurant",
          title: "Dinner at Il Sorpasso",
          status: "pending",
          startTime: "20:00",
          location: "Via Properzio 31/33, Rome",
          notes: "Reservation pending confirmation — check email."
        }
      ]
    },
    {
      date: "2026-03-26",
      dayNumber: 5,
      title: "Rome — Vatican & Trastevere",
      items: [
        {
          id: "d5-vatican",
          type: "activity",
          title: "Vatican Museums & Sistine Chapel — Skip-the-line tour",
          status: "booked",
          startTime: "09:00",
          endTime: "12:30",
          location: "Viale Vaticano, Rome",
          lat: 41.9065,
          lng: 12.4536,
          vendor: "Context Travel",
          confirmationNumber: "CTX-88801",
          notes: "Meet guide Elena at the main entrance pillar."
        },
        {
          id: "d5-lunch",
          type: "restaurant",
          title: "Lunch — Da Enzo al 29, Trastevere",
          status: "booked",
          startTime: "13:30",
          location: "Via dei Vascellari 29, Rome",
          lat: 41.888,
          lng: 12.469
        },
        {
          id: "d5-colosseum",
          type: "activity",
          title: "Colosseum & Roman Forum — guided",
          status: "quoted",
          startTime: "16:00",
          vendor: "Context Travel",
          notes: "Quote #CTX-889. Confirm 2 weeks prior."
        },
        {
          id: "d5-dinner",
          type: "restaurant",
          title: "Dinner at Roscioli",
          status: "booked",
          startTime: "20:30",
          location: "Via dei Giubbonari 21/22, Rome",
          notes: "Wine pairing pre-ordered."
        }
      ]
    },
    {
      date: "2026-03-27",
      dayNumber: 6,
      title: "Rome — Borghese Gallery & Campo de' Fiori",
      notes: "Gallery admission is timed entry — do not arrive late.",
      items: [
        {
          id: "d6-borghese",
          type: "activity",
          title: "Borghese Gallery — timed entry",
          status: "booked",
          startTime: "09:00",
          endTime: "11:00",
          location: "Piazzale Scipione Borghese 5, Rome",
          lat: 41.9142,
          lng: 12.4921,
          vendor: "Borghese Gallery",
          confirmationNumber: "BG-2026-3321",
          notes: "2-hour slot, no extensions. Bag check required."
        },
        {
          id: "d6-lunch",
          type: "restaurant",
          title: "Lunch at Osteria dell'Ingegno",
          status: "booked",
          startTime: "13:00",
          location: "Piazza di Pietra 45, Rome",
          lat: 41.8993,
          lng: 12.4797
        },
        {
          id: "d6-pantheon",
          type: "activity",
          title: "Pantheon — self-guided visit",
          status: "booked",
          startTime: "15:30",
          location: "Piazza della Rotonda, Rome",
          lat: 41.8986,
          lng: 12.4769,
          notes: "Timed entry ticket included in confirmation email."
        },
        {
          id: "d6-farewell-dinner",
          type: "restaurant",
          title: "Farewell dinner at Settembrini",
          status: "booked",
          startTime: "20:00",
          location: "Via Luigi Settembrini 25, Rome",
          notes: "Chef's tasting menu pre-selected. Notify of any allergies."
        }
      ]
    },
    {
      date: "2026-03-28",
      dayNumber: 7,
      title: "Departure from Rome",
      notes: "Checkout at 12:00. Transfer to Fiumicino at 13:30.",
      items: [
        {
          id: "d7-checkout",
          type: "hotel",
          title: "Hotel de Russie — Checkout",
          status: "booked",
          startTime: "12:00"
        },
        {
          id: "d7-transfer",
          type: "transfer",
          title: "Transfer Hotel de Russie → Rome Fiumicino (FCO)",
          status: "booked",
          startTime: "13:30",
          vendor: "Rome Transfers",
          confirmationNumber: "RT-4491",
          notes: "Driver: Luigi. Allow 60 min for the drive."
        },
        {
          id: "d7-flight",
          type: "transport",
          title: "Flight FCO → NCE",
          status: "booked",
          startTime: "17:20",
          endTime: "18:55",
          vendor: "ITA Airways",
          confirmationNumber: "ITA-88822",
          notes: "Check-in closes 45 min before departure."
        }
      ]
    }
  ]
};

// A second sample trip in the future — demonstrates 'upcoming' status.
// Seed command: bun scripts/seed.ts upcoming > /tmp/upcoming.json
//   wrangler kv key put --binding=TRIPS --local "trip:z9x7v5t3" --path /tmp/upcoming.json
const UPCOMING_TRIP = {
  id: "z9x7v5t3",
  title: "Swiss Alps Weekend",
  startDate: "2026-06-20",
  endDate: "2026-06-23",
  timezone: "Europe/Zurich",
  summary: "A long weekend hiking and sightseeing in the Swiss Alps.",
  destinations: ["Zurich", "Zermatt"],
  pinSalt: "deadbeefcafebabedeadbeefcafebabe",
  pinHash: "643bf561dd676254c08d60701376ce3e9e638b80210a3f1c3ae0cee0c0ca0ccd",
  updatedAt: "2026-03-25T12:00:00Z",
  days: [
    {
      date: "2026-06-20",
      dayNumber: 1,
      title: "Arrival in Zurich",
      items: [
        { id: "s1-flight", type: "transport", title: "Flight to ZRH", status: "booked", startTime: "10:00", endTime: "12:15", vendor: "Swiss Air", confirmationNumber: "LX-4421" }
      ]
    },
    {
      date: "2026-06-21",
      dayNumber: 2,
      title: "Glacier Express to Zermatt",
      items: [
        { id: "s2-train", type: "transport", title: "Glacier Express ZRH → Zermatt", status: "booked", startTime: "09:02", endTime: "15:30", vendor: "SBB", confirmationNumber: "GE-2026-77" }
      ]
    },
    {
      date: "2026-06-22",
      dayNumber: 3,
      title: "Klein Matterhorn",
      items: [
        { id: "s3-gondola", type: "activity", title: "Klein Matterhorn Gondola", status: "quoted", startTime: "10:00", vendor: "Zermatt Bergbahnen", notes: "Weather-dependent. Backup: Gorner Gorge walk." }
      ]
    },
    {
      date: "2026-06-23",
      dayNumber: 4,
      title: "Return to Zurich",
      items: [
        { id: "s4-train", type: "transport", title: "Train Zermatt → ZRH Airport", status: "booked", startTime: "11:00", vendor: "SBB" },
        { id: "s4-flight", type: "transport", title: "Flight ZRH → Home", status: "booked", startTime: "18:45", vendor: "Swiss Air" }
      ]
    }
  ]
};

const target = process.argv[2];
if (target === 'upcoming') {
  console.log(JSON.stringify(UPCOMING_TRIP, null, 2));
} else {
  console.log(JSON.stringify(LIVE_TRIP, null, 2));
}
