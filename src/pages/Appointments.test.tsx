import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentDetailsDialog } from "./Appointments";
import type { Appointment } from "../services/types";

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    patient: 5,
    patient_info: { id: 5, full_name: "Jane Doe", gender: "FEMALE", phone: "8095550100" },
    doctor: 2,
    doctor_info: { id: 2, full_name: "Dr. Smith" },
    center: 1,
    center_name: "INCAF",
    service: 3,
    service_detail: { id: 3, name: "Consultation" },
    date_time: "2026-08-25T14:30:00Z",
    duration_minutes: 30,
    status: "SCHEDULED",
    notes: "Follow-up visit",
    cancel_reason: "",
    created_by: 1,
    created_by_name: "Admin User",
    created_at: "2026-08-20T10:00:00Z",
    active: true,
    ...overrides,
  };
}

describe("AppointmentDetailsDialog", () => {
  it("shows patient, doctor, service, and scheduling details", () => {
    render(<AppointmentDetailsDialog appointment={makeAppointment()} onClose={vi.fn()} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.getByText("INCAF")).toBeInTheDocument();
    expect(screen.getByText("Follow-up visit")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText(/^(Female|Femenino)$/i)).toBeInTheDocument();
    expect(screen.queryByText(/patients\.gender/)).not.toBeInTheDocument();
  });

  it("does not show a cancellation reason for a scheduled appointment", () => {
    render(<AppointmentDetailsDialog appointment={makeAppointment()} onClose={vi.fn()} />);
    expect(screen.queryByText(/Cancellation reason|Motivo de cancelaci/i)).not.toBeInTheDocument();
  });

  it("shows the cancellation reason when the appointment is cancelled", () => {
    render(
      <AppointmentDetailsDialog
        appointment={makeAppointment({ status: "CANCELLED", cancel_reason: "Patient rescheduled" })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Cancellation reason|Motivo de cancelaci/i)).toBeInTheDocument();
    expect(screen.getByText("Patient rescheduled")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<AppointmentDetailsDialog appointment={makeAppointment()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Close|Cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<AppointmentDetailsDialog appointment={makeAppointment()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
