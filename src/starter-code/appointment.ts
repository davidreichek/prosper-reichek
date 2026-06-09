export const AppointmentStatuses = [
  "UPCOMING",
  "OCCURRED",
  "NO_SHOW",
  "RE_SCHEDULED",
  "CANCELLED",
  "LATE_CANCELLATION",
] as const;
export type AppointmentStatus = (typeof AppointmentStatuses)[number];

export const AppointmentTypes = [
  "ASSESSMENT_SESSION_1",
  "ASSESSMENT_SESSION_2",
  "THERAPY_INTAKE",
  "THERAPY_SIXTY_MINS",
] as const;
export type AppointmentType = (typeof AppointmentTypes)[number];

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  scheduledFor: Date;
  appointmentType: AppointmentType;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailableAppointmentSlot {
  id: string;
  clinicianId: string;
  date: Date;
  length: number;
  createdAt: Date;
  updatedAt: Date;
}
