export const InsurancePayers = ["AETNA", "BCBS", "CIGNA", "UNITED"] as const;

export type InsurancePayer = (typeof InsurancePayers)[number];
