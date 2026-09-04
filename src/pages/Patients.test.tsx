import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Patients } from "./Patients";
import { api } from "../services/api";
import type { Patient } from "../services/types";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

let currentRole = "ADMIN";
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}));

// Patients.tsx composes PatientFormModal for create/edit -- that component
// already has its own dedicated test file (PatientFormModal.test.tsx), so
// here it's replaced with a minimal stand-in that just exercises the
// wiring: does the page open it on "+ New", pass the right `patient`, and
// close/reload on save.
vi.mock("../components/PatientFormModal", () => ({
  PatientFormModal: ({
    patient,
    onClose,
    onSaved,
  }: {
    patient?: Patient | null;
    onClose: () => void;
    onSaved: (p: Patient) => void;
  }) => (
    <div data-testid="patient-form-modal">
      <span>{patient ? `editing-${patient.id}` : "new-patient"}</span>
      <button onClick={() => onSaved(patient ?? existingPatient({ id: 99 }))}>mock-save</button>
      <button onClick={onClose}>mock-close</button>
    </div>
  ),
}));

const mockedApi = vi.mocked(api);

function existingPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 5,
    first_name: "Jane",
    last_name: "Doe",
    full_name: "Jane Doe",
    birth_date: "1990-01-01",
    age: 36,
    gender: "FEMALE",
    phone: "8095550100",
    extra_phones: [],
    address: "123 Main St",
    email: "jane@example.com",
    cedula: "00100000001",
    nss: "",
    ars: null,
    ars_name: null,
    ars_program: null,
    ars_program_name: null,
    center: 1,
    center_name: "INCAF",
    center_code: "INCAF",
    has_guardian: false,
    guardians: [],
    allergies: "Penicillin",
    critical_conditions: "",
    whatsapp_opt_in: false,
    whatsapp_opt_in_at: null,
    whatsapp_opt_in_by: null,
    created_at: "",
    updated_at: "",
    active: true,
    ...overrides,
  };
}

const PATIENTS_PAGE = {
  count: 1,
  next: null,
  previous: null,
  results: [existingPatient()],
};

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/patients/5/")) return Promise.resolve(existingPatient()) as never;
    if (path.startsWith("/patients/")) return Promise.resolve(PATIENTS_PAGE) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Patients", () => {
  it("renders the patient list from the GET", async () => {
    render(<Patients />);
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
  });

  it("opens the create modal on '+ New' and reloads the list after save", async () => {
    render(<Patients />);
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: /New patient|Nuevo paciente/i }));
    expect(screen.getByTestId("patient-form-modal")).toBeInTheDocument();
    expect(screen.getByText("new-patient")).toBeInTheDocument();

    const getCallsBefore = mockedApi.get.mock.calls.length;
    fireEvent.click(screen.getByText("mock-save"));

    await waitFor(() => expect(screen.queryByTestId("patient-form-modal")).not.toBeInTheDocument());
    await waitFor(() => expect(mockedApi.get.mock.calls.length).toBeGreaterThan(getCallsBefore));
  });

  it("opens the edit modal with the selected patient", async () => {
    render(<Patients />);
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByRole("button", { name: /Edit Jane Doe|Editar Jane Doe/i }));
    expect(screen.getByText("editing-5")).toBeInTheDocument();

    fireEvent.click(screen.getByText("mock-close"));
    expect(screen.queryByTestId("patient-form-modal")).not.toBeInTheDocument();
  });

  it("opens the read-only detail dialog when clicking a patient's name", async () => {
    render(<Patients />);
    await screen.findByText("Jane Doe");

    fireEvent.click(screen.getByText("Jane Doe"));

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith("/patients/5/"));
    expect(await screen.findByText("123 Main St")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("hides '+ New' for a role that cannot create patients", async () => {
    currentRole = "IT";
    render(<Patients />);
    await screen.findByText("Jane Doe");
    expect(screen.queryByRole("button", { name: /New patient|Nuevo paciente/i })).not.toBeInTheDocument();
  });
});
