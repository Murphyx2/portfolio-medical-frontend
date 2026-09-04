import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Records } from "./Records";
import { api } from "../services/api";
import type { MedicalRecord, RecordEntry } from "../services/types";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  showToast: vi.fn(),
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
  useAuth: () => ({ user: { id: 1, role: currentRole } }),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const mockedApi = vi.mocked(api);

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

function recordFixture(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  return {
    id: 1,
    patient: 5,
    patient_info: {
      id: 5,
      full_name: "Ana Perez",
      gender: "FEMALE",
      cedula: "00100000001",
      nss: "",
      birth_date: "1990-01-01",
      has_guardian: false,
      guardians: [],
    },
    created_by: 1,
    created_by_name: "admin",
    center: null,
    center_name: null,
    last_visit_at: "2026-01-05T10:00:00Z",
    last_height_cm: null,
    last_height_at: null,
    last_weight_lb: null,
    last_weight_at: null,
    last_imc: null,
    last_imc_at: null,
    last_ta_systolic: null,
    last_ta_diastolic: null,
    last_ta_at: null,
    last_fc: null,
    last_fc_at: null,
    last_fr: null,
    last_fr_at: null,
    last_glucose: null,
    last_glucose_at: null,
    habits_snapshot: {},
    images: [],
    personal_conditions: [],
    family_conditions: [],
    active: true,
    ...overrides,
  };
}

function recordEntryFixture(overrides: Partial<RecordEntry> = {}): RecordEntry {
  return {
    id: 55,
    record: 1,
    author: 1,
    author_name: "admin",
    status: "DRAFT",
    ta_systolic: null,
    ta_diastolic: null,
    fc: null,
    fr: null,
    weight_lb: null,
    height_cm: null,
    talla_cm: null,
    temperature_c: null,
    glucose: null,
    vitals_notes: "",
    imc: null,
    dx: "",
    tx: "",
    observaciones: "",
    habits: {},
    habits_notes: "",
    personal_ap_snapshot: [],
    family_ap_snapshot: [],
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/medical-records/1/")) return Promise.resolve(recordFixture()) as never;
    if (path.startsWith("/medical-records/")) return Promise.resolve({ count: 1, next: null, previous: null, results: [recordFixture()] }) as never;
    if (path.startsWith("/record-entries/")) return Promise.resolve({ count: 0, next: null, previous: null, results: [] }) as never;
    if (path.startsWith("/ap-categories/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/ap-types/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/records/upload-limits/")) return Promise.resolve({ max_image_upload_mb: 5 }) as never;
    if (path.startsWith("/patients/")) return Promise.resolve(EMPTY_PAGE) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Records", () => {
  it("renders the expedientes list with the patient and last-visit columns", async () => {
    render(<MemoryRouter><Records /></MemoryRouter>);
    expect(await screen.findByText("Ana Perez")).toBeInTheDocument();
    expect(screen.getByText(/Fecha última visita/i)).toBeInTheDocument();
    expect(screen.getByText(/Nuevo expediente/i)).toBeInTheDocument();
  });

  it("opens an existing patient's expediente and saves a vitals entry from the Clinical tab", async () => {
    mockedApi.post.mockImplementation((path: string, body?: unknown) => {
      if (path === "/record-entries/draft/") return Promise.resolve(recordEntryFixture({ status: "DRAFT" })) as never;
      if (path === "/record-entries/55/complete/") return Promise.resolve(recordEntryFixture({ status: "COMPLETED" })) as never;
      return Promise.reject(new Error(`unexpected POST ${path} ${JSON.stringify(body)}`));
    });

    render(<MemoryRouter><Records /></MemoryRouter>);
    const patientLink = await screen.findByText("Ana Perez");
    fireEvent.click(patientLink);

    const dialog = await screen.findByRole("dialog");
    // Clinical tab is active by default; vitals fields start collapsed.
    fireEvent.click(within(dialog).getByText(/Registrar signos vitales/i));

    // TA's two inputs (systolic/diastolic) share one <label>, which only
    // implicitly associates with the first one -- select all vitals number
    // inputs by role instead, in the DOM order they're rendered:
    // ta_systolic, ta_diastolic, fc, fr, temperature, weight, height, talla, glucose.
    const vitalsInputs = within(dialog).getAllByRole("spinbutton");
    fireEvent.change(vitalsInputs[0], { target: { value: "120" } });
    fireEvent.change(vitalsInputs[1], { target: { value: "80" } });
    fireEvent.change(vitalsInputs[2], { target: { value: "76" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /^Guardar$/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(2));
    const draftCall = mockedApi.post.mock.calls.find(([path]) => path === "/record-entries/draft/");
    expect(draftCall?.[1]).toMatchObject({ record: 1, ta_systolic: 120, ta_diastolic: 80, fc: 76 });
    const completeCall = mockedApi.post.mock.calls.find(([path]) => path === "/record-entries/55/complete/");
    expect(completeCall?.[1]).toMatchObject({ ta_systolic: 120, ta_diastolic: 80, fc: 76 });
  });

  it("hides the new-record action for a role that can't create records (RECEPTIONIST)", async () => {
    currentRole = "RECEPTIONIST";
    render(<MemoryRouter><Records /></MemoryRouter>);
    await screen.findByText("Ana Perez");
    expect(screen.queryByText(/Nuevo expediente/i)).not.toBeInTheDocument();
  });
});
