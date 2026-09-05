import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Users } from "./Users";
import { api } from "../services/api";
import type { User } from "../services/types";

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

const ROLES = [
  { value: "ADMIN", label: "Administrador" },
  { value: "DOCTOR", label: "Médico" },
  { value: "RECEPTIONIST", label: "Recepcionista" },
  { value: "IT", label: "TI" },
  { value: "NURSE", label: "Enfermero/a" },
  { value: "CENTER_MANAGER", label: "Gerente de centro" },
];

function userFixture(overrides: Partial<User> = {}): User {
  return {
    id: 2,
    username: "jperez",
    email: "jperez@example.com",
    first_name: "Juan",
    last_name: "Perez",
    full_name: "Juan Perez",
    role: "RECEPTIONIST",
    center: null,
    center_name: null,
    is_active: true,
    is_locked: false,
    locked_until: null,
    last_login: null,
    ...overrides,
  };
}

function renderUsers() {
  return render(
    <MemoryRouter>
      <Users />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/auth/users/roles/")) return Promise.resolve(ROLES) as never;
    if (path.startsWith("/auth/users/")) return Promise.resolve({ count: 1, next: null, previous: null, results: [userFixture()] }) as never;
    if (path.startsWith("/centers/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/doctors/profiles/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/services/")) return Promise.resolve(EMPTY_PAGE) as never;
    if (path.startsWith("/rooms/")) return Promise.resolve(EMPTY_PAGE) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Users", () => {
  it("renders the users list", async () => {
    renderUsers();
    expect(await screen.findByText("jperez")).toBeInTheDocument();
    expect(screen.getByText(/Nuevo usuario/i)).toBeInTheDocument();
  });

  it("creates a plain (non-doctor) user and posts the expected payload", async () => {
    mockedApi.post.mockResolvedValue(userFixture({ id: 3 }));
    renderUsers();
    await screen.findByText("jperez");

    fireEvent.click(screen.getByText(/Nuevo usuario/i));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^Usuario$/i), { target: { value: "nuevo" } });
    fireEvent.change(within(dialog).getByLabelText(/^Contraseña$/i), { target: { value: "S3cret!123" } });
    fireEvent.change(within(dialog).getByLabelText(/Confirmar contraseña/i), { target: { value: "S3cret!123" } });
    fireEvent.change(within(dialog).getByLabelText(/^Nombre$/i), { target: { value: "Nuevo" } });
    fireEvent.change(within(dialog).getByLabelText(/^Apellido$/i), { target: { value: "Usuario" } });
    fireEvent.change(within(dialog).getByLabelText(/^Correo$/i), { target: { value: "nuevo@example.com" } });
    // Role select defaults to RECEPTIONIST -- no doctor-profile fieldset required.

    fireEvent.click(within(dialog).getByRole("button", { name: /^Guardar$/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/auth/users/");
    expect(body).toMatchObject({
      username: "nuevo",
      email: "nuevo@example.com",
      first_name: "Nuevo",
      last_name: "Usuario",
      role: "RECEPTIONIST",
      center: null,
    });
    expect(body).not.toHaveProperty("doctor_profile");
  });

  it("edits an existing user and PATCHes the expected payload", async () => {
    mockedApi.patch.mockResolvedValue(userFixture());
    renderUsers();
    await screen.findByText("jperez");

    fireEvent.click(screen.getByRole("button", { name: /Editar Juan Perez/i }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByDisplayValue("jperez")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Correo$/i), { target: { value: "juan.perez@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Guardar$/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/auth/users/2/",
        expect.objectContaining({ username: "jperez", email: "juan.perez@example.com", role: "RECEPTIONIST" }),
      ),
    );
  });

  it("shows the doctor-profile fieldset when the role is set to Doctor/a", async () => {
    renderUsers();
    await screen.findByText("jperez");

    fireEvent.click(screen.getByText(/Nuevo usuario/i));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText(/^Rol$/i), { target: { value: "DOCTOR" } });

    expect(await within(dialog).findByText(/Perfil de médico/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Vincular médico existente/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Crear médico nuevo/i)).toBeInTheDocument();
  });

  it("hides create/edit user actions for a role that can't manage users (DOCTOR)", async () => {
    currentRole = "DOCTOR";
    renderUsers();
    await screen.findByText("jperez");
    expect(screen.queryByText(/Nuevo usuario/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar Juan Perez/i })).not.toBeInTheDocument();
  });
});
