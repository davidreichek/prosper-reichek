import { Appointment, AvailableAppointmentSlot } from "./appointment";
import { Clinician } from "./clinician";

// A small, curated dataset (vs. the large MOCK_SLOT_DATA dump) chosen so that
// `npm run dev` produces a short, hand-verifiable result that exercises every
// rule: eligibility, within-day optimization, the 1-7 day pairing window
// (including the inclusive 7-day edge and the 8-day exclusion), slot-length
// filtering, and daily/weekly capacity.
//
// Note: 2024-08-19 is a Monday, so Aug 19-25 and Aug 26-Sep 1 are two distinct
// Monday-start UTC weeks.

function slot(
  clinicianId: string,
  date: string,
  length = 90,
): AvailableAppointmentSlot {
  return {
    id: `${clinicianId}-${date}`,
    clinicianId,
    date: new Date(date),
    length,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// A booked appointment that consumes capacity (UPCOMING) on the given day.
function booked(clinicianId: string, date: string): Appointment {
  return {
    id: `${clinicianId}-appt-${date}`,
    patientId: "someone-else",
    clinicianId,
    scheduledFor: new Date(date),
    appointmentType: "ASSESSMENT_SESSION_1",
    status: "UPCOMING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const JANE_DOE_ID = "9c516382-c5b2-4677-a7ac-4e100fa35bdd";
const CARL_ID = "1f0e9d2c-0000-4000-8000-000000000004";

export const mockClinicians: Clinician[] = [
  // Eligible (NY / AETNA psychologist). Generous caps, so capacity never trims
  // the result -- this clinician showcases optimization, the pairing window, and
  // length filtering on their own.
  //
  // Slots, after the pipeline runs:
  //   Aug 19  12:00, 12:30, 13:30  -> 12:30 overlaps 12:00 and is dropped
  //                                    (optimization), leaving {12:00, 13:30}
  //   Aug 21  09:00                 -> kept
  //   Aug 26  10:00                 -> exactly 7 days from Aug 19 (still pairs)
  //   Aug 27  10:00                 -> 8 days from Aug 19 (does NOT pair with it)
  //
  // Expected: 7 pairs (Aug19x2 with Aug21 and Aug26; Aug21 with Aug26 and Aug27;
  // Aug26 with Aug27). The Aug19<->Aug27 combinations are absent (8 days apart).
  {
    id: JANE_DOE_ID,
    firstName: "Jane",
    lastName: "Doe",
    states: ["NY", "CA"],
    insurances: ["AETNA", "CIGNA"],
    clinicianType: "PSYCHOLOGIST",
    appointments: [],
    availableSlots: [
      slot(JANE_DOE_ID, "2024-08-19T12:00:00.000Z"),
      slot(JANE_DOE_ID, "2024-08-19T12:30:00.000Z"), // overlaps 12:00 -> dropped
      slot(JANE_DOE_ID, "2024-08-19T13:30:00.000Z"),
      slot(JANE_DOE_ID, "2024-08-21T09:00:00.000Z"),
      slot(JANE_DOE_ID, "2024-08-26T10:00:00.000Z"), // 7 days from Aug 19 (edge)
      slot(JANE_DOE_ID, "2024-08-27T10:00:00.000Z"), // 8 days from Aug 19
    ],
    maxDailyAppointments: 5,
    maxWeeklyAppointments: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Eligible (NY / AETNA psychologist) with tight caps and an existing booking,
  // to show capacity filtering:
  //   maxDaily = 1, maxWeekly = 2, and one UPCOMING appointment on Aug 20.
  //
  //   Aug 20  09:00 -> dropped: Aug 20 already has 1 booking (daily cap = 1)
  //   Aug 21  09:00 -> kept
  //   Aug 22  09:00 -> kept
  //   Aug 26  09:00 -> kept (next week)
  //
  // The Aug 21<->Aug 22 pair is in the same week as the existing Aug 20 booking;
  // that week (cap 2) only has room for 1 more, not the 2 a pair needs, so it is
  // dropped. Cross-week pairs survive.
  //
  // Expected: 2 pairs -> (Aug 21, Aug 26) and (Aug 22, Aug 26).
  {
    id: CARL_ID,
    firstName: "Carl",
    lastName: "Capacity",
    states: ["NY"],
    insurances: ["AETNA"],
    clinicianType: "PSYCHOLOGIST",
    appointments: [booked(CARL_ID, "2024-08-20T08:00:00.000Z")],
    availableSlots: [
      slot(CARL_ID, "2024-08-20T09:00:00.000Z"), // day at cap -> dropped
      slot(CARL_ID, "2024-08-21T09:00:00.000Z"),
      slot(CARL_ID, "2024-08-22T09:00:00.000Z"),
      slot(CARL_ID, "2024-08-26T09:00:00.000Z"),
    ],
    maxDailyAppointments: 1,
    maxWeeklyAppointments: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Not eligible: psychologist accepting AETNA, but not licensed in NY.
  {
    id: "1f0e9d2c-0000-4000-8000-000000000001",
    firstName: "Otto",
    lastName: "Texas",
    states: ["CA", "TX"],
    insurances: ["AETNA", "BCBS"],
    clinicianType: "PSYCHOLOGIST",
    appointments: [],
    availableSlots: [slot("1f0e9d2c-0000-4000-8000-000000000001", "2024-08-19T12:00:00.000Z")],
    maxDailyAppointments: 2,
    maxWeeklyAppointments: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Not eligible: psychologist in NY, but out of network for AETNA.
  {
    id: "1f0e9d2c-0000-4000-8000-000000000002",
    firstName: "Bea",
    lastName: "Bluecross",
    states: ["NY"],
    insurances: ["BCBS", "UNITED"],
    clinicianType: "PSYCHOLOGIST",
    appointments: [],
    availableSlots: [slot("1f0e9d2c-0000-4000-8000-000000000002", "2024-08-19T12:00:00.000Z")],
    maxDailyAppointments: 2,
    maxWeeklyAppointments: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Not eligible for an assessment: right state and network, but a therapist.
  {
    id: "1f0e9d2c-0000-4000-8000-000000000003",
    firstName: "Theo",
    lastName: "Therapist",
    states: ["NY"],
    insurances: ["AETNA"],
    clinicianType: "THERAPIST",
    appointments: [],
    availableSlots: [slot("1f0e9d2c-0000-4000-8000-000000000003", "2024-08-19T12:00:00.000Z")],
    maxDailyAppointments: 4,
    maxWeeklyAppointments: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
