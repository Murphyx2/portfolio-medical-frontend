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
  | "rooms"
  | "roomTypes"
  | "medicines"
  | "doctors"
  | "appointments"
  | "users"
  | "ars"
  | "centers"
  | "services"
  | "serviceTypes";

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "restore"
  | "manage"
  | "manageServices"
  | "manageRooms"
  | "complete"
  | "cancel"
  | "showInactive"
  | "assignAdminRole";

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
    delete: ["ADMIN", "DOCTOR", "NURSE"],
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
    complete: APPOINTMENT_WRITE,
    cancel: APPOINTMENT_WRITE,
    // Widened: RECEPTIONIST gains delete.
    delete: APPOINTMENT_WRITE,
  },
  users: {
    view: ["ADMIN", "IT"],
    create: ["ADMIN", "IT"],
    edit: ["ADMIN", "IT"],
    delete: ["ADMIN", "IT"],
    restore: ["ADMIN"],
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
};

export function can(role: Role | undefined | null, action: Action, resource: Resource): boolean {
  if (!role) return false;
  const explicit = POLICY[resource]?.[action];
  if (explicit) return explicit.includes(role);
  if (ADMIN_ONLY_DEFAULT_ACTIONS.includes(action)) return role === "ADMIN";
  return false;
}
