import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Communications } from "./Communications";
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
  listMessages: vi.fn(),
  listDeliveries: vi.fn(),
  getMessage: vi.fn(),
}));

let currentRole = "ADMIN";
vi.mock("../../store/auth", () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockedComms = vi.mocked(communicationsService);

const MESSAGE = {
  id: 1,
  channel: "EMAIL" as const,
  audience: "STAFF" as const,
  kind: "AVISO" as const,
  priority: "NORMAL" as const,
  subject: "Reunión de personal",
  body: "Cuerpo del mensaje de prueba",
  template: null,
  created_by: 1,
  created_by_name: "Admin User",
  scheduled_for: null,
  status: "SENT" as const,
  recipient_count: 5,
  appointment: null,
  created_at: "2026-09-01T10:00:00Z",
};

const MESSAGES = { count: 1, next: null, previous: null, results: [MESSAGE] };
const EMPTY_DELIVERIES = { count: 0, next: null, previous: null, results: [] };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedComms.listMessages.mockImplementation(() => Promise.resolve(MESSAGES) as never);
  mockedComms.listDeliveries.mockImplementation(() => Promise.resolve(EMPTY_DELIVERIES) as never);
  mockedComms.getMessage.mockImplementation(() => Promise.resolve(MESSAGE) as never);
});

describe("Communications", () => {
  it("renders the staff tab list from the mocked GET", async () => {
    render(<Communications />);
    expect(await screen.findByText("Reunión de personal")).toBeInTheDocument();
    expect(mockedComms.listMessages).toHaveBeenCalled();
  });

  it("clicking a row's Ver button opens MessageDetailDialog with the fetched detail", async () => {
    render(<Communications />);
    await screen.findByText("Reunión de personal");

    fireEvent.click(screen.getByRole("button", { name: /Ver/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(mockedComms.getMessage).toHaveBeenCalledWith(1));
    expect(await screen.findByText("Cuerpo del mensaje de prueba")).toBeInTheDocument();
  });

  it("shows the compose action for ADMIN and navigates to the compose page on click", async () => {
    render(<Communications />);
    await screen.findByText("Reunión de personal");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo aviso al personal/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/comunicaciones/nuevo");
  });

  it("hides the compose action for a role without sendStaffEmail permission", async () => {
    currentRole = "RECEPTIONIST";
    render(<Communications />);
    await screen.findByText("Reunión de personal");

    expect(screen.queryByRole("button", { name: /Nuevo aviso al personal/i })).not.toBeInTheDocument();
  });
});
