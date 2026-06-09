# Prosper Health Engineering Take Home

2025

# Scenario

We want new patients to schedule their appointments online. Given a patient who comes in wanting our services (therapy and/or an assessment), which times are available for them to book? And with which clinicians?

# Output

When you’re done with the project, please share a link to a GitHub repo with a short README and schedule some time on my calendar for us to discuss your work: [https://calendly.com/prosper-byrne/30min](https://calendly.com/prosper-byrne/30min).

You’re welcome to do this in whichever language you’re most comfortable in. (If you’re having a hard time choosing, I recommend TypeScript!)

# Details

We have 2 types of clinicians and 4 types of appointments:

1. Therapists
   1. They have 60 minute long appointments with clients (`THERAPY_INTAKE` and `THERAPY_SIXTY_MINS`)
      1. Only the intake appointment (`THERAPY_INTAKE`) needs to be scheduled online – all recurring therapy sessions (`THERAPY_SIXTY_MINS`) are scheduled by therapists either in-session or by chat after the intake.
2. Psychologists
   1. They have 90 minute long appointments with clients (`ASSESSMENT_SESSION_1` and `ASSESSMENT_SESSION_2`).

When we schedule someone for their first therapy session, they are scheduled for a 60 minute `THERAPY_INTAKE` appointment with a therapist in their state who accepts their insurance.

When we schedule someone for an assessment with a psychologist, we schedule them for _both_ 90-minute sessions. These sessions must be on different days but no more than 7 days apart.

We are using an electronic health records (EHR) system that lets us query for clinician availability and existing appointments, and we have stored this data in the following tables:

```jsx
model AvailableSlot {
  id                      String
  clinicianId             String    @db.Uuid
  clinician               Clinician @relation(fields: [clinicianId], references: [id])
  date                    DateTime
  length                  Int
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @default(now()) @updatedAt
}

model Appointment {
  id                      String
  patientId               String    @db.Uuid
  patient                 Patient   @relation(fields: [patientId], references: [id])
  clinicianId             String    @db.Uuid
  clinician               Clinician @relation(fields: [clinicianId], references: [id])
  scheduledFor            DateTime
  appointmentType         AppointmentType
  status                  AppointmentStatus
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @default(now()) @updatedAt
}

enum AppointmentType {
  ASSESSMENT_SESSION_1
  ASSESSMENT_SESSION_2
  THERAPY_INTAKE
  THERAPY_SIXTY_MINS
}

enum AppointmentStatus {
  UPCOMING
  OCCURRED
  NO_SHOW
  RE_SCHEDULED
  CANCELLED
  LATE_CANCELLATION
}
```

Here are some examples of `AvailableSlot`s:

```jsx
id,clinicianId,date,length,createdAt,updatedAt
1eb8f4c2-b7a7-4bf1-b738-b1e5875f4fec,9c516382-c5b2-4677-a7ac-4e100fa35bdd,2024-08-27 18:00:00,90,2024-08-15 14:45:15.462,2024-08-15 14:45:15.462
64759e13-c8c8-4310-9cf1-00bed7b394a8,9c516382-c5b2-4677-a7ac-4e100fa35bdd,2024-08-27 18:45:00,90,2024-08-15 14:45:15.462,2024-08-15 14:45:15.462
ed95c383-9059-4054-8270-bd9e2fd12ebb,68ae6b35-c27f-4f62-9b21-b6783c24a370,2024-08-28 18:45:00,60,2024-08-15 14:45:15.462,2024-08-15 14:45:15.462
f118a534-3269-4a28-95fc-6b0523d31c1a,68ae6b35-c27f-4f62-9b21-b6783c24a370,2024-08-28 19:00:00,60,2024-08-15 14:45:15.462,2024-08-15 14:45:15.462
```

Note that:

- The first 2 slots are 90 minutes long (`length` is measured in minutes) and the second 2 slots are 60 minutes long.
  - We would join on `clinicianId` to determine if the `Clinician` is a `THERAPIST` or a `PSYCHOLOGIST` but, as the business stands today, we can determine that anyone with a 90 minute long slot is a `PSYCHOLOGIST` and anyone with a 60 minute long slot is a `THERAPIST`.
- The `date`s are all in UTC and represent the start time for the slot
- So the slot starting at `2024-08-27 18:00:00` at lasting 90 minutes would end at `2024-08-27 19:30:00`

I think the `Appointment` model is mostly self-explanatory, but please feel free to ask any questions about it.

We have the following schema for `Patient`s and `Clinician`s:

```jsx
model Patient {
  id                      String
  firstName               String
  lastName                String
  state                   UsState
  insurance               InsurancePayer
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @default(now()) @updatedAt
}

model Clinician {
  id                      String
  firstName               String
  lastName                String
  states                  UsState[]
  insurances              InsurancePayer[]
  clinicianType           ClinicianType
  appointments            Appointment[]
  availableSlots          AvailableSlot[]
  maxDailyAppointments    Int
  maxWeeklyAppointments   Int
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @default(now()) @updatedAt
}

enum ClinicianType {
  THERAPIST
  PSYCHOLOGIST
}

enum UsState {
  NY
  NC
  FL
  // etc
}

enum InsurancePayer {
  AETNA
  BCBS
  CIGNA
  // etc
}
```

There are a few things to note about `Clinician`s:

1. `maxDailyAppointments` – this is the absolute maximum number of appointments a Clinician can have per day; a client should never be able to book an appointment on a day where a clinician has number of booked appointments ≥ to `maxDailyAppointments`
   1. This is set on a clinician-by-clinician basis
2. `maxWeeklyAppointments` – this is the absolute maximum number of appointments a clinician have per week.
   1. This is set on a clinician-by-clinician basis
3. They can operate in multiple `states`, but must have at least one state
4. They can accept multiple `insurances`, and must have at least one insurance

One other thing to note about scheduling:

- A patient can only schedule with a provider who accepts their insurance and operates in their state

# Tasks

The following three tasks will build upon one another.

## Task 1: Assessment slots

Write some code that takes a patient and outputs a list of available assessment slots for them to schedule; the slots should be grouped by clinician.

<aside>
💡 As mentioned above, when we schedule someone for an assessment with a psychologist, we schedule them for *both* 90-minute sessions. These sessions must be on different days but no more than 7 days apart. So we really need to offer 2 appointment times to a client scheduling an assessment.

</aside>

**Example:**

**Input:**

Patient `Byrne Hollander` lives in `NY` and has insurance of `AETNA` and wants just an assessment.

```jsx
// The patient coming in for services - they want just an assessment
{
   id: "some-uuidv4",
   firstName: "Byrne",
   lastName: "Hollander",
   state: UsState.NY,
   insurance: InsurancePayer.AETNA,
   createdAt: new Date(),
   updatedAt: new Date()
}
```

```jsx
// Our database table of clinicians and appointments... we only have 1
// right now, but we'll be growing fast!
// We also don't have any appointments booked yet with Dr. Doe –
// let's revisit this piece (appointments and max appointments) later

{
  id: "9c516382-c5b2-4677-a7ac-4e100fa35bdd",
  firstName: "Jane",
  lastName: "Doe",
  states: [UsState.NY, UsState.CA],
  insurances: [InsurancePayer.Aetna, InsurancePayer.Cigna],
  clinicianType: ClinicianType.PSYCHOLOGIST,
  appointments: [],
  maxDailyAppointments: 2,
  maxWeeklyAppointments: 8,
}
```

Here’s a JSON dump of actual slots from our db so you don’t need to come up with all synthetic data:

[slots.json](Prosper%20Health%20Engineering%20Take%20Home%20115483f1ec5780deaf59efbcd2bdd4c4/slots.json)

**Expected output:**

Let’s look at 6 of these slots in particular (all for Dr. Doe, the psychologist above):

```jsx
[
  {
    length: 90,
    date: "2024-08-19T12:00:00.000Z",
  },
  {
    length: 90,
    date: "2024-08-19T12:15:00.000Z",
  },
  {
    length: 90,
    date: "2024-08-21T12:00:00.000Z",
  },
  {
    length: 90,
    date: "2024-08-21T15:00:00.000Z",
  },
  {
    length: 90,
    date: "2024-08-22T15:00:00.000Z",
  },
  {
    length: 90,
    date: "2024-08-28T12:15:00.000Z",
  },
];
```

The pairs of times that can be offered to clients are:

```jsx
[
  ("2024-08-19T12:00:00.000Z", "2024-08-21T12:00:00.000Z"),
  ("2024-08-19T12:00:00.000Z", "2024-08-21T15:00:00.000Z"),
  ("2024-08-19T12:00:00.000Z", "2024-08-22T15:00:00.000Z"),
  ("2024-08-19T12:15:00.000Z", "2024-08-21T12:00:00.000Z"),
  ("2024-08-19T12:15:00.000Z", "2024-08-21T15:00:00.000Z"),
  ("2024-08-19T12:15:00.000Z", "2024-08-22T15:00:00.000Z"),
  ("2024-08-21T12:00:00.000Z", "2024-08-22T15:00:00.000Z"),
  ("2024-08-21T12:00:00.000Z", "2024-08-28T12:15:00.000Z"),
  ("2024-08-21T15:00:00.000Z", "2024-08-22T15:00:00.000Z"),
  ("2024-08-21T15:00:00.000Z", "2024-08-28T12:15:00.000Z"),
  ("2024-08-22T15:00:00.000Z", "2024-08-28T12:15:00.000Z"),
];
```

**I.e., the code you write should return the above data.** It doesn’t need to be structured as an array of tuples, you can go with a different approach if you want.

You definitely don’t need to use Prisma or actually set up a db – you can mock the patient, clinician(s), available slots, and appointments however you like.

However, this code should support us having hundreds of clinicians – some who don’t operate in NY or accept Aetna, but others who do.

_Writing tests is optional_

## Task 2: Optimizing which slots we show

Sometimes our available slots look something like this (i.e., 12pm to 1:30pm at 15 minute intervals):

```jsx
"2024-08-19T12:00:00.000Z";
"2024-08-19T12:15:00.000Z";
"2024-08-19T12:30:00.000Z";
"2024-08-19T12:45:00.000Z";
"2024-08-19T13:00:00.000Z";
"2024-08-19T13:15:00.000Z";
"2024-08-19T13:30:00.000Z";
```

When one of these 90-minute slots is booked, most – or all – of the others are no longer able to be booked because they would overlap with each other.

E.g., if the 12pm slot is booked, then these slots could no longer be booked:

```jsx
"2024-08-19T12:15:00.000Z";
"2024-08-19T12:30:00.000Z";
"2024-08-19T12:45:00.000Z";
"2024-08-19T13:00:00.000Z";
"2024-08-19T13:15:00.000Z";
```

because the 12pm appointment doesn’t end until 1:30pm. Still, this appointment would be bookable:

```jsx
"2024-08-19T13:30:00.000Z";
```

If someone scheduled the 12:15pm slot instead of the 12pm slot, then _all_ other time slots would no longer be available.

So, we want to a function that filters out slots that reduce the number of appointments that can happen on a given day. So for:

```jsx
"2024-08-19T12:00:00.000Z";
"2024-08-19T12:15:00.000Z";
"2024-08-19T12:30:00.000Z";
"2024-08-19T12:45:00.000Z";
"2024-08-19T13:00:00.000Z";
"2024-08-19T13:15:00.000Z";
"2024-08-19T13:30:00.000Z";
```

We would only want to keep these 2 datetimes:

```jsx
"2024-08-19T12:00:00.000Z";
"2024-08-19T13:30:00.000Z";
```

**Write a function that takes a list of dates, and a duration (like 90 minutes) and filters it to maximize number of possible appointments that can be scheduled.**

If possible, incorporate this with the code from task 1.

_Writing tests is optional_

## Task 3: Taking clinician capacity into account

Scheduling is going well, and we now have tons of appointments scheduled!

```jsx
{
  id: "9c516382-c5b2-4677-a7ac-4e100fa35bdd",
  firstName: "Jane",
  lastName: "Doe",
  states: [UsState.NY, UsState.CA],
  insurances: [InsurancePayer.Aetna, InsurancePayer.Cigna],
  clinicianType: ClinicianType.PSYCHOLOGIST,
  appointments: [
     // dozens of appointments!
  ],
  maxDailyAppointments: 2,
  maxWeeklyAppointments: 8,
}
```

However, we promised Dr. Doe that she would never have more than 2 appointments per day, and never more than 8 appointments per week.

**Update the code from tasks 1 and 2 to take already scheduled appointments,** `maxDailyAppointments`, and `maxWeeklyAppointments` into account when determining which slots we show to patients.

<aside>
👉

You should optimize for correctness and readability of your app code: the most important thing is that it your code works and is easy (enough) to follow.

In general, I recommend having the minimal possible scaffolding for the project: no need to use an actual database (mocked data is 100% sufficient), no need to setup a server, etc.

The business logic is the main purpose of the challenge 😎

</aside>
