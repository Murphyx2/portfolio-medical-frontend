import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServicePrices } from "./ServicePrices";
import { api } from "../services/api";
import type { ARS, Paginated, Service, ServicePrice } from "../services/types";

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

const SERVICE: Service = {
  id: 3,
  simon: "111111",
  name: "CONSULTA",
  type: 1,
  type_name: "Tipo A",
  co_pago: "0",
  privado: "0",
  created_at: "",
  active: true,
};

const ARS_ROW: ARS = {
  id: 5,
  ars_id: "01",
  name: "ARS Humano",
  programs: [{ id: 9, name: "Programa A", active: true }],
  active: true,
};

const SERVICE_PRICE: ServicePrice = {
  id: 1,
  service: 3,
  service_name: "CONSULTA",
  ars: 5,
  ars_name: "ARS Humano",
  ars_program: null,
  ars_program_name: null,
  co_pago: "150.00",
  created_at: "",
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/service-prices/")) return Promise.resolve(paginated([SERVICE_PRICE])) as never;
    if (path.startsWith("/services/")) return Promise.resolve(paginated([SERVICE])) as never;
    if (path.startsWith("/ars/")) return Promise.resolve(paginated([ARS_ROW])) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("ServicePrices", () => {
  it("renders the list from a mocked GET", async () => {
    render(<ServicePrices />);
    expect(await screen.findByText("CONSULTA")).toBeInTheDocument();
    expect(screen.getByText("ARS Humano")).toBeInTheDocument();
  });

  it("opens the create modal, fills required fields, and POSTs on submit", async () => {
    mockedApi.post.mockResolvedValue({ ...SERVICE_PRICE, id: 9 });
    render(<ServicePrices />);
    await screen.findByText("CONSULTA");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo precio/i }));

    fireEvent.change(screen.getByLabelText(/^Servicio$/i), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/^ARS$/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/^Co-pago/i), { target: { value: "200" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/service-prices/");
    expect(body).toMatchObject({ service: 3, ars: 5, ars_program: null, co_pago: "200" });
  });

  it("opens the edit modal pre-filled and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(SERVICE_PRICE);
    render(<ServicePrices />);
    await screen.findByText("CONSULTA");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("150.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/service-prices/${SERVICE_PRICE.id}/`, expect.anything()),
    );
  });

  it("hides the create action for a role without servicePrices edit permission", async () => {
    currentRole = "DOCTOR";
    render(<ServicePrices />);
    await screen.findByText("CONSULTA");
    expect(screen.queryByRole("button", { name: /Nuevo precio/i })).not.toBeInTheDocument();
  });
});
