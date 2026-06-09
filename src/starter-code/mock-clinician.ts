import { Clinician } from "./clinician";

export const clinician: Clinician = {
  id: "9c516382-c5b2-4677-a7ac-4e100fa35bdd",
  firstName: "Jane",
  lastName: "Doe",
  states: ["NY", "CA"],
  insurances: ["AETNA", "CIGNA"],
  clinicianType: "PSYCHOLOGIST",
  appointments: [],
  availableSlots: [],
  maxDailyAppointments: 2,
  maxWeeklyAppointments: 8,
  createdAt: new Date(),
  updatedAt: new Date(),
};
