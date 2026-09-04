import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Services } from "./Services";
import { api } from "../services/api";
import type { Paginated, Service, ServiceType } from "../services/types";

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

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

let currentRole = "ADMIN";
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}));

const mockedApi = vi.mocked(api);

function paginated<T>(results: T[]): Paginated<T> {
  return { count: results.length, next: null, previous: null, results };
}

const SERVICE_TYPE: ServiceType = { id: 2, name: "Tipo A", requires_doctor: false, active: true };

const SERVICE: Service = {
  id: 1,
  simon: "123456",
  name: "CONSULTA GENERAL",
  type: 2,
  type_name: "Tipo A",
  co_pago: "500.00",
  privado: "1000.00",
  created_at: "",
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/services/")) return Promise.resolve(paginated([SERVICE])) as never;
    if (path.startsWith("/service-types/")) return Promise.resolve(paginated([SERVICE_TYPE])) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Services", () => {
  it("renders the list from a mocked GET", async () => {
    render(<Services />);
    expect(await screen.findByText("CONSULTA GENERAL")).toBeInTheDocument();
  });

  it("opens the create modal, fills required fields, and POSTs on submit", async () => {
    mockedApi.post.mockResolvedValue({ ...SERVICE, id: 9 });
    render(<Services />);
    await screen.findByText("CONSULTA GENERAL");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo servicio/i }));

    fireEvent.change(screen.getByLabelText(/^SIMON$/i), { target: { value: "654321" } });
    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "consulta test" } });
    fireEvent.change(screen.getByLabelText(/^Tipo$/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Co-pago/i), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText(/Privado/i), { target: { value: "300" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/services/");
    expect(body).toMatchObject({
      simon: "654321",
      name: "CONSULTA TEST",
      type: 2,
      co_pago: "200",
      privado: "300",
    });
  });

  it("opens the edit modal pre-filled and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(SERVICE);
    render(<Services />);
    await screen.findByText("CONSULTA GENERAL");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("123456")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CONSULTA GENERAL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/services/${SERVICE.id}/`, expect.anything()),
    );
  });

  it("hides the create/manage actions for a role without services edit permission", async () => {
    currentRole = "DOCTOR";
    render(<Services />);
    await screen.findByText("CONSULTA GENERAL");
    expect(screen.queryByRole("button", { name: /Nuevo servicio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gestionar tipos de servicio/i })).not.toBeInTheDocument();
  });
});
