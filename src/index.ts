import { getAssessmentSlotsForPatient } from "./scheduling/assessmentSlots";
import { mockClinicians } from "./starter-code/mock-clinicians";
import { patient } from "./starter-code/mock-patient";

const results = getAssessmentSlotsForPatient(patient, mockClinicians);

console.log(
  `Assessment options for ${patient.firstName} ${patient.lastName} ` +
    `(${patient.state}, ${patient.insurance}):\n`,
);

for (const { clinician, pairs } of results) {
  console.log(
    `${clinician.firstName} ${clinician.lastName} - ${pairs.length} option(s)`,
  );
}

console.log("\nFull result:");
console.log(JSON.stringify(results, null, 2));
