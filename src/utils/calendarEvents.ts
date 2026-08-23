import type { Appointment } from "../services/types";

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
    title: appointment.patient_info.full_name,
    start,
    end,
    resource: appointment,
  };
}

export function appointmentsToEvents(appointments: Appointment[]): AppointmentCalendarEvent[] {
  return appointments.map(appointmentToEvent);
}
