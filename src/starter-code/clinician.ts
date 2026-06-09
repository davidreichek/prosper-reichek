import { Appointment, AvailableAppointmentSlot } from "./appointment";
import { InsurancePayer } from "./payer";
import { UsStateAbbreviation } from "./us-states";

export const ClinicianTypes = ["THERAPIST", "PSYCHOLOGIST"] as const;

export type ClinicianType = (typeof ClinicianTypes)[number];

export interface Clinician {
  id: string;
  firstName: string;
  lastName: string;
  states: UsStateAbbreviation[];
  insurances: InsurancePayer[];
  clinicianType: ClinicianType;
  appointments: Appointment[];
  availableSlots: AvailableAppointmentSlot[];
  maxDailyAppointments: number;
  maxWeeklyAppointments: number;
  createdAt: Date;
  updatedAt: Date;
}
