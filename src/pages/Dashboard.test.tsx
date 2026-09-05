import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { Dashboard } from "./Dashboard";
import { api } from "../services/api";
import type { Appointment } from "../services/types";

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

vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { role: "ADMIN", username: "admin", full_name: "Admin User" } }),
}));

const mockedApi = vi.mocked(api);

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    patient: 5,
    patient_info: { id: 5, full_name: "Jane Doe", gender: "FEMALE", phone: "8095550100" },
    doctor: 2,
    doctor_info: { id: 2, full_name: "Dr. Smith" },
    center: 1,
    center_name: "Demo Center",
    service: 3,
    service_detail: { id: 3, name: "Consultation" },
    date_time: "2026-09-04T14:30:00Z",
    duration_minutes: 30,
    status: "SCHEDULED",
    notes: "",
    cancel_reason: "",
    created_by: 1,
    created_by_name: "Admin User",
    created_at: "2026-09-04T10:00:00Z",
    active: true,
    ...overrides,
  } as Appointment;
}

function mockDashboardGets({
  patients = 0,
  doctors = 0,
  appointmentsTotal = 0,
  todayResults = [] as Appointment[],
  failTotals = false,
}: {
  patients?: number;
  doctors?: number;
  appointmentsTotal?: number;
  todayResults?: Appointment[];
  failTotals?: boolean;
} = {}) {
  mockedApi.get.mockImplementation((path: string) => {
    if (path.includes("date_time__gte")) {
      return Promise.resolve({ count: todayResults.length, next: null, previous: null, results: todayResults }) as never;
    }
    if (failTotals) return Promise.reject(new Error("boom"));
    if (path.startsWith("/patients/")) return Promise.resolve({ ...EMPTY_PAGE, count: patients }) as never;
    if (path.startsWith("/doctors/profiles/")) return Promise.resolve({ ...EMPTY_PAGE, count: doctors }) as never;
    if (path.startsWith("/appointments/")) return Promise.resolve({ ...EMPTY_PAGE, count: appointmentsTotal }) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe("Dashboard", () => {
  it("renders the four stat cards from the mocked GETs", async () => {
    mockDashboardGets({ patients: 42, doctors: 7, appointmentsTotal: 15, todayResults: [] });
    renderDashboard();

    expect(await screen.findByRole("button", { name: /Total appointments: 15|Total de citas: 15/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Appointments today: 0|Citas de hoy: 0/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Total patients: 42|Total de pacientes: 42/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Total doctors: 7|Total de médicos: 7/i })).toBeInTheDocument();
  });

  it("shows the empty state when there are no appointments today", async () => {
    mockDashboardGets({ todayResults: [] });
    renderDashboard();
    expect(await screen.findByText(/No appointments scheduled for today|No hay citas programadas para hoy/i)).toBeInTheDocument();
  });

  it("renders the populated today's-appointments list", async () => {
    mockDashboardGets({ todayResults: [makeAppointment()] });
    renderDashboard();

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.queryByText(/No appointments scheduled for today|No hay citas programadas para hoy/i)).not.toBeInTheDocument();
  });

  it("shows a load-error message with a retry affordance when a request fails, and retry re-fetches", async () => {
    mockDashboardGets({ failTotals: true, todayResults: [] });
    renderDashboard();

    const retryButton = await screen.findByRole("button", { name: /Retry|Reintentar/i });
    expect(screen.getByText(/Some dashboard data couldn't be loaded|No se pudieron cargar algunos datos del panel/i)).toBeInTheDocument();

    mockDashboardGets({ patients: 1, doctors: 1, appointmentsTotal: 1, todayResults: [] });
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.queryByRole("button", { name: /Retry|Reintentar/i })).not.toBeInTheDocument());
  });
});
