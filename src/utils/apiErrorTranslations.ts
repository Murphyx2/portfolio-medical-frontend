import i18n from "../i18n";

/** Backend-authored error/validation strings always come back in English --
 * the Django backend has no working i18n pipeline (no LOCALE_PATHS, no
 * LocaleMiddleware, no translation catalog). Rather than build that out
 * server-side (risking every backend test that asserts on these exact
 * strings), this table translates them at the display boundary: only when
 * the UI's active language is Spanish, since English backend text already
 * matches an English UI. Anything not in this table (a message added later,
 * or one already Spanish) just passes through unchanged. */

const LABELS: Record<string, string> = {
  Cedula: "Cédula",
  NSS: "NSS",
  "Guardian cedula": "Cédula del tutor",
  "Guardian NSS": "NSS del tutor",
};

const EXACT: Record<string, string> = {
  // Permissions / mixins
  "Restore is admin-only.": "Restaurar es exclusivo de administradores.",
  "Only admins can approve bindings.": "Solo los administradores pueden aprobar las vinculaciones.",
  "You do not have permission to perform this action.": "No tienes permiso para realizar esta acción.",
  "Authentication credentials were not provided.": "No se proporcionaron credenciales de autenticación.",
  "Not found.": "No encontrado.",
  "Given token not valid for any token type": "El token proporcionado no es válido.",

  // Validators
  "Phone cannot contain letters.": "El teléfono no puede contener letras.",
  "Phone must contain exactly 10 digits.": "El teléfono debe contener exactamente 10 dígitos.",

  // Patients
  "A patient with this cedula already exists.": "Ya existe un paciente con esta cédula.",
  "Enter a valid email address.": "Ingrese un correo electrónico válido.",
  "Birth date is required.": "La fecha de nacimiento es obligatoria.",
  "Birth date must be a valid date (YYYY-MM-DD).": "La fecha de nacimiento debe ser una fecha válida (AAAA-MM-DD).",
  "Birth date cannot be in the future.": "La fecha de nacimiento no puede ser una fecha futura.",
  "A patient with this NSS already exists.": "Ya existe un paciente con este NSS.",
  "The selected program does not belong to the selected ARS.": "El programa seleccionado no pertenece a la ARS seleccionada.",
  "You are not approved to work at this center.": "No estás aprobado para trabajar en este centro.",
  "Cedula is required.": "La cédula es obligatoria.",
  "At least one guardian is required when the patient is a minor with a guardian on file.":
    "Se requiere al menos un tutor cuando el paciente es menor de edad y tiene un tutor registrado.",
  "Each guardian requires first name, last name, cedula, and phone.":
    "Cada tutor requiere nombre, apellido, cédula y teléfono.",

  // Doctors
  "This user already has a doctor profile.": "Este usuario ya tiene un perfil de doctor.",
  "Only admins or center managers may edit a doctor's services.":
    "Solo administradores o gerentes de centro pueden editar los servicios de un doctor.",
  "Only admins or center managers may edit a doctor's rooms.":
    "Solo administradores o gerentes de centro pueden editar los consultorios de un doctor.",
  "Center managers may only edit a doctor's services and rooms.":
    "Los gerentes de centro solo pueden editar los servicios y consultorios de un doctor.",
  "Doctors may only manage schedules for themselves.": "Los doctores solo pueden gestionar sus propios horarios.",

  // Appointments
  "Doctors may only manage appointments for themselves.": "Los doctores solo pueden gestionar sus propias citas.",
  "Appointment date/time cannot be in the past.": "La fecha/hora de la cita no puede estar en el pasado.",
  "This appointment is already closed.": "Esta cita ya está cerrada.",
  "A cancellation reason is required.": "Se requiere un motivo de cancelación.",
  "Only scheduled appointments can be confirmed.": "Solo las citas programadas pueden confirmarse.",
  "Only confirmed appointments can be completed.": "Solo las citas confirmadas pueden completarse.",

  // Encounters
  "Doctors may only manage encounters for themselves.": "Los doctores solo pueden gestionar sus propios encuentros.",
  "A doctor is required for this service type.": "Se requiere un doctor para este tipo de servicio.",
  "At least one service is required.": "Se requiere al menos un servicio.",
  "This encounter is already closed.": "Este encuentro ya está cerrado.",
  "Only an active encounter can be completed.": "Solo un encuentro activo puede completarse.",
  "Only a draft encounter can be admitted.": "Solo un encuentro en borrador puede admitirse.",
  "A room is required to admit this encounter.": "Se requiere un consultorio para admitir este encuentro.",
  "This patient already has an active encounter today.": "Este paciente ya tiene un encuentro activo hoy.",

  // Records
  "Unsupported image format.": "Formato de imagen no compatible.",
  "File is not a valid image.": "El archivo no es una imagen válida.",
  "Provide exactly one of ap_type or custom_label.": "Proporcione únicamente el tipo de AP o una etiqueta personalizada.",
  "Required when relationship is Otro.": "Obligatorio cuando el parentesco es Otro.",
  "TA requires both systolic and diastolic, or neither.": "La TA requiere tanto la sistólica como la diastólica, o ninguna.",
  "Systolic must be greater than or equal to diastolic.": "La sistólica debe ser mayor o igual que la diastólica.",

  // Accounts
  "Only admins can assign the ADMIN role.": "Solo los administradores pueden asignar el rol de ADMIN.",
  "Only admins can modify admin accounts.": "Solo los administradores pueden modificar cuentas de administrador.",
};

const PATTERNS: { re: RegExp; es: (m: RegExpMatchArray) => string }[] = [
  {
    re: /^(.+) must contain exactly 11 digits\.$/,
    es: (m) => `${LABELS[m[1]] ?? m[1]} debe contener exactamente 11 dígitos.`,
  },
  {
    re: /^(.+) must contain digits only\.$/,
    es: (m) => `${LABELS[m[1]] ?? m[1]} debe contener solo dígitos.`,
  },
  {
    re: /^(.+) must be at most 11 digits\.$/,
    es: (m) => `${LABELS[m[1]] ?? m[1]} debe tener máximo 11 dígitos.`,
  },
  {
    re: /^Image must be smaller than (.+) MB\.$/,
    es: (m) => `La imagen debe ser menor a ${m[1]} MB.`,
  },
];

export function translateApiMessage(message: string): string {
  if (!message || !i18n.language.startsWith("es")) return message;
  const exact = EXACT[message];
  if (exact) return exact;
  for (const pattern of PATTERNS) {
    const match = message.match(pattern.re);
    if (match) return pattern.es(match);
  }
  return message;
}
