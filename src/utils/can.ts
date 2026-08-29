import type { Role } from "../services/types";

/**
 * Single source of truth for role-based access control across the app.
 * Nav visibility (`Layout.tsx`), route-level gating (`App.tsx`'s
 * `ProtectedRoute`), and every page-local "can I see this button" check all
 * read from this one table -- replaces 26 previously-scattered page-local
 * booleans and 3 uncoordinated enforcement layers.
 *
 * Deliberately a plain literal lookup, not a rules engine/DSL: this is
 * Operate-mode UI with a fixed, small set of roles and resources, and a
 * flat table is the easiest thing to audit against the policy matrix in
 * `ARCHITECTURE_REFACTOR_PLAN.md`'s F2 entry.
 *
 * CENTER_MANAGER is admin-equivalent everywhere in this table except
 * `settings.edit`, which stays ADMIN-only -- CM may view Settings (see the
 * `settings.view` row) and may still change the Language field (see
 * `language.edit`), but can't touch anything else on that page.
 */

export type Resource =
  | "patients"
  | "encounters"
  | "records"
  | "recordApTypes"
  | "rooms"
  | "roomTypes"
  | "medicines"
  | "doctors"
  | "appointments"
  | "users"
  | "ars"
  | "centers"
  | "services"
  | "serviceTypes"
  | "settings"
  | "language"
  | "communications"
  | "communicationsSettings"
  | "reportes";

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "restore"
  | "manage"
  | "manageServices"
  | "manageRooms"
  | "confirm"
  | "complete"
  | "cancel"
  | "showInactive"
  | "assignAdminRole"
  | "unlock"
  | "changePassword"
  | "viewActivity"
  | "sendStaffEmail"
  | "sendAlerta"
  | "manageTemplates"
  | "manageWhatsappSettings"
  | "sendManualReminder"
  | "toggleWhatsappOptIn";

const ALL_ROLES: Role[] = ["ADMIN", "DOCTOR", "RECEPTIONIST", "IT", "NURSE", "CENTER_MANAGER"];

// Actions that, unless a resource explicitly overrides them below, default
// to ADMIN/CENTER_MANAGER-only (CM is admin-equivalent app-wide except
// Settings edit) -- matches today's uniform behavior for the "restore" row
// action, the "show inactive" toolbar toggle, and (Users-only) assigning
// the ADMIN role.
const ADMIN_ONLY_DEFAULT_ACTIONS: Action[] = ["restore", "showInactive", "assignAdminRole"];

const ROOM_LIKE_WRITE: Role[] = ["ADMIN", "IT", "RECEPTIONIST", "CENTER_MANAGER"];
const APPOINTMENT_WRITE: Role[] = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "CENTER_MANAGER"];
const CENTER_MANAGER_WRITE: Role[] = ["ADMIN", "CENTER_MANAGER"];

const POLICY: Partial<Record<Resource, Partial<Record<Action, Role[]>>>> = {
  patients: {
    view: ALL_ROLES,
    // CENTER_MANAGER is admin-equivalent (full PII, full write) -- IT
    // remains excluded (it stays a masked-PII role).
    create: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "CENTER_MANAGER"],
    edit: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "CENTER_MANAGER"],
    delete: ["ADMIN", "DOCTOR", "CENTER_MANAGER"],
  },
  encounters: {
    view: ALL_ROLES,
    manage: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "CENTER_MANAGER"],
    // IT stays excluded; CENTER_MANAGER (admin-equivalent) gains delete.
    delete: ["ADMIN", "CENTER_MANAGER"],
  },
  records: {
    // CENTER_MANAGER is admin-equivalent and can now see/manage Records too
    // -- RECEPTIONIST and IT remain excluded (masked/no-clinical-access
    // roles).
    view: ["ADMIN", "DOCTOR", "NURSE", "CENTER_MANAGER"],
    create: ["ADMIN", "DOCTOR", "NURSE", "CENTER_MANAGER"],
    edit: ["ADMIN", "DOCTOR", "NURSE", "CENTER_MANAGER"],
    // Per Expedientes Médicos spec section 3, soft-deleting an expediente
    // is Admin-only; CENTER_MANAGER (admin-equivalent) shares that gate.
    delete: ["ADMIN", "CENTER_MANAGER"],
  },
  recordApTypes: {
    // AP (Antecedentes Patológicos) catalog: same viewers as Records;
    // catalog management is Admin/CenterManager (spec section 3, widened
    // for CM's admin-equivalent status).
    view: ["ADMIN", "DOCTOR", "NURSE", "CENTER_MANAGER"],
    edit: ["ADMIN", "CENTER_MANAGER"],
    delete: ["ADMIN", "CENTER_MANAGER"],
  },
  rooms: {
    view: ALL_ROLES,
    // Only ADMIN/CENTER_MANAGER get write access -- RECEPTIONIST, IT,
    // NURSE, and DOCTOR are read-only.
    create: CENTER_MANAGER_WRITE,
    edit: CENTER_MANAGER_WRITE,
    delete: CENTER_MANAGER_WRITE,
  },
  roomTypes: {
    view: ALL_ROLES,
    // Same as Rooms.
    create: CENTER_MANAGER_WRITE,
    edit: CENTER_MANAGER_WRITE,
    delete: CENTER_MANAGER_WRITE,
  },
  medicines: {
    view: ALL_ROLES,
    create: ROOM_LIKE_WRITE,
    edit: ROOM_LIKE_WRITE,
    delete: ROOM_LIKE_WRITE,
  },
  doctors: {
    view: ALL_ROLES,
    // CENTER_MANAGER (admin-equivalent) gains full doctor-profile CRUD, not
    // just the services/rooms fields.
    create: ["ADMIN", "IT", "CENTER_MANAGER"],
    edit: ["ADMIN", "IT", "CENTER_MANAGER"],
    delete: ["ADMIN", "IT", "CENTER_MANAGER"],
    manageServices: CENTER_MANAGER_WRITE,
    manageRooms: CENTER_MANAGER_WRITE,
  },
  appointments: {
    view: ALL_ROLES,
    // create/complete/cancel/edit all share one role set.
    create: APPOINTMENT_WRITE,
    edit: APPOINTMENT_WRITE,
    confirm: APPOINTMENT_WRITE,
    complete: APPOINTMENT_WRITE,
    cancel: APPOINTMENT_WRITE,
    delete: APPOINTMENT_WRITE,
  },
  users: {
    // CENTER_MANAGER is admin-equivalent for user management too, including
    // assigning the ADMIN role and deleting/unlocking any account.
    view: ["ADMIN", "IT", "CENTER_MANAGER"],
    create: ["ADMIN", "IT", "CENTER_MANAGER"],
    edit: ["ADMIN", "IT", "CENTER_MANAGER"],
    delete: ["ADMIN", "CENTER_MANAGER"],
    restore: ["ADMIN", "CENTER_MANAGER"],
    unlock: ["ADMIN", "CENTER_MANAGER"],
    changePassword: ["ADMIN", "CENTER_MANAGER"],
    viewActivity: ["ADMIN", "CENTER_MANAGER"],
    assignAdminRole: ["ADMIN", "CENTER_MANAGER"],
    showInactive: ["ADMIN", "CENTER_MANAGER"],
  },
  ars: {
    view: ALL_ROLES,
    create: ["ADMIN", "CENTER_MANAGER"],
    edit: ["ADMIN", "CENTER_MANAGER"],
    delete: ["ADMIN", "CENTER_MANAGER"],
    restore: ["ADMIN", "CENTER_MANAGER"],
  },
  centers: {
    // Hidden from every role except ADMIN/CENTER_MANAGER (admin-
    // equivalent) -- page, nav, and API all gate on this.
    view: ["ADMIN", "CENTER_MANAGER"],
    create: ["ADMIN", "CENTER_MANAGER"],
    edit: ["ADMIN", "CENTER_MANAGER"],
    delete: ["ADMIN", "CENTER_MANAGER"],
  },
  services: {
    view: ALL_ROLES,
    create: CENTER_MANAGER_WRITE,
    edit: CENTER_MANAGER_WRITE,
    delete: CENTER_MANAGER_WRITE,
  },
  serviceTypes: {
    view: ALL_ROLES,
    create: CENTER_MANAGER_WRITE,
    edit: CENTER_MANAGER_WRITE,
    delete: CENTER_MANAGER_WRITE,
  },
  settings: {
    // Mirrors the backend's IsAdminOrITReadOnly (apps.core.permissions):
    // ADMIN reads/writes, IT reads only. CENTER_MANAGER also reads (needed
    // to reach the Language section below) but can never edit the rest of
    // Settings -- this is the one deliberate gap in CM's otherwise
    // admin-equivalent access. Every other role has no access at all (not
    // even the nav link).
    view: ["ADMIN", "IT", "CENTER_MANAGER"],
    edit: ["ADMIN"],
  },
  language: {
    // Narrower carve-out within the Settings page: CENTER_MANAGER may edit
    // only the language picker, not the rest of settings.
    edit: ["ADMIN", "CENTER_MANAGER"],
  },
  communications: {
    // Requirements/Communications/COMMUNICATIONS_MODULE_REQUIREMENTS.md §4:
    // IT never opens Comunicaciones at all (unlike its usual masked-PII
    // read access elsewhere); CENTER_MANAGER is admitted as admin-equivalent
    // per this table's usual convention even though §4's literal role
    // columns don't list it explicitly.
    view: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "CENTER_MANAGER"],
    sendStaffEmail: ["ADMIN", "DOCTOR"],
    sendAlerta: ["ADMIN"],
    sendManualReminder: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "CENTER_MANAGER"],
    toggleWhatsappOptIn: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "CENTER_MANAGER"],
  },
  communicationsSettings: {
    // Ajustes and Plantillas are Admin-only per §4 ("Configure SMTP /
    // WhatsApp credentials" / "Edit email / WhatsApp templates" -- neither
    // row includes IT, unlike the general Settings page).
    view: ["ADMIN"],
    manageTemplates: ["ADMIN"],
    manageWhatsappSettings: ["ADMIN"],
  },
  reportes: {
    // Requirements/ReportPage/REPORTES_REQUIREMENTS.md §2: unlike this
    // table's usual CENTER_MANAGER-is-admin-equivalent convention, a Gerente
    // may view + Generar (own center only, enforced server-side) but may
    // NOT author report/pack definitions -- that stays ADMIN/IT only, same
    // deliberate carve-out shape as `settings.edit`.
    view: ["ADMIN", "IT", "CENTER_MANAGER"],
    edit: ["ADMIN", "IT"],
  },
};

export function can(role: Role | undefined | null, action: Action, resource: Resource): boolean {
  if (!role) return false;
  const explicit = POLICY[resource]?.[action];
  if (explicit) return explicit.includes(role);
  if (ADMIN_ONLY_DEFAULT_ACTIONS.includes(action)) return role === "ADMIN" || role === "CENTER_MANAGER";
  return false;
}

// Status-aware: the flat POLICY table has no concept of per-object state, so
// this can't be expressed as a plain "edit" row. Once an appointment is
// COMPLETED or CANCELLED, only ADMIN/CENTER_MANAGER may still edit it
// (mirrors the backend's CanManageAppointments.has_object_permission).
export function canEditAppointment(role: Role | undefined | null, status: string): boolean {
  if (status === "COMPLETED" || status === "CANCELLED") return role === "ADMIN" || role === "CENTER_MANAGER";
  return can(role, "edit", "appointments");
}
