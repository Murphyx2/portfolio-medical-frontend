import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Ars } from "./Ars";
import { api } from "../services/api";
import type { ARS } from "../services/types";

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

function ars(overrides: Partial<ARS> = {}): ARS {
  return {
    id: 1,
    ars_id: "001",
    name: "Humano",
    programs: [{ id: 1, name: "Plan Basico", active: true }],
    active: true,
    ...overrides,
  };
}

const ARS_LIST = { count: 1, next: null, previous: null, results: [ars()] };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/ars/")) return Promise.resolve(ARS_LIST) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Ars", () => {
  it("renders the ARS list from the API", async () => {
    render(<Ars />);
    expect(await screen.findByText("Humano")).toBeInTheDocument();
    expect(screen.getByText("Plan Basico")).toBeInTheDocument();
  });

  it("creates a new ARS with a program via the modal", async () => {
    mockedApi.post.mockResolvedValue(ars({ id: 2, name: "Senasa" }));
    render(<Ars />);
    await screen.findByText("Humano");

    fireEvent.click(screen.getByRole("button", { name: /Nueva ARS/i }));

    fireEvent.change(screen.getByLabelText(/ID de la ARS/i), { target: { value: "002" } });
    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "Senasa" } });
    fireEvent.click(screen.getByRole("button", { name: /Añadir programa/i }));
    fireEvent.change(screen.getByLabelText(/Nombre del programa/i), { target: { value: "Plan Oro" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/ars/");
    expect(body).toMatchObject({
      ars_id: "002",
      name: "Senasa",
      programs: [expect.objectContaining({ name: "Plan Oro" })],
    });
  });

  it("edits an existing ARS and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(ars());
    render(<Ars />);
    await screen.findByText("Humano");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("Humano")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Plan Basico")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "Humano Seguros" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/ars/1/",
        expect.objectContaining({ name: "Humano Seguros" }),
      ),
    );
  });

  it("hides the create button for a role without ars create permission", async () => {
    currentRole = "NURSE";
    render(<Ars />);
    await screen.findByText("Humano");
    expect(screen.queryByRole("button", { name: /Nueva ARS/i })).not.toBeInTheDocument();
  });
});
