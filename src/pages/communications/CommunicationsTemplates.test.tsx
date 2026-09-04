import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunicationsTemplates } from "./CommunicationsTemplates";
import * as communicationsService from "../../services/communications";
import type { CommunicationsTemplate } from "../../services/types";

vi.mock("../../services/communications", () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

const mockedCommunications = vi.mocked(communicationsService);

function paginated(results: CommunicationsTemplate[]) {
  return { count: results.length, next: null, previous: null, results };
}

const TEMPLATE: CommunicationsTemplate = {
  id: 1,
  channel: "WHATSAPP",
  kind: "CITA_RECORDATORIO",
  provider_name: "recordatorio_cita",
  language: "es_DO",
  body_email: "",
  variables_json: ["nombre", "fecha"],
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCommunications.listTemplates.mockResolvedValue(paginated([TEMPLATE]));
});

describe("CommunicationsTemplates", () => {
  it("renders the list from a mocked GET", async () => {
    render(<CommunicationsTemplates />);
    expect(await screen.findByText("recordatorio_cita")).toBeInTheDocument();
  });

  it("opens the create modal, fills required fields, and creates on submit", async () => {
    mockedCommunications.createTemplate.mockResolvedValue({ ...TEMPLATE, id: 9 });
    render(<CommunicationsTemplates />);
    await screen.findByText("recordatorio_cita");

    fireEvent.click(screen.getByRole("button", { name: /Nueva plantilla/i }));

    fireEvent.change(screen.getByLabelText(/Nombre en Meta/i), { target: { value: "aviso_cita" } });
    fireEvent.change(screen.getByLabelText(/^Variables$/i), { target: { value: "nombre, hora" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedCommunications.createTemplate).toHaveBeenCalledTimes(1));
    const [body] = mockedCommunications.createTemplate.mock.calls[0];
    expect(body).toMatchObject({
      channel: "WHATSAPP",
      kind: "CITA_RECORDATORIO",
      provider_name: "aviso_cita",
      variables_json: ["nombre", "hora"],
    });
  });

  it("opens the edit modal pre-filled and updates on submit", async () => {
    mockedCommunications.updateTemplate.mockResolvedValue(TEMPLATE);
    render(<CommunicationsTemplates />);
    await screen.findByText("recordatorio_cita");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("recordatorio_cita")).toBeInTheDocument();
    expect(screen.getByDisplayValue("nombre, fecha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedCommunications.updateTemplate).toHaveBeenCalledWith(TEMPLATE.id, expect.anything()),
    );
  });
});
