import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComposeMessage } from "./ComposeMessage";
import { api } from "../../services/api";
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
  createMessage: vi.fn(),
  sendTestEmail: vi.fn(),
}));

let currentRole = "ADMIN";
vi.mock("../../store/auth", () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockedApi = vi.mocked(api);
const mockedComms = vi.mocked(communicationsService);

const ROSTER = {
  count: 2,
  next: null,
  previous: null,
  results: [
    { id: 1, username: "ana", email: "ana@example.com", first_name: "Ana", last_name: "Perez", full_name: "Ana Perez", role: "DOCTOR", center: null, center_name: null, is_active: true, is_locked: false, locked_until: null, last_login: null },
    { id: 2, username: "beto", email: "beto@example.com", first_name: "Beto", last_name: "Diaz", full_name: "Beto Diaz", role: "NURSE", center: null, center_name: null, is_active: true, is_locked: false, locked_until: null, last_login: null },
  ],
};

const CREATED_MESSAGE = {
  id: 42,
  channel: "EMAIL" as const,
  audience: "STAFF" as const,
  kind: "AVISO" as const,
  priority: "NORMAL" as const,
  subject: "Aviso importante",
  body: "Cuerpo",
  template: null,
  created_by: 1,
  created_by_name: "Admin",
  scheduled_for: null,
  status: "DRAFT" as const,
  recipient_count: 0,
  appointment: null,
  created_at: "2026-09-01T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/users/")) return Promise.resolve(ROSTER) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("ComposeMessage", () => {
  it("renders the form with type, subject, body and recipient fields", async () => {
    render(<ComposeMessage />);
    expect(screen.getByText(/^Tipo$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Asunto$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cuerpo$/i)).toBeInTheDocument();
    expect(screen.getByText(/Todo el personal activo/i)).toBeInTheDocument();
    // Roster loaded -> the "byPerson" radio option becomes available.
    await screen.findByText(/Personas específicas/i);
  });

  it("selecting 'Por rol' reveals the role checkbox sub-list", async () => {
    render(<ComposeMessage />);
    fireEvent.click(screen.getByText(/Por rol/i));
    expect(screen.getByRole("checkbox", { name: "DOCTOR" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "NURSE" })).toBeInTheDocument();
  });

  it("selecting 'Personas específicas' reveals the per-person checkbox sub-list", async () => {
    render(<ComposeMessage />);
    await screen.findByText(/Personas específicas/i);
    fireEvent.click(screen.getByText(/Personas específicas/i));
    expect(screen.getByRole("checkbox", { name: /Ana Perez \(DOCTOR\)/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Beto Diaz \(NURSE\)/i })).toBeInTheDocument();
  });

  it("submitting with no subject shows a validation error instead of calling the API", async () => {
    render(<ComposeMessage />);
    fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(mockedComms.createMessage).not.toHaveBeenCalled();
  });

  it("filling subject+body with 'Todo el personal activo' and confirming Send creates a QUEUED message", async () => {
    mockedComms.createMessage.mockResolvedValue(CREATED_MESSAGE);
    render(<ComposeMessage />);

    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: "Aviso importante" } });
    fireEvent.change(screen.getByLabelText(/Cuerpo/i), { target: { value: "Cuerpo" } });

    fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));

    // Recipients + subject are present, so Send raises a confirm dialog first.
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Enviar$/i }));

    await waitFor(() => expect(mockedComms.createMessage).toHaveBeenCalledTimes(1));
    const [body] = mockedComms.createMessage.mock.calls[0];
    expect(body).toMatchObject({
      channel: "EMAIL",
      audience: "STAFF",
      subject: "Aviso importante",
      body: "Cuerpo",
      status: "QUEUED",
      recipients: { all_staff: true, roles: [], user_ids: [] },
    });
    expect(mockNavigate).toHaveBeenCalledWith("/comunicaciones");
  });

  it("saving a draft calls createMessage with status DRAFT without confirmation", async () => {
    mockedComms.createMessage.mockResolvedValue(CREATED_MESSAGE);
    render(<ComposeMessage />);

    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: "Borrador" } });
    fireEvent.change(screen.getByLabelText(/Cuerpo/i), { target: { value: "Cuerpo" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar borrador/i }));

    await waitFor(() => expect(mockedComms.createMessage).toHaveBeenCalledTimes(1));
    const [body] = mockedComms.createMessage.mock.calls[0];
    expect(body).toMatchObject({ status: "DRAFT" });
  });
});
