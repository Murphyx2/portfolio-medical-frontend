export type Role =
  | "ADMIN"
  | "DOCTOR"
  | "RECEPTIONIST"
  | "IT"
  | "NURSE"
  | "CENTER_MANAGER";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  is_locked: boolean;
  locked_until: string | null;
  last_login: string | null;
}

export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "FAILED_LOGIN"
  | "EXPORT";

export interface AuditLogEntry {
  id: number;
  action: AuditAction;
  target_type: string;
  target_id: number | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface LoginResponse {
  access: string;
  user: User;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MedicalCenter {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  is_default: boolean;
  doctor_count: number;
  active: boolean;
}

export interface ServiceLite {
  id: number;
  name: string;
}

export interface RoomLite {
  id: number;
  name: string;
}

export interface ExtraPhone {
  id?: number;
  phone: string;
}

export interface DoctorProfile {
  id: number;
  code: string;
  user_id: number;
  username: string;
  full_name: string;
  license_number: string;
  contact_phone: string;
  extra_phones: ExtraPhone[];
  contact_email: string;
  bio: string;
  default_room: number | null;
  default_room_name: string | null;
  services: number[];
  services_detail: ServiceLite[];
  rooms: number[];
  rooms_detail: RoomLite[];
  active: boolean;
}

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_date: string | null;
  age: number | null;
  gender: string;
  phone: string;
  extra_phones: ExtraPhone[];
  address: string;
  email: string;
  cedula: string;
  nss: string;
  ars: number | null;
  ars_name: string | null;
  ars_program: number | null;
  ars_program_name: string | null;
  center: number | null;
  center_name: string | null;
  center_code: string | null;
  has_guardian: boolean;
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_cedula: string;
  guardian_nss: string;
  guardian_phone: string;
  allergies: string;
  critical_conditions: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface ARSProgram {
  id: number;
  name: string;
  active: boolean;
}

export interface ARS {
  id: number;
  ars_id: string;
  name: string;
  programs: ARSProgram[];
  active: boolean;
}

export interface Medicine {
  id: number;
  generic_name: string;
  commercial_name: string;
  concentration: string;
  active: boolean;
}

export interface RecordImage {
  id: number;
  record: number;
  image: string;
  image_url: string | null;
  caption: string;
  uploaded_by: number | null;
  active: boolean;
}

export interface PatientLite {
  id: number;
  full_name: string;
  gender: string;
  cedula: string;
  nss: string;
}

export interface MedicalRecord {
  id: number;
  patient: number;
  patient_info: PatientLite;
  created_by: number;
  created_by_name: string;
  center: number | null;
  center_name: string | null;
  title: string;
  date: string;
  diagnosis: string;
  treatment: string;
  medicine_and_doses: string;
  notes: string;
  images: RecordImage[];
  active: boolean;
}

export interface ConsultationLog {
  id: number;
  patient: number;
  patient_info: PatientLite;
  doctor: number;
  doctor_name: string;
  center: number | null;
  center_name: string | null;
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  notes: string;
  active: boolean;
}

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface ServiceType {
  id: number;
  name: string;
  requires_doctor: boolean;
  requires_diagnosis: boolean;
  active: boolean;
}

export interface Service {
  id: number;
  simon: string;
  name: string;
  type: number;
  type_name: string;
  co_pago: string;
  privado: string;
  created_at: string;
  active: boolean;
}

export interface RoomType {
  id: number;
  name: string;
  active: boolean;
}

export interface Room {
  id: number;
  code: string;
  name: string;
  room_type: number;
  room_type_name: string;
  center: number;
  center_name: string;
  floor_area: string;
  capacity: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface Appointment {
  id: number;
  patient: number;
  patient_info: { id: number; full_name: string; gender: string; phone: string };
  doctor: number;
  doctor_info: { id: number; full_name: string };
  center: number | null;
  center_name: string | null;
  service: number | null;
  service_detail: { id: number; name: string } | null;
  date_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string;
  cancel_reason: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  active: boolean;
}

export type EncounterStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type EncounterPriority = "ROUTINE" | "URGENT" | "EMERGENCY";
export type EncounterServiceStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface EncounterPatientSummary {
  id: number;
  full_name: string;
  age: number | null;
  gender: string;
  cedula: string;
  allergies: string;
  critical_conditions: string;
  ars: number | null;
  ars_name: string | null;
  ars_program: number | null;
  has_guardian: boolean;
  guardian_cedula: string;
}

export interface EncounterDiagnosis {
  id?: number;
  description: string;
  is_primary: boolean;
}

export interface EncounterService {
  id?: number;
  service: number;
  service_name?: string;
  doctor: number | null;
  doctor_name?: string | null;
  quantity: number;
  notes: string;
  status: EncounterServiceStatus;
}

export interface Encounter {
  id: number;
  encounter_number: string | null;
  service_type: number;
  service_type_name: string;
  patient: number;
  patient_info: EncounterPatientSummary;
  doctor: number | null;
  doctor_info: { id: number; code: string; full_name: string } | null;
  referring_doctor_name: string;
  room: number | null;
  room_name: string | null;
  center: number | null;
  center_name: string | null;
  status: EncounterStatus;
  priority: EncounterPriority;
  admitted_at: string | null;
  completed_at: string | null;
  chief_complaint: string;
  cancel_reason: string;
  ars: number | null;
  ars_name: string | null;
  ars_program: number | null;
  ars_program_name: string | null;
  authorization_number: string;
  diagnoses: EncounterDiagnosis[];
  services: EncounterService[];
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}
