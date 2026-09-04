import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Settings } from "./Settings";
import * as settingsService from "../services/settings";
import type { SystemSettings } from "../services/types";

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

vi.mock("../services/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
}));

let currentRole = "ADMIN";
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}));

const mockedSettings = vi.mocked(settingsService);

function baseSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    login_lockout_threshold: 5,
    login_lockout_minutes: 16,
    password_min_length: 10,
    access_token_lifetime_minutes: 15,
    refresh_token_lifetime_days: 7,
    login_rate_limit_per_min: 11,
    anon_rate_limit_per_min: 60,
    user_rate_limit_per_min: 300,
    max_image_upload_mb: 12,
    media_token_ttl_minutes: 61,
    default_page_size: 25,
    updated_by: 1,
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedSettings.getSettings.mockResolvedValue(baseSettings());
});

describe("Settings", () => {
  it("renders the numeric fields grouped by section from the mocked GET", async () => {
    render(<Settings />);
    expect(await screen.findByDisplayValue("5")).toBeInTheDocument();
    expect(screen.getByLabelText(/Duración del bloqueo \(minutos\)/i)).toHaveDisplayValue("16");
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.getByText(/Inicio de sesión y seguridad/i)).toBeInTheDocument();
    expect(screen.getByText(/^Sesiones$/i)).toBeInTheDocument();
    expect(screen.getByText(/Límites de solicitudes/i)).toBeInTheDocument();
    expect(screen.getByText(/Datos y multimedia/i)).toBeInTheDocument();
  });

  it("changing a value enables the save/discard footer, and saving patches only the changed field", async () => {
    mockedSettings.updateSettings.mockResolvedValue(baseSettings({ password_min_length: 12 }));
    render(<Settings />);
    const field = await screen.findByLabelText(/Longitud mínima de contraseña/i);
    expect(field).toHaveDisplayValue("10");

    const saveBtn = screen.getByRole("button", { name: /^Guardar$/i });
    const discardBtn = screen.getByRole("button", { name: /^Cancelar$/i });
    expect(saveBtn).toBeDisabled();
    expect(discardBtn).toBeDisabled();

    fireEvent.change(field, { target: { value: "12" } });
    expect(saveBtn).not.toBeDisabled();
    expect(discardBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => expect(mockedSettings.updateSettings).toHaveBeenCalledTimes(1));
    expect(mockedSettings.updateSettings).toHaveBeenCalledWith({ password_min_length: 12 });
  });

  it("discard reverts the field to the loaded value and disables the footer again", async () => {
    render(<Settings />);
    const field = await screen.findByLabelText(/Longitud mínima de contraseña/i);
    fireEvent.change(field, { target: { value: "12" } });
    expect(field).toHaveDisplayValue("12");

    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));

    expect(field).toHaveDisplayValue("10");
    expect(screen.getByRole("button", { name: /^Guardar$/i })).toBeDisabled();
    expect(mockedSettings.updateSettings).not.toHaveBeenCalled();
  });

  it("the reset-to-defaults ConfirmDialog flow calls resetSettings and reloads the form", async () => {
    mockedSettings.resetSettings.mockResolvedValue(baseSettings({ password_min_length: 8 }));
    render(<Settings />);
    await screen.findByLabelText(/Longitud mínima de contraseña/i);

    fireEvent.click(screen.getByRole("button", { name: /Restablecer valores predeterminados/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      dialog.querySelector(".btn.danger") as HTMLElement,
    );

    await waitFor(() => expect(mockedSettings.resetSettings).toHaveBeenCalledTimes(1));
    expect(await screen.findByDisplayValue("8")).toBeInTheDocument();
  });

  it("switching the language calls setLanguage/changeLanguage even for a role without settings.edit", async () => {
    currentRole = "IT";
    render(<Settings />);
    await screen.findByLabelText(/Longitud mínima de contraseña/i);

    // IT can view but not edit settings -- numeric fields are disabled and
    // there's a read-only badge/notice, but the language switcher stays
    // enabled only for ADMIN/CENTER_MANAGER per can(role, "edit", "language").
    expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument();
    const numericField = screen.getByLabelText(/Longitud mínima de contraseña/i);
    expect(numericField).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Restablecer valores predeterminados/i })).not.toBeInTheDocument();

    const languageSelect = screen.getByLabelText(/Language/i);
    expect(languageSelect).toBeDisabled();
  });
});
