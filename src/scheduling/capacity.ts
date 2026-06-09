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
