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
