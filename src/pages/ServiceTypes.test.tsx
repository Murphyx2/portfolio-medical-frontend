import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceTypes } from "./ServiceTypes";
import { api } from "../services/api";
import type { Paginated, ServiceType } from "../services/types";

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

const SERVICE_TYPE: ServiceType = { id: 1, name: "CONSULTA", requires_doctor: true, active: true };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/service-types/")) return Promise.resolve(paginated([SERVICE_TYPE])) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("ServiceTypes", () => {
  it("renders the list from a mocked GET", async () => {
    render(<ServiceTypes />);
    expect(await screen.findByText("CONSULTA")).toBeInTheDocument();
  });

  it("opens the create modal, fills required fields, and POSTs on submit", async () => {
    mockedApi.post.mockResolvedValue({ ...SERVICE_TYPE, id: 9 });
    render(<ServiceTypes />);
    await screen.findByText("CONSULTA");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo tipo/i }));

    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "cirugia" } });
    fireEvent.click(screen.getByLabelText(/Requiere médico/i));

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/service-types/");
    expect(body).toMatchObject({ name: "CIRUGIA", requires_doctor: true });
  });

  it("opens the edit modal pre-filled and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(SERVICE_TYPE);
    render(<ServiceTypes />);
    await screen.findByText("CONSULTA");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("CONSULTA")).toBeInTheDocument();
    expect(screen.getByLabelText(/Requiere médico/i)).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/service-types/${SERVICE_TYPE.id}/`, expect.anything()),
    );
  });

  it("hides the create action for a role without serviceTypes edit permission", async () => {
    currentRole = "DOCTOR";
    render(<ServiceTypes />);
    await screen.findByText("CONSULTA");
    expect(screen.queryByRole("button", { name: /Nuevo tipo/i })).not.toBeInTheDocument();
  });
});
