import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Rooms } from "./Rooms";
import { api } from "../services/api";
import type { Room, RoomType } from "../services/types";

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

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    code: "R1",
    name: "Consultorio 1",
    room_type: 1,
    room_type_name: "Consultorio",
    center: 1,
    center_name: "Demo Center",
    floor_area: "20",
    capacity: 2,
    notes: "",
    created_at: "",
    updated_at: "",
    active: true,
    ...overrides,
  };
}

function roomType(overrides: Partial<RoomType> = {}): RoomType {
  return { id: 1, name: "Consultorio", active: true, ...overrides };
}

const ROOMS_LIST = { count: 1, next: null, previous: null, results: [room()] };
const ROOM_TYPES_LIST = { count: 1, next: null, previous: null, results: [roomType()] };

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/room-types/")) return Promise.resolve(ROOM_TYPES_LIST) as never;
    if (path.startsWith("/rooms/")) return Promise.resolve(ROOMS_LIST) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("Rooms", () => {
  it("renders the room list from the API", async () => {
    render(<Rooms />);
    expect(await screen.findByText("Consultorio 1")).toBeInTheDocument();
    expect(screen.getByText("R1")).toBeInTheDocument();
  });

  it("creates a new room via the modal", async () => {
    mockedApi.post.mockResolvedValue(room({ id: 2, code: "R2", name: "Consultorio 2" }));
    render(<Rooms />);
    await screen.findByText("Consultorio 1");

    fireEvent.click(screen.getByRole("button", { name: /Nueva sala/i }));

    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "r2" } });
    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "consultorio 2" } });
    fireEvent.change(screen.getByLabelText(/^Tipo$/i), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/rooms/");
    // The code/name fields upper-case on change.
    expect(body).toMatchObject({ code: "R2", name: "CONSULTORIO 2", room_type: 1 });
  });

  it("edits an existing room and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(room());
    render(<Rooms />);
    await screen.findByText("Consultorio 1");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("R1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Consultorio 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Capacidad$/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith("/rooms/1/", expect.objectContaining({ capacity: 5 })),
    );
  });

  it("hides the create action for a role without rooms create permission", async () => {
    currentRole = "NURSE";
    render(<Rooms />);
    await screen.findByText("Consultorio 1");
    expect(screen.queryByRole("button", { name: /Nueva sala/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Más/i })).not.toBeInTheDocument();
  });
});
