import { format } from "date-fns";
import { describe, expect, it } from "vitest";

import { appointmentToEvent, appointmentsToEvents } from "./calendarEvents";
import type { Appointment } from "../services/types";

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    patient: 10,
    patient_info: { id: 10, full_name: "Jane Doe", gender: "FEMALE", phone: "8095551212" },
    doctor: 20,
    doctor_info: { id: 20, full_name: "Dr. Smith" },
    center: null,
    center_name: null,
    service: 30,
    service_detail: { id: 30, name: "Consulta general" },
    date_time: "2026-08-22T14:30:00Z",
    duration_minutes: 45,
    status: "SCHEDULED",
    notes: "",
    cancel_reason: "",
    created_by: 1,
    created_by_name: "Admin",
    created_at: "2026-08-01T00:00:00Z",
    active: true,
    ...overrides,
  };
}

describe("appointmentToEvent", () => {
  it("maps start to the appointment's date_time", () => {
    const appointment = makeAppointment();
    const event = appointmentToEvent(appointment);
    expect(event.start.toISOString()).toBe(new Date("2026-08-22T14:30:00Z").toISOString());
  });

  it("computes end as start + duration_minutes", () => {
    const appointment = makeAppointment({ date_time: "2026-08-22T14:30:00Z", duration_minutes: 45 });
    const event = appointmentToEvent(appointment);
    expect(event.end.getTime() - event.start.getTime()).toBe(45 * 60000);
    expect(event.end.toISOString()).toBe(new Date("2026-08-22T15:15:00Z").toISOString());
  });

  it("handles a duration that crosses midnight", () => {
    const appointment = makeAppointment({ date_time: "2026-08-22T23:45:00Z", duration_minutes: 30 });
    const event = appointmentToEvent(appointment);
    expect(event.end.toISOString()).toBe(new Date("2026-08-23T00:15:00Z").toISOString());
  });

  it("uses the appointment time plus the patient's last name as the title", () => {
    const appointment = makeAppointment({
      date_time: "2026-08-22T14:30:00Z",
      patient_info: { id: 10, full_name: "María Pérez", gender: "FEMALE", phone: "" },
    });
    const event = appointmentToEvent(appointment);
    expect(event.title).toBe(`${format(new Date("2026-08-22T14:30:00Z"), "H:mm")} Pérez`);
  });

  it("uses the last two tokens as the surname when the patient has two last names", () => {
    const appointment = makeAppointment({
      date_time: "2026-08-22T09:10:00Z",
      patient_info: { id: 10, full_name: "Altagracia Castillo Castillo", gender: "FEMALE", phone: "" },
    });
    const event = appointmentToEvent(appointment);
    expect(event.title).toBe(`${format(new Date("2026-08-22T09:10:00Z"), "H:mm")} Castillo Castillo`);
  });

  it("carries the source appointment through as resource", () => {
    const appointment = makeAppointment();
    const event = appointmentToEvent(appointment);
    expect(event.resource).toBe(appointment);
    expect(event.id).toBe(appointment.id);
  });
});

describe("appointmentsToEvents", () => {
  it("maps a list of appointments in order", () => {
    const appointments = [makeAppointment({ id: 1 }), makeAppointment({ id: 2 })];
    const events = appointmentsToEvents(appointments);
    expect(events.map((e) => e.id)).toEqual([1, 2]);
  });

  it("returns an empty array for an empty list", () => {
    expect(appointmentsToEvents([])).toEqual([]);
  });
});
