import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Doctors } from "./Doctors";
import { api } from "../services/api";
import type { DoctorProfile, Service, Room } from "../services/types";

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

const mockedApi = vi.mocked(api);

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

function makeDoctor(overrides: Partial<DoctorProfile> = {}): DoctorProfile {
  return {
    id: 3,
    code: "MED-003",
    user_id: null,
    username: "",
    first_name: "Carlos",
    last_name: "Gomez",
    full_name: "Carlos Gomez",
    license_number: "LIC-123",
    contact_phone: "8095550100",
    extra_phones: [],
    contact_email: "carlos@example.com",
    bio: "",
    default_room: null,
    default_room_name: null,
    services: [],
    services_detail: [],
    rooms: [],
    rooms_detail: [],
    active: true,
    ...overrides,
  };
}

const DOCTORS_PAGE = { count: 1, next: null, previous: null, results: [makeDoctor()] };

const SERVICES: Service[] = [
  { id: 1, simon: "S1", name: "Consultation", type: 1, type_name: "General", co_pago: "0", privado: "0", created_at: "", active: true },
];

const ROOMS: Room[] = [
  { id: 1, code: "R1", name: "Room 1", room_type: 1, room_type_name: "Consultorio", center: 1, center_name: "Demo Center", floor_area: "", capacity: null, notes: "", created_at: "", updated_at: "", active: true },
];

function mockDoctorsGets() {
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/doctors/profiles/?user__isnull=false")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/doctors/profiles/")) return Promise.resolve(DOCTORS_PAGE) as never;
    if (path.startsWith("/auth/users/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/services/")) return Promise.resolve({ ...EMPTY_PAGE, count: SERVICES.length, results: SERVICES }) as never;
    if (path.startsWith("/rooms/")) return Promise.resolve({ ...EMPTY_PAGE, count: ROOMS.length, results: ROOMS }) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockDoctorsGets();
});

describe("Doctors", () => {
  it("renders the doctor list from the GET", async () => {
    render(<Doctors />);
    expect(await screen.findByText("Carlos Gomez")).toBeInTheDocument();
  });

  it("creating a doctor posts the core fields (name, license) on submit", async () => {
    mockedApi.post.mockResolvedValue(makeDoctor({ id: 10 }));
    render(<Doctors />);
    await screen.findByText("Carlos Gomez");

    fireEvent.click(screen.getByRole("button", { name: /New doctor|Nuevo médico/i }));
    fireEvent.change(screen.getByLabelText(/First name|Nombre/i), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Last name|Apellido/i), { target: { value: "Perez" } });
    fireEvent.change(screen.getByLabelText(/Exequátur/i), { target: { value: "LIC-999" } });
    fireEvent.change(screen.getByLabelText(/Contact phone|Teléfono de contacto/i), { target: { value: "8095551234" } });

    fireEvent.click(screen.getByRole("button", { name: /^Save$|^Guardar$/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/doctors/profiles/");
    expect(body).toMatchObject({ first_name: "Ana", last_name: "Perez", license_number: "LIC-999" });
  });

  it("editing an existing doctor pre-fills fields and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(makeDoctor());
    render(<Doctors />);
    await screen.findByText("Carlos Gomez");

    fireEvent.click(screen.getByRole("button", { name: /Edit Carlos Gomez|Editar Carlos Gomez/i }));
    expect(screen.getByDisplayValue("Carlos")).toBeInTheDocument();
    expect(screen.getByDisplayValue("LIC-123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Save$|^Guardar$/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith("/doctors/profiles/3/", expect.objectContaining({ first_name: "Carlos" }))
    );
  });

  it("opens the manage-services modal for a doctor row", async () => {
    render(<Doctors />);
    await screen.findByText("Carlos Gomez");

    fireEvent.click(screen.getByRole("button", { name: /Manage services|Gestionar servicios/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect((await screen.findAllByText("Carlos Gomez")).length).toBeGreaterThan(0);
    expect(screen.getByText("Consultation")).toBeInTheDocument();
  });

  it("opens the manage-rooms modal for a doctor row", async () => {
    render(<Doctors />);
    await screen.findByText("Carlos Gomez");

    fireEvent.click(screen.getByRole("button", { name: /Manage rooms|Gestionar salas/i }));

    expect(await screen.findByText("Room 1")).toBeInTheDocument();
  });

  it("hides create/edit actions for a role that cannot edit doctors", async () => {
    currentRole = "NURSE";
    render(<Doctors />);
    await screen.findByText("Carlos Gomez");
    expect(screen.queryByRole("button", { name: /New doctor|Nuevo médico/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Carlos Gomez|Editar Carlos Gomez/i })).not.toBeInTheDocument();
  });
});
