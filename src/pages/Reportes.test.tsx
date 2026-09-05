import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Reportes } from "./Reportes";
import { api } from "../services/api";
import * as reportesService from "../services/reportes";

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

vi.mock("../services/reportes", () => ({
  listDefinitions: vi.fn(),
  listPacks: vi.fn(),
  createDefinition: vi.fn(),
  updateDefinition: vi.fn(),
  createPack: vi.fn(),
  updatePack: vi.fn(),
  generateReport: vi.fn(),
  generatePack: vi.fn(),
  saveBlob: vi.fn(),
}));

let currentRole = "ADMIN";
let currentCenterName: string | null = null;
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { role: currentRole, center_name: currentCenterName } }),
}));

const mockedApi = vi.mocked(api);
const mockedReportes = vi.mocked(reportesService);

const DEFINITIONS = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      name: "Servicios prestados",
      category: "Servicios",
      description: "desc",
      engine_key: "servicios_prestados" as const,
      active: true,
      last_generated_at: null,
    },
  ],
};

const PACKS = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      name: "Paquete ARS",
      periodicity: "MENSUAL",
      engine_key: "paquete_ars" as const,
      active: true,
      last_generated_at: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  currentCenterName = null;
  mockedReportes.listDefinitions.mockResolvedValue(DEFINITIONS);
  mockedReportes.listPacks.mockResolvedValue(PACKS);
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/ars/")) return Promise.resolve({ count: 0, next: null, previous: null, results: [] }) as never;
    if (path.startsWith("/centers/")) return Promise.resolve({ count: 0, next: null, previous: null, results: [] }) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Reportes", () => {
  it("renders both tabs and the Individuales list by default", async () => {
    render(<Reportes />);
    expect(screen.getByRole("tab", { name: /Individuales/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Paquetes/i })).toBeInTheDocument();
    expect(await screen.findByText("Servicios prestados")).toBeInTheDocument();
  });

  it("switches to the Paquetes tab", async () => {
    render(<Reportes />);
    await screen.findByText("Servicios prestados");
    fireEvent.click(screen.getByRole("tab", { name: /Paquetes/i }));
    expect(await screen.findByText("Paquete ARS")).toBeInTheDocument();
  });

  it("shows + Nuevo reporte / + Nuevo paquete for admin", async () => {
    render(<Reportes />);
    await screen.findByText("Servicios prestados");
    expect(screen.getByText(/Nuevo reporte/i)).toBeInTheDocument();
    expect(screen.getByText(/Nuevo paquete/i)).toBeInTheDocument();
  });

  it("hides authoring actions for a center manager", async () => {
    currentRole = "CENTER_MANAGER";
    currentCenterName = "Centro Norte";
    render(<Reportes />);
    await screen.findByText("Servicios prestados");
    expect(screen.queryByText(/Nuevo reporte/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nuevo paquete/i)).not.toBeInTheDocument();
  });

  it("locks the Centro field to the center manager's own center in the Generar modal", async () => {
    currentRole = "CENTER_MANAGER";
    currentCenterName = "Centro Norte";
    render(<Reportes />);
    await screen.findByText("Servicios prestados");
    fireEvent.click(screen.getByRole("button", { name: /^Generar$/i }));
    const centerInput = await screen.findByDisplayValue("Centro Norte");
    expect(centerInput).toBeDisabled();
  });

  it("downloads the generated report and closes the modal", async () => {
    mockedReportes.generateReport.mockResolvedValue({ blob: new Blob(["x"]), filename: "reporte.xlsx" });
    render(<Reportes />);
    await screen.findByText("Servicios prestados");
    fireEvent.click(screen.getByRole("button", { name: /^Generar$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Descargar/i }));
    await waitFor(() => expect(mockedReportes.saveBlob).toHaveBeenCalledWith(expect.any(Blob), "reporte.xlsx"));
  });
});
