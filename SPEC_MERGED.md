# Merged Implementation

The consolidated, final implementation of online assessment scheduling. It takes
a patient and a set of clinicians and returns, per eligible clinician, the
bookable pairs of assessment sessions -- accounting for clinician eligibility,
overlapping slots, and each clinician's existing appointments and daily/weekly
capacity.

## Module layout

```
src/
  scheduling/
    dateKeys.ts        UTC day/week bucketing (no dependencies)
    types.ts           public result types
    optimizeSlots.ts   maximum non-overlapping slot selection
    capacity.ts        appointment counting + capacity checks
    assessmentSlots.ts eligibility, pairing, and the top-level entry point
  starter-code/        given data models + mock data
  index.ts             demo entry point
```

Dependencies flow one direction: `assessmentSlots.ts` -> `capacity.ts` / `optimizeSlots.ts` -> `dateKeys.ts`.

## `src/scheduling/dateKeys.ts`

```ts
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Canonical UTC day bucket: any time on a given date maps to the same value, and
// day differences come out as whole numbers. Returns epoch ms at 00:00:00.000
// UTC of that day.
export function utcDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Canonical week bucket: epoch ms at UTC midnight of that week's Monday.
export function utcWeekKey(date: Date): number {
  const dayMidnight = utcDayKey(date);
  const dayOfWeek = new Date(dayMidnight).getUTCDay(); // 0=Sun .. 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return dayMidnight - daysSinceMonday * MS_PER_DAY;
}
```

## `src/scheduling/types.ts`

```ts
export interface AssessmentSessionSlot {
  date: string; // ISO-8601 UTC start time
  length: number; // minutes
}

export interface AssessmentSlotPair {
  session1: AssessmentSessionSlot;
  session2: AssessmentSessionSlot;
}

export interface ClinicianAssessmentSlots {
  clinician: {
    id: string;
    firstName: string;
    lastName: string;
  };
  pairs: AssessmentSlotPair[];
}
```

## `src/scheduling/optimizeSlots.ts`

```ts
// Filter slot start times down to the largest set of non-overlapping
// appointments of the given duration. Greedy by earliest end time, which is
// optimal for fixed-duration intervals.
export function maximizeNonOverlappingSlots(
  dates: Date[],
  durationMinutes: number,
): Date[] {
  const durationMs = durationMinutes * 60 * 1000;

  // With a fixed duration, earliest start also means earliest end -- the greedy
  // interval-scheduling order.
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  const kept: Date[] = [];
  let lastEnd = -Infinity; // end (epoch ms) of the most recently kept slot

  for (const date of sorted) {
    const start = date.getTime();
    // Keep a slot only if it starts at/after the previous kept slot ends, so it
    // doesn't overlap. Keeping earliest-ending slots leaves the most room for
    // later ones, maximizing the count.
    if (start >= lastEnd) {
      kept.push(date);
      lastEnd = start + durationMs;
    }
  }

  return kept;
}
```

## `src/scheduling/capacity.ts`

```ts
import { Appointment, AppointmentStatus } from "../starter-code/appointment";
import { Clinician } from "../starter-code/clinician";
import { utcDayKey, utcWeekKey } from "./dateKeys";

// Statuses that occupy a slot and count toward a clinician's caps. Cancelled and
// rescheduled appointments free the slot, so they are not counted.
export const CAPACITY_CONSUMING_STATUSES: ReadonlySet<AppointmentStatus> =
  new Set<AppointmentStatus>(["UPCOMING", "OCCURRED"]);

export interface CapacityCounts {
  daily: Map<number, number>; // dayKey -> booked count
  weekly: Map<number, number>; // weekKey -> booked count
}

// Tally a clinician's existing appointments into per-day and per-week counts.
export function buildCapacityCounts(
  appointments: Appointment[],
): CapacityCounts {
  const daily = new Map<number, number>();
  const weekly = new Map<number, number>();

  for (const appointment of appointments) {
    if (!CAPACITY_CONSUMING_STATUSES.has(appointment.status)) continue;
    const dayKey = utcDayKey(appointment.scheduledFor);
    const weekKey = utcWeekKey(appointment.scheduledFor);
    daily.set(dayKey, (daily.get(dayKey) ?? 0) + 1);
    weekly.set(weekKey, (weekly.get(weekKey) ?? 0) + 1);
  }

  return { daily, weekly };
}

// A booking adds one to its day and one to its week, so both must have room.
export function slotHasCapacity(
  date: Date,
  capacityCounts: CapacityCounts,
  clinician: Clinician,
): boolean {
  const day = utcDayKey(date);
  const week = utcWeekKey(date);
  return (
    (capacityCounts.daily.get(day) ?? 0) < clinician.maxDailyAppointments &&
    (capacityCounts.weekly.get(week) ?? 0) < clinician.maxWeeklyAppointments
  );
}

// The two sessions are always on different days, so daily caps are covered by
// the per-slot check. The only combined constraint is two sessions in the same
// week, which together consume two of that week's openings.
export function pairHasCapacity(
  first: Date,
  second: Date,
  capacityCounts: CapacityCounts,
  clinician: Clinician,
): boolean {
  const weekA = utcWeekKey(first);
  const weekB = utcWeekKey(second);
  if (weekA !== weekB) return true;
  return (
    (capacityCounts.weekly.get(weekA) ?? 0) + 2 <=
    clinician.maxWeeklyAppointments
  );
}
```

## `src/scheduling/assessmentSlots.ts`

```ts
import { AvailableAppointmentSlot } from "../starter-code/appointment";
import { Clinician } from "../starter-code/clinician";
import { Patient } from "../starter-code/patient";
import {
  buildCapacityCounts,
  pairHasCapacity,
  slotHasCapacity,
} from "./capacity";
import { MS_PER_DAY, utcDayKey } from "./dateKeys";
import { maximizeNonOverlappingSlots } from "./optimizeSlots";
import { AssessmentSlotPair, ClinicianAssessmentSlots } from "./types";

// An assessment is two 90-minute sessions on different days, no more than a week
// apart.
export const ASSESSMENT_SESSION_MINUTES = 90;
export const ASSESSMENT_MIN_DAYS_APART = 1;
export const ASSESSMENT_MAX_DAYS_APART = 7;

// A clinician can serve a patient's assessment only if they are a psychologist
// licensed in the patient's state and in-network for their insurance.
export function isEligibleForAssessment(
  patient: Patient,
  clinician: Clinician,
): boolean {
  return (
    clinician.clinicianType === "PSYCHOLOGIST" &&
    clinician.states.includes(patient.state) &&
    clinician.insurances.includes(patient.insurance)
  );
}

// Pair each session slot with every later slot that lands on a different day
// within the allowed window, yielding every bookable two-session option.
export function buildAssessmentPairs(
  slots: AvailableAppointmentSlot[],
): AssessmentSlotPair[] {
  // Keep only assessment-length slots, sorted earliest-to-latest so we can pair
  // earlier with later and rely on that order for the early-exit below.
  const assessmentSlots = slots
    .filter((slot) => slot.length === ASSESSMENT_SESSION_MINUTES)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const pairs: AssessmentSlotPair[] = [];

  // Consider every ordered pair (i < j) once so each option appears a single time.
  for (let i = 0; i < assessmentSlots.length; i++) {
    const first = assessmentSlots[i];
    // `first` is fixed for the inner loop, so compute its day once.
    const firstDayKey = utcDayKey(first.date);

    for (let j = i + 1; j < assessmentSlots.length; j++) {
      const second = assessmentSlots[j];
      const gap = Math.round((utcDayKey(second.date) - firstDayKey) / MS_PER_DAY);

      // Sorted earliest-to-latest, so once the gap is too large every later slot
      // is further still -> stop scanning the rest for this `first`.
      if (gap > ASSESSMENT_MAX_DAYS_APART) break;
      // Same-day (or otherwise too-close) pairs aren't valid.
      if (gap < ASSESSMENT_MIN_DAYS_APART) continue;

      pairs.push({
        session1: { date: first.date.toISOString(), length: first.length },
        session2: { date: second.date.toISOString(), length: second.length },
      });
    }
  }

  return pairs;
}

// Reduce a clinician's slots to the largest non-overlapping set before pairing,
// so we never offer two times that can't both be booked. Assumes fixed-duration
// slots.
function optimizeClinicianSlots(
  slots: AvailableAppointmentSlot[],
  durationMinutes: number,
): AvailableAppointmentSlot[] {
  const keep = new Set(
    maximizeNonOverlappingSlots(
      slots.map((slot) => slot.date),
      durationMinutes,
    ).map((date) => date.getTime()),
  );
  return slots.filter((slot) => keep.has(slot.date.getTime()));
}

// For a patient, return each eligible clinician's bookable assessment options,
// respecting slot overlap and the clinician's daily/weekly capacity.
export function getAssessmentSlotsForPatient(
  patient: Patient,
  clinicians: Clinician[],
): ClinicianAssessmentSlots[] {
  return clinicians
    .filter((clinician) => isEligibleForAssessment(patient, clinician))
    .map((clinician) => {
      const capacityCounts = buildCapacityCounts(clinician.appointments);

      // Drop slots on days/weeks already at capacity, then drop overlapping
      // slots from what remains.
      const validSlots = clinician.availableSlots.filter((slot) =>
        slotHasCapacity(slot.date, capacityCounts, clinician),
      );
      const bookableSlots = optimizeClinicianSlots(
        validSlots,
        ASSESSMENT_SESSION_MINUTES,
      );

      // Build pairs, then drop any that would push the week over its cap.
      const pairs = buildAssessmentPairs(bookableSlots).filter((pair) =>
        pairHasCapacity(
          new Date(pair.session1.date),
          new Date(pair.session2.date),
          capacityCounts,
          clinician,
        ),
      );

      return {
        clinician: {
          id: clinician.id,
          firstName: clinician.firstName,
          lastName: clinician.lastName,
        },
        pairs,
      };
    })
    .filter((result) => result.pairs.length > 0);
}
```

## `src/starter-code/mock-clinicians.ts`

```ts
import { AvailableAppointmentSlot } from "./appointment";
import { Clinician } from "./clinician";
import { MOCK_SLOT_DATA } from "./mock-slot-data";

// Map the raw { length, date } rows onto a clinician as real availability slots.
function buildSlots(clinicianId: string): AvailableAppointmentSlot[] {
  return MOCK_SLOT_DATA.map((slot, index) => ({
    id: `${clinicianId}-slot-${index}`,
    clinicianId,
    date: new Date(slot.date),
    length: slot.length,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

const JANE_DOE_ID = "9c516382-c5b2-4677-a7ac-4e100fa35bdd";

export const mockClinicians: Clinician[] = [
  // Eligible for a NY / AETNA patient: psychologist, in state, in network.
  {
    id: JANE_DOE_ID,
    firstName: "Jane",
    lastName: "Doe",
    states: ["NY", "CA"],
    insurances: ["AETNA", "CIGNA"],
    clinicianType: "PSYCHOLOGIST",
    appointments: [],
    availableSlots: buildSlots(JANE_DOE_ID),
    maxDailyAppointments: 2,
    maxWeeklyAppointments: 8,
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
    availableSlots: buildSlots("1f0e9d2c-0000-4000-8000-000000000001"),
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
    availableSlots: buildSlots("1f0e9d2c-0000-4000-8000-000000000002"),
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
    availableSlots: [],
    maxDailyAppointments: 4,
    maxWeeklyAppointments: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
```

## `src/index.ts` (demo)

```ts
import { getAssessmentSlotsForPatient } from "./scheduling/assessmentSlots";
import { mockClinicians } from "./starter-code/mock-clinicians";
import { patient } from "./starter-code/mock-patient";

const results = getAssessmentSlotsForPatient(patient, mockClinicians);

console.log(
  `Assessment options for ${patient.firstName} ${patient.lastName} ` +
    `(${patient.state}, ${patient.insurance}):`,
);
console.log(JSON.stringify(results, null, 2));
```

## Tests

The helper tests below pin down each building block in isolation; the end-to-end test exercises `getAssessmentSlotsForPatient` as a whole, confirming eligibility, capacity, overlap removal, and pairing all compose correctly.

```ts
// src/scheduling/getAssessmentSlotsForPatient.test.ts
import { getAssessmentSlotsForPatient } from "./assessmentSlots";
import {
  Appointment,
  AvailableAppointmentSlot,
} from "../starter-code/appointment";
import { Clinician } from "../starter-code/clinician";
import { Patient } from "../starter-code/patient";

const patient: Patient = {
  id: "patient",
  firstName: "Pat",
  lastName: "Ient",
  state: "NY",
  insurance: "AETNA",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function slot(clinicianId: string, date: string): AvailableAppointmentSlot {
  return {
    id: `${clinicianId}-${date}`,
    clinicianId,
    date: new Date(date),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// A clinician defaulting to an eligible (NY / AETNA) psychologist with generous
// caps; override any field per test.
function clinician(
  overrides: Partial<Clinician> & { id: string },
): Clinician {
  return {
    firstName: "Doc",
    lastName: "Tor",
    states: ["NY"],
    insurances: ["AETNA"],
    clinicianType: "PSYCHOLOGIST",
    appointments: [],
    availableSlots: [],
    maxDailyAppointments: 10,
    maxWeeklyAppointments: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("getAssessmentSlotsForPatient: returns options only for eligible clinicians, grouped by clinician", () => {
  const eligible = clinician({
    id: "eligible",
    availableSlots: [
      slot("eligible", "2024-08-19T12:00:00.000Z"),
      slot("eligible", "2024-08-21T12:00:00.000Z"),
    ],
  });
  const wrongState = clinician({
    id: "wrong-state",
    states: ["CA"],
    availableSlots: [slot("wrong-state", "2024-08-19T12:00:00.000Z")],
  });
  const therapist = clinician({
    id: "therapist",
    clinicianType: "THERAPIST",
    availableSlots: [slot("therapist", "2024-08-19T12:00:00.000Z")],
  });

  const results = getAssessmentSlotsForPatient(patient, [
    eligible,
    wrongState,
    therapist,
  ]);

  expect(results).toHaveLength(1);
  expect(results[0].clinician.id).toBe("eligible");
  expect(results[0].pairs).toEqual([
    {
      session1: { date: "2024-08-19T12:00:00.000Z", length: 90 },
      session2: { date: "2024-08-21T12:00:00.000Z", length: 90 },
    },
  ]);
});

test("getAssessmentSlotsForPatient: collapses overlapping same-day slots before pairing", () => {
  const doc = clinician({
    id: "c",
    availableSlots: [
      slot("c", "2024-08-19T12:00:00.000Z"),
      slot("c", "2024-08-19T12:15:00.000Z"), // overlaps the 12:00 slot
      slot("c", "2024-08-21T12:00:00.000Z"),
    ],
  });

  const [result] = getAssessmentSlotsForPatient(patient, [doc]);

  expect(result.pairs).toEqual([
    {
      session1: { date: "2024-08-19T12:00:00.000Z", length: 90 },
      session2: { date: "2024-08-21T12:00:00.000Z", length: 90 },
    },
  ]);
});

test("getAssessmentSlotsForPatient: omits a clinician when the only pairable day is at its daily cap", () => {
  const existing: Appointment = {
    id: "a1",
    patientId: "other",
    clinicianId: "c",
    scheduledFor: new Date("2024-08-19T08:00:00.000Z"),
    appointmentType: "ASSESSMENT_SESSION_1",
    status: "UPCOMING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const doc = clinician({
    id: "c",
    maxDailyAppointments: 1,
    appointments: [existing], // Aug 19 is now full
    availableSlots: [
      slot("c", "2024-08-19T12:00:00.000Z"), // removed (day full)
      slot("c", "2024-08-21T12:00:00.000Z"),
    ],
  });

  // Only one day survives, so no valid pair -> the clinician yields no options.
  expect(getAssessmentSlotsForPatient(patient, [doc])).toEqual([]);
});

test("getAssessmentSlotsForPatient: excludes the capped day but still pairs the remaining days", () => {
  const existing: Appointment = {
    id: "a1",
    patientId: "other",
    clinicianId: "c",
    scheduledFor: new Date("2024-08-19T08:00:00.000Z"),
    appointmentType: "ASSESSMENT_SESSION_1",
    status: "UPCOMING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const doc = clinician({
    id: "c",
    maxDailyAppointments: 1,
    appointments: [existing], // Aug 19 is now full
    availableSlots: [
      slot("c", "2024-08-19T12:00:00.000Z"), // removed (day full)
      slot("c", "2024-08-21T12:00:00.000Z"),
      slot("c", "2024-08-22T12:00:00.000Z"),
    ],
  });

  const [result] = getAssessmentSlotsForPatient(patient, [doc]);

  // Aug 19 is dropped, but Aug 21 + Aug 22 still pair.
  expect(result.pairs).toEqual([
    {
      session1: { date: "2024-08-21T12:00:00.000Z", length: 90 },
      session2: { date: "2024-08-22T12:00:00.000Z", length: 90 },
    },
  ]);
});

test("getAssessmentSlotsForPatient: omits same-week pairs that would exceed the weekly cap", () => {
  const doc = clinician({
    id: "c",
    maxWeeklyAppointments: 1, // an assessment needs two openings in one week
    availableSlots: [
      slot("c", "2024-08-19T12:00:00.000Z"),
      slot("c", "2024-08-21T12:00:00.000Z"), // same Mon-Sun week
    ],
  });

  expect(getAssessmentSlotsForPatient(patient, [doc])).toEqual([]);
});
```

```ts
// src/scheduling/optimizeSlots.test.ts
import { maximizeNonOverlappingSlots } from "./optimizeSlots";

test("maximizeNonOverlappingSlots: keeps the most slots when fixed-duration slots overlap", () => {
  const slots = [
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T12:15:00.000Z",
    "2024-08-19T12:30:00.000Z",
    "2024-08-19T12:45:00.000Z",
    "2024-08-19T13:00:00.000Z",
    "2024-08-19T13:15:00.000Z",
    "2024-08-19T13:30:00.000Z",
  ].map((date) => new Date(date));

  const kept = maximizeNonOverlappingSlots(slots, 90).map((d) =>
    d.toISOString(),
  );

  expect(kept).toEqual([
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T13:30:00.000Z",
  ]);
});

test("maximizeNonOverlappingSlots: maximizes each day independently in a single pass", () => {
  const slots = [
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T13:30:00.000Z",
    "2024-08-20T09:00:00.000Z",
    "2024-08-20T09:15:00.000Z",
  ].map((date) => new Date(date));

  const kept = maximizeNonOverlappingSlots(slots, 90).map((d) =>
    d.toISOString(),
  );

  expect(kept).toEqual([
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T13:30:00.000Z",
    "2024-08-20T09:00:00.000Z",
  ]);
});
```

```ts
// src/scheduling/assessmentSlots.test.ts
import { AvailableAppointmentSlot } from "../starter-code/appointment";
import { buildAssessmentPairs } from "./assessmentSlots";

const sampleSlots: AvailableAppointmentSlot[] = [
  "2024-08-19T12:00:00.000Z",
  "2024-08-19T12:15:00.000Z",
  "2024-08-21T12:00:00.000Z",
  "2024-08-21T15:00:00.000Z",
  "2024-08-22T15:00:00.000Z",
  "2024-08-28T12:15:00.000Z",
].map((date, index) => ({
  id: `s${index}`,
  clinicianId: "c1",
  date: new Date(date),
  length: 90,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

test("buildAssessmentPairs: pairs sessions on different days within seven days of each other", () => {
  const tuples = buildAssessmentPairs(sampleSlots).map((p) => [
    p.session1.date,
    p.session2.date,
  ]);

  expect(tuples).toEqual([
    ["2024-08-19T12:00:00.000Z", "2024-08-21T12:00:00.000Z"],
    ["2024-08-19T12:00:00.000Z", "2024-08-21T15:00:00.000Z"],
    ["2024-08-19T12:00:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-19T12:15:00.000Z", "2024-08-21T12:00:00.000Z"],
    ["2024-08-19T12:15:00.000Z", "2024-08-21T15:00:00.000Z"],
    ["2024-08-19T12:15:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-21T12:00:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-21T12:00:00.000Z", "2024-08-28T12:15:00.000Z"],
    ["2024-08-21T15:00:00.000Z", "2024-08-22T15:00:00.000Z"],
    ["2024-08-21T15:00:00.000Z", "2024-08-28T12:15:00.000Z"],
    ["2024-08-22T15:00:00.000Z", "2024-08-28T12:15:00.000Z"],
  ]);
});
```

```ts
// src/scheduling/capacity.test.ts
import { buildCapacityCounts } from "./capacity";
import { utcDayKey, utcWeekKey } from "./dateKeys";
import { Appointment } from "../starter-code/appointment";

function appt(scheduledFor: string, status: Appointment["status"]): Appointment {
  return {
    id: scheduledFor,
    patientId: "p",
    clinicianId: "c",
    scheduledFor: new Date(scheduledFor),
    appointmentType: "ASSESSMENT_SESSION_1",
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test("buildCapacityCounts: counts only capacity-consuming statuses, bucketed by day and week", () => {
  const counts = buildCapacityCounts([
    appt("2024-08-19T08:00:00.000Z", "UPCOMING"),
    appt("2024-08-19T10:00:00.000Z", "OCCURRED"),
    appt("2024-08-19T12:00:00.000Z", "CANCELLED"), // ignored
    appt("2024-08-22T09:00:00.000Z", "UPCOMING"),
  ]);

  expect(counts.daily.get(utcDayKey(new Date("2024-08-19T00:00:00.000Z")))).toBe(2);
  expect(counts.daily.get(utcDayKey(new Date("2024-08-22T00:00:00.000Z")))).toBe(1);
  expect(counts.weekly.get(utcWeekKey(new Date("2024-08-19T00:00:00.000Z")))).toBe(3);
});

test("utcWeekKey: buckets dates into Monday-start UTC weeks", () => {
  // 2024-08-18 is a Sunday -> belongs to the week of Monday 2024-08-12.
  const sunday = utcWeekKey(new Date("2024-08-18T23:00:00.000Z"));
  const monday = utcWeekKey(new Date("2024-08-12T00:00:00.000Z"));
  expect(sunday).toBe(monday);
});
```

## `package.json` scripts

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "compile": "tsc"
  }
}
```

## Run

```bash
npm run dev    # run the demo against mock data
npm test       # run the full test suite
```

## Notes

- Day and week bucketing live in one dependency-free module so pairing and capacity logic stay perfectly consistent and imports remain acyclic.
- The scheduling pipeline is plain function composition: filter eligible clinicians, drop slots at capacity, drop overlapping slots, build pairs, drop pairs that would exceed the weekly cap.
- Eligible-clinician filtering happens before any pairing, so the O(n^2) pairing only runs on a small matched subset; the design scales to large clinician pools.
- Two business assumptions are each isolated to a single place: the week boundary (Monday-start) in `utcWeekKey`, and which appointment statuses consume capacity in `CAPACITY_CONSUMING_STATUSES`.
- The same capacity helpers work for a single-appointment flow (e.g. a therapy intake): apply `slotHasCapacity` and skip the pairing step.

