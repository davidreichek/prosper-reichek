import {
  buildCapacityCounts,
  pairHasCapacity,
  slotHasCapacity,
} from "./capacity";
import { utcDayKey, utcWeekKey } from "./dateKeys";
import { Appointment } from "../starter-code/appointment";
import { Clinician } from "../starter-code/clinician";

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

// Only the cap fields matter for the capacity helpers; the rest is filler.
function clinician(overrides: Partial<Clinician> = {}): Clinician {
  return {
    id: "c",
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

// Aug 19 2024 is a Monday, so Aug 19-25 share a Monday-start week.
const MON_AUG_19 = new Date("2024-08-19T12:00:00.000Z");
const WED_AUG_21 = new Date("2024-08-21T12:00:00.000Z");
const MON_AUG_26 = new Date("2024-08-26T12:00:00.000Z"); // next week

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

test("slotHasCapacity: allows a slot when its day and week are both under cap", () => {
  const counts = buildCapacityCounts([]);
  expect(slotHasCapacity(MON_AUG_19, counts, clinician())).toBe(true);
});

test("slotHasCapacity: rejects a slot when its day is already at the daily cap", () => {
  const counts = buildCapacityCounts([appt("2024-08-19T08:00:00.000Z", "UPCOMING")]);
  const doc = clinician({ maxDailyAppointments: 1, maxWeeklyAppointments: 10 });
  expect(slotHasCapacity(MON_AUG_19, counts, doc)).toBe(false);
});

test("slotHasCapacity: rejects a slot when its week is already at the weekly cap", () => {
  // One booking earlier in the same week fills a weekly cap of 1.
  const counts = buildCapacityCounts([appt("2024-08-20T08:00:00.000Z", "UPCOMING")]);
  const doc = clinician({ maxDailyAppointments: 10, maxWeeklyAppointments: 1 });
  // The candidate slot is on a different day (so daily is fine) but same week.
  expect(slotHasCapacity(MON_AUG_19, counts, doc)).toBe(false);
});

test("pairHasCapacity: always allows a pair whose sessions fall in different weeks", () => {
  // Even with a weekly cap of 1, two different weeks each only gain one session.
  const counts = buildCapacityCounts([]);
  const doc = clinician({ maxWeeklyAppointments: 1 });
  expect(pairHasCapacity(WED_AUG_21, MON_AUG_26, counts, doc)).toBe(true);
});

test("pairHasCapacity: allows a same-week pair only when the week has room for two", () => {
  const counts = buildCapacityCounts([]);
  expect(
    pairHasCapacity(MON_AUG_19, WED_AUG_21, counts, clinician({ maxWeeklyAppointments: 2 })),
  ).toBe(true);
});

test("pairHasCapacity: rejects a same-week pair when the week has room for only one", () => {
  const counts = buildCapacityCounts([]);
  expect(
    pairHasCapacity(MON_AUG_19, WED_AUG_21, counts, clinician({ maxWeeklyAppointments: 1 })),
  ).toBe(false);
});

test("pairHasCapacity: counts existing bookings when checking same-week room for two", () => {
  // One booking already this week; cap of 3 leaves exactly room for two more.
  const counts = buildCapacityCounts([appt("2024-08-19T08:00:00.000Z", "UPCOMING")]);
  expect(
    pairHasCapacity(MON_AUG_19, WED_AUG_21, counts, clinician({ maxWeeklyAppointments: 3 })),
  ).toBe(true);
  // With a cap of 2, the existing booking + two new sessions (=3) overflows.
  expect(
    pairHasCapacity(MON_AUG_19, WED_AUG_21, counts, clinician({ maxWeeklyAppointments: 2 })),
  ).toBe(false);
});
