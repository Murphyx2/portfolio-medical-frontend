import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordApTypes } from "./RecordApTypes";
import { api } from "../services/api";
import type { APCategory, APType, Paginated } from "../services/types";

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

const CATEGORY: APCategory = { id: 2, name: "Cardiovascular", sort_order: 0, active: true };

const AP_TYPE: APType = {
  id: 1,
  category: 2,
  category_name: "Cardiovascular",
  name: "Hipertensión",
  sort_order: 0,
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "ADMIN";
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/ap-types/")) return Promise.resolve(paginated([AP_TYPE])) as never;
    if (path.startsWith("/ap-categories/")) return Promise.resolve(paginated([CATEGORY])) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("RecordApTypes", () => {
  it("renders the list from a mocked GET", async () => {
    render(<RecordApTypes />);
    expect(await screen.findByText("Hipertensión")).toBeInTheDocument();
  });

  it("opens the create modal, fills required fields, and POSTs on submit", async () => {
    mockedApi.post.mockResolvedValue({ ...AP_TYPE, id: 9 });
    render(<RecordApTypes />);
    await screen.findByText("Hipertensión");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo tipo/i }));

    fireEvent.change(screen.getByLabelText(/^Nombre$/i), { target: { value: "Diabetes" } });
    fireEvent.change(screen.getByLabelText(/^Categoría$/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/ap-types/");
    expect(body).toMatchObject({ name: "Diabetes", category: 2 });
  });

  it("opens the edit modal pre-filled and PATCHes on submit", async () => {
    mockedApi.patch.mockResolvedValue(AP_TYPE);
    render(<RecordApTypes />);
    await screen.findByText("Hipertensión");

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByDisplayValue("Hipertensión")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(`/ap-types/${AP_TYPE.id}/`, expect.anything()),
    );
  });

  it("hides the create/manage-categories actions for a role without recordApTypes edit permission", async () => {
    currentRole = "DOCTOR";
    render(<RecordApTypes />);
    await screen.findByText("Hipertensión");
    expect(screen.queryByRole("button", { name: /Nuevo tipo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gestionar categorías/i })).not.toBeInTheDocument();
  });

  it("opens the manage-categories dialog and lists existing categories", async () => {
    render(<RecordApTypes />);
    await screen.findByText("Hipertensión");

    fireEvent.click(screen.getByRole("button", { name: /Gestionar categorías/i }));

    expect(await screen.findByRole("heading", { name: /Categorías de AP/i })).toBeInTheDocument();
    // Rendered twice: once in the underlying category-filter <select> option,
    // once as a row in the categories dialog's own Table.
    expect(screen.getAllByText("Cardiovascular").length).toBeGreaterThan(0);
  });
});
