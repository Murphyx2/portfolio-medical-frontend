import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Centers } from "./Centers";
import { api, upload } from "../services/api";
import type { MedicalCenter } from "../services/types";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  upload: vi.fn(),
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
const mockedUpload = vi.mocked(upload);

function center(overrides: Partial<MedicalCenter> = {}): MedicalCenter {
  return {
    id: 1,
    name: "INCAF",
    code: "INC01",
    address: "Av. Principal 1",
    phone: "8095550100",
    email: "info@incaf.com",
    rnc: "",
    nombre_legal: "",
    nombre_corto: "",
    logo: null,
    phones: [],
    emails: [],
    is_default: true,
    doctor_count: 3,
    active: true,
    ...overrides,
  };
}

const CENTERS_LIST = { count: 1, next: null, previous: null, results: [center()] };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/centers/")) return Promise.resolve(CENTERS_LIST) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Centers", () => {
  it("renders the center list from the API", async () => {
    render(<Centers />);
    expect(await screen.findByText("INCAF")).toBeInTheDocument();
    expect(screen.getByText("Av. Principal 1")).toBeInTheDocument();
  });

  it("creates a new center via the modal", async () => {
    mockedApi.post.mockResolvedValue(center({ id: 2, name: "Centro Norte", code: "NORTE" }));
    render(<Centers />);
    await screen.findByText("INCAF");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo centro/i }));

    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "Centro Norte" } });
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "NORTE" } });
    fireEvent.change(screen.getByLabelText(/^Dirección$/i), { target: { value: "Calle 2" } });
    fireEvent.change(screen.getByLabelText(/Teléfono principal/i), { target: { value: "8095550199" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/centers/");
    expect(body).toMatchObject({ name: "Centro Norte", code: "NORTE", phone: "8095550199" });
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("edits an existing center and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(center());
    render(<Centers />);
    await screen.findByText("INCAF");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("INCAF")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Av. Principal 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Dirección$/i), { target: { value: "Nueva Direccion 5" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/centers/1/",
        expect.objectContaining({ address: "Nueva Direccion 5" }),
      ),
    );
  });

  it("hides the create button for a role without centers edit permission", async () => {
    currentRole = "NURSE";
    render(<Centers />);
    await screen.findByText("INCAF");
    expect(screen.queryByRole("button", { name: /Nuevo centro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument();
  });
});
