import { maximizeNonOverlappingSlots } from "./optimizeSlots";

test("maximizeNonOverlappingSlots: keeps the most slots when fixed-duration slots overlap", () => {
  const slots = [
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T12:15:00.000Z",
    "2024-08-19T12:30:00.000Z",
    "2024-08-19T12:45:00.000Z",
    "2024-08-19T13:00:00.000Z",
    "2024-08-19T13:15:00.000Z",
    "2024-08-19T13:30:00.000Z",
  ].map((date) => new Date(date));

  const kept = maximizeNonOverlappingSlots(slots, 90).map((d) =>
    d.toISOString(),
  );

  expect(kept).toEqual([
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T13:30:00.000Z",
  ]);
});

test("maximizeNonOverlappingSlots: maximizes each day independently in a single pass", () => {
  const slots = [
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T13:30:00.000Z",
    "2024-08-20T09:00:00.000Z",
    "2024-08-20T09:15:00.000Z",
  ].map((date) => new Date(date));

  const kept = maximizeNonOverlappingSlots(slots, 90).map((d) =>
    d.toISOString(),
  );

  expect(kept).toEqual([
    "2024-08-19T12:00:00.000Z",
    "2024-08-19T13:30:00.000Z",
    "2024-08-20T09:00:00.000Z",
  ]);
});
