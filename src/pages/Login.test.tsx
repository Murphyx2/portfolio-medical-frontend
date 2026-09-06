import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { Login } from "./Login";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

let currentUser: { role: string } | null = null;
const mockLogin = vi.fn();
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: currentUser, login: mockLogin }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = null;
});

describe("Login", () => {
  it("renders the username and password fields", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/Username|Usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$|^Contraseña$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log in|Iniciar sesión/i })).toBeInTheDocument();
  });

  it("submitting valid credentials calls the auth context's login and navigates home", async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Username|Usuario/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/^Password$|^Contraseña$/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /Log in|Iniciar sesión/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith("admin", "secret123"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
  });

  it("shows an error message when credentials are invalid, without navigating", async () => {
    mockLogin.mockRejectedValue(new Error("invalid"));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Username|Usuario/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/^Password$|^Contraseña$/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /Log in|Iniciar sesión/i }));

    expect(await screen.findByText(/Invalid username or password|Usuario o contraseña inválidos/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects away from the login form when already authenticated", () => {
    currentUser = { role: "ADMIN" };
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.queryByLabelText(/Username|Usuario/i)).not.toBeInTheDocument();
  });
});
