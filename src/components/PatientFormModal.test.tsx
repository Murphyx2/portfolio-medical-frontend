import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientFormModal } from "./PatientFormModal";
import { api } from "../services/api";
import type { Patient } from "../services/types";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { role: "ADMIN" } }),
}));

const mockedApi = vi.mocked(api);

const ARS_LIST = { count: 0, next: null, previous: null, results: [] };
const CENTERS_LIST = {
  count: 1,
  next: null,
  previous: null,
  results: [{ id: 1, name: "INCAF", code: "INCAF", address: "A", phone: "1", email: "", is_default: true, doctor_count: 0, active: true }],
};

function existingPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 5,
    first_name: "Jane",
    last_name: "Doe",
    full_name: "Jane Doe",
    birth_date: "1990-01-01",
    age: 36,
    gender: "FEMALE",
    phone: "8095550100",
    extra_phones: [],
    address: "123 Main St",
    email: "jane@example.com",
    cedula: "00100000001",
    nss: "",
    ars: null,
    ars_name: null,
    ars_program: null,
    ars_program_name: null,
    center: 1,
    center_name: "INCAF",
    center_code: "INCAF",
    has_guardian: true,
    guardians: [],
    allergies: "Penicillin",
    critical_conditions: "",
    created_at: "",
    updated_at: "",
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation((path: string) => {
    if (path.startsWith("/ars/")) return Promise.resolve(ARS_LIST) as never;
    if (path.startsWith("/centers/")) return Promise.resolve(CENTERS_LIST) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe("PatientFormModal", () => {
  it("creating a new patient defaults the center to the is_default center and posts on submit", async () => {
    const onSaved = vi.fn();
    mockedApi.post.mockResolvedValue(existingPatient({ id: 9 }));

    render(<PatientFormModal onClose={vi.fn()} onSaved={onSaved} />);

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining("/centers/")));

    fireEvent.change(screen.getByLabelText(/First name|Nombre/i), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Last name|Apellido/i), { target: { value: "Perez" } });
    fireEvent.change(screen.getByLabelText(/Birth date|Fecha de nacimiento/i), { target: { value: "1990-01-01" } });
    fireEvent.change(screen.getByLabelText(/^Sex$|^Sexo$/i), { target: { value: "FEMALE" } });
    fireEvent.change(screen.getByLabelText(/Cedula|Cédula/i), { target: { value: "00112345678" } });

    fireEvent.click(screen.getByRole("button", { name: /Save|Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [path, body] = mockedApi.post.mock.calls[0];
    expect(path).toBe("/patients/");
    expect(body).toMatchObject({ first_name: "Ana", last_name: "Perez", center: 1 });
    expect(onSaved).toHaveBeenCalledWith(existingPatient({ id: 9 }));
  });

  it("editing an existing patient pre-fills fields and PATCHes on submit", async () => {
    const onSaved = vi.fn();
    const patient = existingPatient();
    mockedApi.patch.mockResolvedValue(patient);

    render(<PatientFormModal patient={patient} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save|Guardar/i }));

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith(`/patients/${patient.id}/`, expect.anything()));
    expect(onSaved).toHaveBeenCalled();
  });

  it("blocks submit and shows an error when the phone number is invalid", async () => {
    render(<PatientFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining("/centers/")));

    // Fill every other required field so only the phone check can block
    // submission -- otherwise native HTML5 required-field validation stops
    // the form before the app's own onSubmit handler ever runs.
    fireEvent.change(screen.getByLabelText(/First name|Nombre/i), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Last name|Apellido/i), { target: { value: "Perez" } });
    fireEvent.change(screen.getByLabelText(/Birth date|Fecha de nacimiento/i), { target: { value: "1990-01-01" } });
    fireEvent.change(screen.getByLabelText(/^Sex$|^Sexo$/i), { target: { value: "FEMALE" } });
    fireEvent.change(screen.getByLabelText(/Cedula|Cédula/i), { target: { value: "00112345678" } });
    fireEvent.change(screen.getByLabelText(/^Phone$|^Teléfono$/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /Save|Guardar/i }));

    await waitFor(() => expect(document.querySelector(".field-error")).not.toBeNull());
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it("a minor patient posts a guardians array built from the guardian field group", async () => {
    const onSaved = vi.fn();
    mockedApi.post.mockResolvedValue(existingPatient({ id: 11 }));

    render(<PatientFormModal onClose={vi.fn()} onSaved={onSaved} />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining("/centers/")));

    fireEvent.change(screen.getByLabelText(/First name|Nombre/i), { target: { value: "Kid" } });
    fireEvent.change(screen.getByLabelText(/Last name|Apellido/i), { target: { value: "Doe" } });
    // DateField only commits form.birth_date (and thus the age/isMinor
    // calculation) on blur, in its own displayed DD/MM/YYYY format -- a
    // plain ISO fireEvent.change (as used for non-age-sensitive tests above)
    // never reaches form state here.
    const birthDateField = screen.getByLabelText(/Birth date|Fecha de nacimiento/i);
    fireEvent.change(birthDateField, { target: { value: "01/01/2015" } });
    fireEvent.blur(birthDateField);
    fireEvent.change(screen.getByLabelText(/^Sex$|^Sexo$/i), { target: { value: "MALE" } });
    fireEvent.change(screen.getByLabelText(/^Phone$|^Teléfono$/i), { target: { value: "8095550100" } });

    fireEvent.change(screen.getByLabelText(/Guardian's first name|Nombre del tutor/i), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByLabelText(/Guardian's last name|Apellido del tutor/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/Guardian's cedula|Cédula del tutor/i), {
      target: { value: "00112345678" },
    });
    fireEvent.change(screen.getByLabelText(/Guardian's phone|Teléfono del tutor/i), {
      target: { value: "8095550199" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save|Guardar/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
    const [, body] = mockedApi.post.mock.calls[0];
    expect(body).toMatchObject({
      guardians: [
        expect.objectContaining({
          first_name: "Maria",
          last_name: "Doe",
          cedula: "00112345678",
          phone: "8095550199",
        }),
      ],
    });
  });
});
