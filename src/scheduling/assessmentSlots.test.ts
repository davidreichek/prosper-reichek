import { AvailableAppointmentSlot } from "../starter-code/appointment";
import { Clinician } from "../starter-code/clinician";
import { Patient } from "../starter-code/patient";
import {
  buildAssessmentPairs,
  isEligibleForAssessment,
} from "./assessmentSlots";

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

function slotsOn(dates: string[]): AvailableAppointmentSlot[] {
  return dates.map((date, index) => ({
    id: `s${index}`,
    clinicianId: "c1",
    date: new Date(date),
    length: 90,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

test("buildAssessmentPairs: includes a pair exactly seven days apart (inclusive window)", () => {
  // Aug 19 -> Aug 26 is exactly 7 calendar days: still allowed.
  const pairs = buildAssessmentPairs(
    slotsOn(["2024-08-19T12:00:00.000Z", "2024-08-26T12:00:00.000Z"]),
  );
  expect(pairs).toHaveLength(1);
});

test("buildAssessmentPairs: excludes a pair eight days apart (just past the window)", () => {
  // Aug 19 -> Aug 27 is 8 calendar days: outside the window.
  const pairs = buildAssessmentPairs(
    slotsOn(["2024-08-19T12:00:00.000Z", "2024-08-27T12:00:00.000Z"]),
  );
  expect(pairs).toEqual([]);
});

test("buildAssessmentPairs: excludes same-day pairs even when times differ", () => {
  const pairs = buildAssessmentPairs(
    slotsOn(["2024-08-19T12:00:00.000Z", "2024-08-19T18:00:00.000Z"]),
  );
  expect(pairs).toEqual([]);
});

test("buildAssessmentPairs: ignores slots that are not assessment length", () => {
  const mixed: AvailableAppointmentSlot[] = [
    { ...slotsOn(["2024-08-19T12:00:00.000Z"])[0] },
    { ...slotsOn(["2024-08-21T12:00:00.000Z"])[0], length: 60 }, // therapy length
  ];
  expect(buildAssessmentPairs(mixed)).toEqual([]);
});

const patient: Patient = {
  id: "p",
  firstName: "Pat",
  lastName: "Ient",
  state: "NY",
  insurance: "AETNA",
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

test("isEligibleForAssessment: true when a psychologist matches state and insurance", () => {
  expect(isEligibleForAssessment(patient, clinician())).toBe(true);
});

test("isEligibleForAssessment: false when the clinician is not a psychologist", () => {
  expect(
    isEligibleForAssessment(patient, clinician({ clinicianType: "THERAPIST" })),
  ).toBe(false);
});

test("isEligibleForAssessment: false when the clinician is out of the patient's state", () => {
  expect(
    isEligibleForAssessment(patient, clinician({ states: ["CA"] })),
  ).toBe(false);
});

test("isEligibleForAssessment: false when the clinician is out of network for the insurance", () => {
  expect(
    isEligibleForAssessment(patient, clinician({ insurances: ["BCBS"] })),
  ).toBe(false);
});
