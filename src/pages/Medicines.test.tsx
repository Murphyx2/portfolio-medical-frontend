import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Medicines } from "./Medicines";
import { api } from "../services/api";
import type { Medicine } from "../services/types";

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

function medicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: 1,
    generic_name: "Acetaminofen",
    commercial_name: "Tapsin",
    concentration: "500mg",
    forma: "TABLETA",
    via_pred: "ORAL",
    concentracion_valor: "500",
    concentracion_unidad: "mg",
    concentracion_unidad_otro: "",
    active: true,
    ...overrides,
  };
}

const MEDICINES_LIST = { count: 1, next: null, previous: null, results: [medicine()] };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/medicines/")) return Promise.resolve(MEDICINES_LIST) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Medicines", () => {
  it("renders the medicine list from the API", async () => {
    render(<Medicines />);
    expect(await screen.findByText("Tapsin")).toBeInTheDocument();
    expect(screen.getByText("Acetaminofen")).toBeInTheDocument();
  });

  it("creates a new medicine via the modal", async () => {
    mockedApi.post.mockResolvedValue(medicine({ id: 2, generic_name: "Ibuprofeno", commercial_name: "Motrin" }));
    render(<Medicines />);
    await screen.findByText("Tapsin");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo medicamento/i }));

    fireEvent.change(screen.getByLabelText(/Término genérico/i), { target: { value: "Ibuprofeno" } });
    fireEvent.change(screen.getByLabelText(/Nombre comercial/i), { target: { value: "Motrin" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/medicines/");
    expect(body).toMatchObject({ generic_name: "Ibuprofeno", commercial_name: "Motrin" });
  });

  it("edits an existing medicine and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(medicine());
    render(<Medicines />);
    await screen.findByText("Tapsin");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("Acetaminofen")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tapsin")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nombre comercial/i), { target: { value: "Tapsin Forte" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/medicines/1/",
        expect.objectContaining({ commercial_name: "Tapsin Forte" }),
      ),
    );
  });

  it("hides the delete action for a role without medicines delete permission", async () => {
    // medicines.edit is granted to every role, so create/edit are always
    // visible -- delete is the narrower gate (ROOM_LIKE_WRITE only) that
    // excludes DOCTOR/NURSE, per apps.core.permissions' CanManageMedicines.
    currentRole = "NURSE";
    render(<Medicines />);
    await screen.findByText("Tapsin");
    // Delete lives behind the row's overflow ("more") menu -- when onDelete
    // is undefined the menu trigger itself doesn't render at all.
    expect(screen.queryByRole("button", { name: /Más/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar/i })).toBeInTheDocument();
  });

});
