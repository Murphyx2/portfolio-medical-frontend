import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useTranslation } from "react-i18next";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

import type { Appointment } from "../services/types";
import { appointmentsToEvents, type AppointmentCalendarEvent } from "../utils/calendarEvents";

const dateFnsLocales = { en: enUS, es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: dateFnsLocales,
});

export interface CalendarDateRange {
  start: Date;
  end: Date;
}

/** Visible date range for a given `view`/`date` -- for month view this
 * pads out to the full displayed grid (leading/trailing days from
 * adjacent months react-big-calendar renders in the corner cells), not
 * just the calendar month itself, so those cells' events are fetched too.
 * `end` is exclusive, matching the API's `date_time__lt` filter. */
export function getVisibleRange(date: Date, view: View): CalendarDateRange {
  const locale = { locale: es };
  if (view === Views.MONTH) {
    return {
      start: startOfWeek(startOfMonth(date), locale),
      end: addDays(endOfWeek(endOfMonth(date), locale), 1),
    };
  }
  if (view === Views.WEEK) {
    const start = startOfWeek(date, locale);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

/**
 * `react-big-calendar` wrapper for Appointments' Calendar mode. Owns its
 * own `view`/`date` navigation state and reports the resulting visible
 * range to the parent (via `onRangeChange`) so it can drive
 * `useCalendarAppointments` -- the parent owns data fetching, search
 * filtering, and the details dialog; this component is presentational.
 */
export function AppointmentCalendar({
  appointments,
  onSelectAppointment,
  onRangeChange,
}: {
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  onRangeChange: (range: CalendarDateRange) => void;
}) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(() => new Date());
  const culture = i18n.language === "en" ? "en" : "es";

  const range = useMemo(() => getVisibleRange(date, view), [date, view]);

  useEffect(() => {
    onRangeChange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start.getTime(), range.end.getTime()]);

  const events = useMemo(() => appointmentsToEvents(appointments), [appointments]);

  const messages = useMemo(
    () => ({
      today: t("appointments.calendar.today"),
      previous: t("appointments.calendar.previous"),
      next: t("appointments.calendar.next"),
      month: t("appointments.calendar.month"),
      week: t("appointments.calendar.week"),
      day: t("appointments.calendar.day"),
      date: t("appointments.calendar.date"),
      time: t("appointments.calendar.time"),
      event: t("appointments.calendar.event"),
      noEventsInRange: t("appointments.calendar.noEventsInRange"),
      showMore: (count: number) => t("appointments.calendar.showMore", { count }),
    }),
    [t],
  );

  return (
    <div className="appointment-calendar">
      <Calendar<AppointmentCalendarEvent>
        localizer={localizer}
        culture={culture}
        events={events}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        style={{ height: 700 }}
        date={date}
        view={view}
        onNavigate={(newDate) => setDate(newDate)}
        onView={(newView) => setView(newView)}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        messages={messages}
        popup
        eventPropGetter={(event: AppointmentCalendarEvent) => ({
          className: `rbc-status-${event.resource.status.toLowerCase()}`,
        })}
        onSelectEvent={(event: AppointmentCalendarEvent) => onSelectAppointment(event.resource)}
      />
    </div>
  );
}
