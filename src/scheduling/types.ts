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
