import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoomTypes } from "./RoomTypes";
import { api } from "../services/api";
import type { RoomType } from "../services/types";

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

function roomType(overrides: Partial<RoomType> = {}): RoomType {
  return { id: 1, name: "Consultorio", active: true, ...overrides };
}

const ROOM_TYPES_LIST = { count: 1, next: null, previous: null, results: [roomType()] };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/room-types/")) return Promise.resolve(ROOM_TYPES_LIST) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("RoomTypes", () => {
  it("renders the room type list from the API", async () => {
    render(<RoomTypes />);
    expect(await screen.findByText("Consultorio")).toBeInTheDocument();
  });

  it("creates a new room type via the modal", async () => {
    mockedApi.post.mockResolvedValue(roomType({ id: 2, name: "Sala de espera" }));
    render(<RoomTypes />);
    await screen.findByText("Consultorio");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo tipo/i }));
    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "sala de espera" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/room-types/");
    // The name field upper-cases on change.
    expect(body).toMatchObject({ name: "SALA DE ESPERA" });
  });

  it("edits an existing room type and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(roomType());
    render(<RoomTypes />);
    await screen.findByText("Consultorio");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    expect(screen.getByDisplayValue("Consultorio")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "consultorio general" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        "/room-types/1/",
        expect.objectContaining({ name: "CONSULTORIO GENERAL" }),
      ),
    );
  });

  it("hides the create action for a role without roomTypes create permission", async () => {
    currentRole = "NURSE";
    render(<RoomTypes />);
    await screen.findByText("Consultorio");
    expect(screen.queryByRole("button", { name: /Nuevo tipo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Más/i })).not.toBeInTheDocument();
  });
});
