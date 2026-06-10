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

// When availability is listed at fine intervals, many start times overlap as
// 90-minute windows. Keep the largest non-overlapping subset so the day holds
// as many bookable appointments as possible (throughput). Fixed-duration only.
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
// respecting daily throughput optimization and the clinician's capacity caps.
export function getAssessmentSlotsForPatient(
  patient: Patient,
  clinicians: Clinician[],
): ClinicianAssessmentSlots[] {
  return clinicians
    .filter((clinician) => isEligibleForAssessment(patient, clinician))
    .map((clinician) => {
      const capacityCounts = buildCapacityCounts(clinician.appointments);

      // Drop slots on days/weeks already at capacity, then reduce what remains
      // to a maximum non-overlapping set (most bookable appointments per day).
      const validSlots = clinician.availableSlots.filter((slot) =>
        slotHasCapacity(slot.date, capacityCounts, clinician),
      );
      const bookableSlots = optimizeClinicianSlots(
        validSlots,
        ASSESSMENT_SESSION_MINUTES,
      );

      // Build pairs, then drop any whose two sessions would exceed the weekly cap.
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
