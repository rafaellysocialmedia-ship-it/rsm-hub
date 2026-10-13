import {
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from "date-fns";
export function zonedCalendarDate(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function calendarRange(cursor: Date, view: string) {
  const start =
    view === "day"
      ? cursor
      : view === "week"
        ? startOfWeek(cursor, { weekStartsOn: 1 })
        : startOfMonth(cursor);
  const end =
    view === "day"
      ? cursor
      : view === "week"
        ? endOfWeek(cursor, { weekStartsOn: 1 })
        : endOfMonth(cursor);
  const gridStart = view === "month" ? startOfWeek(start, { weekStartsOn: 1 }) : start;
  const gridEnd = view === "month" ? endOfWeek(end, { weekStartsOn: 1 }) : end;
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  return {
    start,
    end,
    days,
    from: format(gridStart, "yyyy-MM-dd"),
    to: format(gridEnd, "yyyy-MM-dd"),
  };
}
export function shiftCalendar(cursor: Date, view: string, direction: number) {
  return view === "day"
    ? addDays(cursor, direction)
    : view === "week"
      ? addDays(cursor, direction * 7)
      : addMonths(cursor, direction);
}
export function selectedClients(value: string) {
  return value === "all" ? [] : value.split(",").filter(Boolean);
}
export function matchesClients(value: string, clientId: string | null) {
  const ids = selectedClients(value);
  return !ids.length || (!!clientId && ids.includes(clientId));
}
