# Prosper Health Scheduling

Online scheduling logic that, given a patient, returns the assessment session
options they can book with each eligible clinician.

## Where things live

- `REQUIREMENTS.md` - the original take-home prompt 
- `SPEC_TASK1.md`, `SPEC_TASK2.md`, `SPEC_TASK3.md` - the per-task breakdowns of requirements and business logic, developed in order for easier verification / readability.
- `SPEC_MERGED.md` - the consolidated, final implementation
- `getAssessmentSlotsForPatient()` - entry point

## Assumptions

- **"7 days apart" means 7 calendar days, not 7 x 24 hours.** We compare the two slots by UTC date (time of day ignored), not by elapsed time. So Mon 9:00am and the next Mon 4:00pm are "7 days apart" and qualify; the time-based reading would call that 7 days + 7 hours and reject it.
- **Capacity-consuming statuses.** Only `UPCOMING` and `OCCURRED` count toward the caps; `CANCELLED` / `RE_SCHEDULED` free the slot, and `NO_SHOW` / `LATE_CANCELLATION` are past events. Configurable in `CAPACITY_CONSUMING_STATUSES`.
- **Week boundary.** A week is Monday-start, in UTC. The prompt says "per week" without defining a boundary; configurable in `utcWeekKey`.
- **Caps count all appointment types**, not just assessments, matching the description of `maxDailyAppointments` / `maxWeeklyAppointments` as absolute caps.
- **Available slots are assumed pre-deconflicted from existing appointments.** Existing appointments are used only for daily/weekly capacity counts; we do not separately check whether an available slot time-overlaps a booked appointment, on the assumption the EHR only surfaces genuinely open slots.
- **Options are evaluated independently against current bookings.** Remaining capacity is not decremented while generating options -- each pair is a hypothetical shown to the patient, not a commitment.

## Design notes

- **Slot optimization maximizes throughput, not patient choice.** When a day offers overlapping slots at fine intervals, we keep only a densest non-overlapping set so the clinician's day holds as many appointments as possible -- deliberately surfacing fewer options rather than every bookable time.

## Running

```bash
npm install
npm run dev        # demo: prints assessment options for the mock patient
npm test           # full test suite
npm run compile    # type-check / build (tsc)
```

