import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommunicationsSettingsPage } from "./CommunicationsSettingsPage";
import * as communicationsService from "../../services/communications";

vi.mock("../../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("../../services/communications", () => ({
  getCommunicationsSettings: vi.fn(),
  updateCommunicationsSettings: vi.fn(),
  sendTestEmailGlobal: vi.fn(),
  sendTestWhatsapp: vi.fn(),
}));

const mockedComms = vi.mocked(communicationsService);

function settings(overrides: Partial<import("../../services/types").CommunicationsSettings> = {}) {
  return {
    from_name: "INCAF",
    reply_to: "no-reply@incaf.com",
    whatsapp_phone_number_id: "12345",
    whatsapp_business_account_id: "67890",
    whatsapp_access_token_last4: "abcd",
    whatsapp_app_secret_last4: "wxyz",
    whatsapp_default_country_code: "+1",
    whatsapp_reminder_hours: 24,
    whatsapp_master_enabled: false,
    whatsapp_configured: true,
    webhook_url: "https://example.com/webhook",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedComms.getCommunicationsSettings.mockResolvedValue(settings());
});

describe("CommunicationsSettingsPage", () => {
  it("renders the settings form from the mocked GET", async () => {
    render(<CommunicationsSettingsPage />);
    expect(await screen.findByDisplayValue("INCAF")).toBeInTheDocument();
    expect(screen.getByDisplayValue("no-reply@incaf.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345")).toBeInTheDocument();
    expect(screen.getByText("•••• abcd")).toBeInTheDocument();
  });

  it("editing a field and saving calls updateCommunicationsSettings with the right payload", async () => {
    mockedComms.updateCommunicationsSettings.mockResolvedValue(settings({ from_name: "INCAF Norte" }));
    render(<CommunicationsSettingsPage />);
    await screen.findByDisplayValue("INCAF");

    fireEvent.change(screen.getByDisplayValue("INCAF"), { target: { value: "INCAF Norte" } });
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/i }));

    await waitFor(() => expect(mockedComms.updateCommunicationsSettings).toHaveBeenCalledTimes(1));
    const [patch] = mockedComms.updateCommunicationsSettings.mock.calls[0];
    expect(patch).toMatchObject({
      from_name: "INCAF Norte",
      reply_to: "no-reply@incaf.com",
      whatsapp_phone_number_id: "12345",
      whatsapp_reminder_hours: 24,
      whatsapp_master_enabled: false,
    });
    expect(patch).not.toHaveProperty("whatsapp_access_token");
    expect(patch).not.toHaveProperty("whatsapp_app_secret");
  });

  it("the reveal-to-edit token pattern shows an input on 'Cambiar token' and includes it in the save payload", async () => {
    mockedComms.updateCommunicationsSettings.mockResolvedValue(settings());
    render(<CommunicationsSettingsPage />);
    await screen.findByDisplayValue("INCAF");

    expect(screen.getByText("•••• abcd")).toBeInTheDocument();

    // The "Cambiar token" button sits inside the Field's <label>, so its
    // accessible name absorbs the label text ("Token de acceso ...") --
    // match on that rather than the visible button text alone.
    fireEvent.click(screen.getByRole("button", { name: /Token de acceso/i }));

    const newTokenInput = screen.getByLabelText(/Token de acceso/i);
    fireEvent.change(newTokenInput, { target: { value: "new-secret-token" } });

    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/i }));

    await waitFor(() => expect(mockedComms.updateCommunicationsSettings).toHaveBeenCalledTimes(1));
    const [patch] = mockedComms.updateCommunicationsSettings.mock.calls[0];
    expect(patch).toMatchObject({ whatsapp_access_token: "new-secret-token" });
  });

  it("clicking the email test-send button calls sendTestEmailGlobal", async () => {
    mockedComms.sendTestEmailGlobal.mockResolvedValue({ detail: "ok" });
    render(<CommunicationsSettingsPage />);
    await screen.findByDisplayValue("INCAF");

    fireEvent.click(screen.getByRole("button", { name: /Enviar correo de prueba/i }));

    await waitFor(() => expect(mockedComms.sendTestEmailGlobal).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Correo de prueba enviado\./i)).toBeInTheDocument();
  });

  it("clicking the WhatsApp test-send button calls sendTestWhatsapp with the typed phone", async () => {
    mockedComms.sendTestWhatsapp.mockResolvedValue({ detail: "ok" });
    render(<CommunicationsSettingsPage />);
    await screen.findByDisplayValue("INCAF");

    fireEvent.change(screen.getByPlaceholderText("8091234567"), { target: { value: "8095551234" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar WhatsApp de prueba/i }));

    await waitFor(() => expect(mockedComms.sendTestWhatsapp).toHaveBeenCalledWith("8095551234"));
  });
});
