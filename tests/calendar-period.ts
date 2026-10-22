import assert from "node:assert/strict";
import { format } from "date-fns";
import {
  calendarDateLabel,
  zonedCalendarDate,
  calendarRange,
  shiftCalendar,
  matchesClients,
  selectedClients,
} from "../src/lib/calendar-period.ts";
const day = (value: string) => new Date(value + "T12:00:00");
assert.equal(
  zonedCalendarDate(new Date("2026-10-14T02:59:59Z"), "America/Fortaleza"),
  "2026-10-13",
);
assert.equal(
  zonedCalendarDate(new Date("2026-10-14T03:00:00Z"), "America/Fortaleza"),
  "2026-10-14",
);
assert.equal(
  zonedCalendarDate(new Date("2026-10-14T03:00:00Z"), "America/Los_Angeles"),
  "2026-10-13",
);
for (const view of ["month", "week", "day", "list"]) {
  const range = calendarRange(day("2026-10-13"), view);
  assert.ok(range.from <= "2026-10-13" && range.to >= "2026-10-13");
}
assert.equal(calendarRange(day("2026-10-13"), "day").days.length, 1);
assert.equal(calendarRange(day("2026-10-13"), "week").days.length, 7);
assert.equal(format(shiftCalendar(day("2026-10-13"), "day", 1), "yyyy-MM-dd"), "2026-10-14");
assert.equal(format(shiftCalendar(day("2026-12-29"), "week", 1), "yyyy-MM-dd"), "2027-01-05");
assert.equal(format(shiftCalendar(day("2026-12-29"), "month", 1), "yyyy-MM-dd"), "2027-01-29");
assert.equal(format(shiftCalendar(day("2028-01-31"), "month", 1), "yyyy-MM-dd"), "2028-02-29");
assert.ok(matchesClients("client-a,client-b", "client-a"));
assert.ok(matchesClients("client-a,client-b", "client-b"));
assert.ok(!matchesClients("client-a,client-b", "client-c"));
assert.ok(!matchesClients("client-a,client-b", null));
assert.ok(matchesClients("all", "client-c"));
assert.deepEqual(
  selectedClients("client-a"),
  ["client-a"],
  "legacy single-client preference remains valid",
);
const saved = JSON.parse(
  JSON.stringify({ clients: "client-a,client-b", date: "2026-12-31", view: "day" }),
);
assert.ok(matchesClients(saved.clients, "client-b"));
assert.equal(calendarRange(day(saved.date), saved.view).from, "2026-12-31");
console.log(
  "PASS: timezone midnight, today period in all views, day/week/month transitions, leap year and persisted multiple-client selection",
);

for (const zone of ["America/Fortaleza", "UTC", "America/Los_Angeles", "Pacific/Auckland"]) {
  process.env.TZ = zone;
  assert.equal(calendarDateLabel("2026-10-19"), "19/10/2026", `DATE must not shift in ${zone}`);
  assert.equal(calendarDateLabel("2028-02-29"), "29/02/2028");
}
assert.equal(calendarDateLabel(null), "Data a definir");
