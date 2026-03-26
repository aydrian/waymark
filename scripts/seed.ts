/**
 * Seed the sample itinerary into KV for local dev.
 *
 * Usage:
 *   # Generate output and pipe to wrangler
 *   bun scripts/seed.ts > /tmp/trip.json
 *   wrangler kv key put --binding=TRIPS --local "trip:a8k3m2q9" --path /tmp/trip.json
 */

const SAMPLE_TRIP = {
  id: "a8k3m2q9",
  title: "Amalfi Coast & Rome",
  startDate: "2026-06-01",
  endDate: "2026-06-07",
  summary: "A week exploring the Amalfi Coast and ending in Rome. Private transfers, boutique hotels, and curated dining experiences.",
  destinations: ["Naples", "Positano", "Ravello", "Rome"],
  pinSalt: "deadbeefcafebabedeadbeefcafebabe",
  pinHash: "643bf561dd676254c08d60701376ce3e9e638b80210a3f1c3ae0cee0c0ca0ccd",
  updatedAt: "2026-03-25T12:00:00Z",
  notes: "All transfers are private. Hotel check-in is after 3pm. Emergency contact: Marco +39 333 1234567.",
  map: { centerLat: 40.628, centerLng: 14.485, zoom: 10 },
  days: [
    {
      date: "2026-06-01",
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
      date: "2026-06-02",
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
      date: "2026-06-03",
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
      date: "2026-06-04",
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
      date: "2026-06-05",
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
    }
  ]
};

console.log(JSON.stringify(SAMPLE_TRIP, null, 2));
