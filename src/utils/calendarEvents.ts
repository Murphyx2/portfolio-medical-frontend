import { format } from "date-fns";

import type { Appointment } from "../services/types";

// Appointment.patient_info only carries full_name (no structured
// first/last split, unlike Patient/Encounter), and Dominican names
// typically carry two surnames ("Nombre Apellido Apellido") -- so a chip
// label takes the last two tokens when there are three or more, otherwise
// just the last token, rather than risking a single ambiguous surname.
function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return parts.slice(-2).join(" ");
  return parts[parts.length - 1] ?? fullName;
}

/** One `react-big-calendar` event, carrying the source `Appointment` back
 * out via `resource` so click handlers (open the details dialog,
 * `eventPropGetter` status coloring) don't need a second lookup. */
export interface AppointmentCalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

/** Pure Appointment -> calendar-event mapper. `end` is derived from
 * `duration_minutes` since the API doesn't return an explicit end time. */
export function appointmentToEvent(appointment: Appointment): AppointmentCalendarEvent {
  const start = new Date(appointment.date_time);
  const end = new Date(start.getTime() + appointment.duration_minutes * 60000);
  return {
    id: appointment.id,
    // "9:10 Perez" -- time + last name, not the full name, so chips stay
    // readable at month-view sizes (list-pages redesign, spec §6).
    title: `${format(start, "H:mm")} ${lastNameOf(appointment.patient_info.full_name)}`,
    start,
    end,
    resource: appointment,
  };
}

export function appointmentsToEvents(appointments: Appointment[]): AppointmentCalendarEvent[] {
  return appointments.map(appointmentToEvent);
}
