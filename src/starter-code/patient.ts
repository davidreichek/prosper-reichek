import { InsurancePayer } from "./payer";
import { UsStateAbbreviation } from "./us-states";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  state: UsStateAbbreviation;
  insurance: InsurancePayer;
  createdAt: Date;
  updatedAt: Date;
}
