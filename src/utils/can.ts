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
  | "language";

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
  | "viewActivity";

const ALL_ROLES: Role[] = ["ADMIN", "DOCTOR", "RECEPTIONIST", "IT", "NURSE", "CENTER_MANAGER"];

// Actions that, unless a resource explicitly overrides them below, default
// to ADMIN-only -- matches today's uniform behavior for the "restore" row
// action, the "show inactive" toolbar toggle, and (Users-only) assigning
// the ADMIN role.
const ADMIN_ONLY_DEFAULT_ACTIONS: Action[] = ["restore", "showInactive", "assignAdminRole"];

const ROOM_LIKE_WRITE: Role[] = ["ADMIN", "IT", "RECEPTIONIST"];
const APPOINTMENT_WRITE: Role[] = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"];
const CENTER_MANAGER_WRITE: Role[] = ["ADMIN", "CENTER_MANAGER"];

const POLICY: Partial<Record<Resource, Partial<Record<Action, Role[]>>>> = {
  patients: {
    view: ALL_ROLES,
    // Narrowed: IT/CENTER_MANAGER lose create/edit (they can't see full PII either).
    create: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"],
    edit: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"],
    delete: ["ADMIN", "DOCTOR"],
  },
  encounters: {
    view: ALL_ROLES,
    manage: ["ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "CENTER_MANAGER"],
    // Narrowed: IT loses delete (was ADMIN, IT).
    delete: ["ADMIN"],
  },
  records: {
    // Narrowed: records are ADMIN/DOCTOR/NURSE-only now -- RECEPTIONIST, IT,
    // and CENTER_MANAGER can no longer see the Records page, its nav link,
    // or any "open record" button anywhere in the app.
    view: ["ADMIN", "DOCTOR", "NURSE"],
    create: ["ADMIN", "DOCTOR", "NURSE"],
    edit: ["ADMIN", "DOCTOR", "NURSE"],
    // Narrowed per Expedientes Médicos spec section 3: only Admin may
    // soft-delete an expediente (was ["ADMIN","DOCTOR","NURSE"]).
    delete: ["ADMIN"],
  },
  recordApTypes: {
    // AP (Antecedentes Patológicos) catalog: same viewers as Records, but
    // catalog management is Admin-only (spec section 3).
    view: ["ADMIN", "DOCTOR", "NURSE"],
    edit: ["ADMIN"],
    delete: ["ADMIN"],
  },
  rooms: {
    view: ALL_ROLES,
    // Narrowed: only ADMIN/CENTER_MANAGER get write access -- RECEPTIONIST,
    // IT, NURSE, and DOCTOR are read-only.
    create: CENTER_MANAGER_WRITE,
    edit: CENTER_MANAGER_WRITE,
    delete: CENTER_MANAGER_WRITE,
  },
  roomTypes: {
    view: ALL_ROLES,
    // Narrowed: same as Rooms.
    create: CENTER_MANAGER_WRITE,
    edit: CENTER_MANAGER_WRITE,
    delete: CENTER_MANAGER_WRITE,
  },
  medicines: {
    view: ALL_ROLES,
    create: ROOM_LIKE_WRITE,
    edit: ROOM_LIKE_WRITE,
    // Widened: RECEPTIONIST gains delete (was create/edit-only).
    delete: ROOM_LIKE_WRITE,
  },
  doctors: {
    view: ALL_ROLES,
    create: ["ADMIN", "IT"],
    edit: ["ADMIN", "IT"],
    delete: ["ADMIN", "IT"],
    // Explicitly confirmed intentional -- IT stays excluded.
    manageServices: CENTER_MANAGER_WRITE,
    manageRooms: CENTER_MANAGER_WRITE,
  },
  appointments: {
    view: ALL_ROLES,
    // create/complete/cancel/edit all share one role set (new `edit` action
    // added, same role set as create/complete/cancel per user directive).
    create: APPOINTMENT_WRITE,
    edit: APPOINTMENT_WRITE,
    confirm: APPOINTMENT_WRITE,
    complete: APPOINTMENT_WRITE,
    cancel: APPOINTMENT_WRITE,
    // Widened: RECEPTIONIST gains delete.
    delete: APPOINTMENT_WRITE,
  },
  users: {
    view: ["ADMIN", "IT"],
    create: ["ADMIN", "IT"],
    edit: ["ADMIN", "IT"],
    // Narrowed to match the backend (M-08): deactivate/restore/unlock/
    // password-reset/activity are more sensitive than editing a profile
    // field, so IT keeps view/create/edit only.
    delete: ["ADMIN"],
    restore: ["ADMIN"],
    unlock: ["ADMIN"],
    changePassword: ["ADMIN"],
    viewActivity: ["ADMIN"],
    assignAdminRole: ["ADMIN"],
    showInactive: ["ADMIN"],
  },
  ars: {
    // Widened: every role can see ARSs (was ADMIN, RECEPTIONIST only).
    view: ALL_ROLES,
    create: ["ADMIN"],
    edit: ["ADMIN"],
    delete: ["ADMIN"],
    restore: ["ADMIN"],
  },
  centers: {
    // Narrowed: hidden from every role except ADMIN (page, nav, and API).
    view: ["ADMIN"],
    create: ["ADMIN"],
    edit: ["ADMIN"],
    delete: ["ADMIN"],
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
    // to reach the Language section below) but can't edit numeric fields --
    // every other role has no access at all (not even the nav link).
    view: ["ADMIN", "IT", "CENTER_MANAGER"],
    edit: ["ADMIN"],
  },
  language: {
    // Narrower carve-out within the Settings page: CENTER_MANAGER may edit
    // only the language picker, not the rest of settings.
    edit: ["ADMIN", "CENTER_MANAGER"],
  },
};

export function can(role: Role | undefined | null, action: Action, resource: Resource): boolean {
  if (!role) return false;
  const explicit = POLICY[resource]?.[action];
  if (explicit) return explicit.includes(role);
  if (ADMIN_ONLY_DEFAULT_ACTIONS.includes(action)) return role === "ADMIN";
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
