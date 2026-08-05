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
}

export interface LoginResponse {
  access: string;
  refresh: string;
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
  doctor_count: number;
}

export interface DoctorProfile {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  specialty: string;
  license_number: string;
  contact_phone: string;
  contact_email: string;
  bio: string;
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
  address: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Medicine {
  id: number;
  generic_name: string;
  commercial_name: string;
  concentration: string;
}

export interface RecordImage {
  id: number;
  record: number;
  image: string;
  image_url: string | null;
  caption: string;
  uploaded_by: number | null;
}

export interface MedicalRecord {
  id: number;
  patient: number;
  patient_info: { id: number; full_name: string; gender: string };
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
}

export interface ConsultationLog {
  id: number;
  patient: number;
  patient_info: { id: number; full_name: string; gender: string };
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
}

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface Appointment {
  id: number;
  patient: number;
  patient_info: { id: number; full_name: string; gender: string };
  doctor: number;
  doctor_info: { id: number; full_name: string; specialty: string };
  center: number | null;
  center_name: string | null;
  date_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}
