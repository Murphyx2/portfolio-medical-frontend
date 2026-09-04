import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Encounters } from "./Encounters";
import { api } from "../services/api";
import type { Encounter, Patient, Service, ServiceType } from "../services/types";

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

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const mockedApi = vi.mocked(api);

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

const SERVICE_TYPES: ServiceType[] = [{ id: 1, name: "Consulta", requires_doctor: false, active: true }];
const SERVICES: Service[] = [
  { id: 10, simon: "", name: "Consulta general", type: 1, type_name: "Consulta", co_pago: "0", privado: "0", created_at: "", active: true },
];

function patientFixture(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 5,
    first_name: "Ana",
    last_name: "Perez",
    full_name: "Ana Perez",
    birth_date: "1990-01-01",
    age: 34,
    gender: "FEMALE",
    phone: "8095550100",
    extra_phones: [],
    address: "",
    email: "",
    cedula: "00100000001",
    nss: "",
    ars: null,
    ars_name: null,
    ars_program: null,
    ars_program_name: null,
    center: null,
    center_name: null,
    center_code: null,
    has_guardian: false,
    guardians: [],
    allergies: "",
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

function encounterFixture(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: 1,
    encounter_number: "ENC-0001",
    service_type: 1,
    service_type_name: "Consulta",
    patient: 5,
    patient_info: {
      id: 5,
      full_name: "Ana Perez",
      age: 34,
      gender: "FEMALE",
      cedula: "00100000001",
      allergies: "",
      critical_conditions: "",
      ars: null,
      ars_name: null,
      ars_program: null,
      has_guardian: false,
      guardian_cedula: "",
    },
    referring_doctor_name: "",
    center: null,
    center_name: null,
    status: "DRAFT",
    priority: "ROUTINE",
    admitted_at: null,
    completed_at: null,
    chief_complaint: "",
    cancel_reason: "",
    ars: null,
    ars_name: null,
    ars_program: null,
    ars_program_name: null,
    diagnoses: [],
    services: [],
    created_by: 1,
    created_by_name: "admin",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/encounters/")) return Promise.resolve({ count: 1, next: null, previous: null, results: [encounterFixture()] }) as never;
    if (path.startsWith("/doctors/profiles/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/rooms/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/service-types/")) return Promise.resolve({ count: 1, next: null, previous: null, results: SERVICE_TYPES }) as never;
    if (path.startsWith("/ars/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/services/")) return Promise.resolve({ count: 1, next: null, previous: null, results: SERVICES }) as never;
    if (path.startsWith("/patients/")) {
      return Promise.resolve({ count: 1, next: null, previous: null, results: [patientFixture()] }) as never;
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Encounters", () => {
  it("renders the admissions list for the selected date", async () => {
    render(<Encounters />);
    expect(await screen.findByText("Ana Perez")).toBeInTheDocument();
    expect(screen.getByText("ENC-0001")).toBeInTheDocument();
    expect(screen.getByText(/Nueva admisión/i)).toBeInTheDocument();
  });

  it("hides the new-admission button for a role that can't manage encounters", async () => {
    currentRole = "IT";
    render(<Encounters />);
    await screen.findByText("Ana Perez");
    expect(screen.queryByText(/Nueva admisión/i)).not.toBeInTheDocument();
  });

  it("creates a new admission: pick patient, add one service line, submit posts the expected payload", async () => {
    mockedApi.post.mockResolvedValue(encounterFixture({ id: 99 }));
    render(<Encounters />);
    await screen.findByText("Ana Perez");

    fireEvent.click(screen.getByText(/Nueva admisión/i));
    const dialog = screen.getByRole("dialog");

    // Pick the patient via the SearchableSelect.
    const patientInput = within(dialog).getByPlaceholderText(/Buscar paciente/i);
    fireEvent.focus(patientInput);
    fireEvent.change(patientInput, { target: { value: "Ana" } });
    const patientOption = await within(dialog).findByRole("button", { name: /Ana Perez/i });
    fireEvent.click(patientOption);

    // Add one service line and pick a service.
    fireEvent.click(within(dialog).getByText(/Añadir servicio/i));
    const serviceInput = within(dialog).getByPlaceholderText(/^Servicio$/i);
    fireEvent.focus(serviceInput);
    fireEvent.change(serviceInput, { target: { value: "Consulta" } });
    const serviceOption = await within(dialog).findByRole("button", { name: /Consulta general/i });
    fireEvent.click(serviceOption);

    fireEvent.click(within(dialog).getByRole("button", { name: /^Guardar$/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/encounters/");
    expect(body).toMatchObject({
      patient: 5,
      service_type: 1,
      services: [expect.objectContaining({ service: 10 })],
    });
  });

  it("admits a DRAFT encounter through the confirm dialog", async () => {
    mockedApi.post.mockResolvedValue({});
    render(<Encounters />);
    await screen.findByText("Ana Perez");

    fireEvent.click(screen.getByRole("button", { name: /^Admitir$/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Admitir$/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith("/encounters/1/admit/", {}));
  });
});
