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
  center: number | null;
  center_name: string | null;
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

export interface SystemSettings {
  login_lockout_threshold: number;
  login_lockout_minutes: number;
  password_min_length: number;
  access_token_lifetime_minutes: number;
  refresh_token_lifetime_days: number;
  login_rate_limit_per_min: number;
  anon_rate_limit_per_min: number;
  user_rate_limit_per_min: number;
  max_image_upload_mb: number;
  media_token_ttl_minutes: number;
  default_page_size: number;
  updated_by: number | null;
  updated_at: string;
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

export type ReportEngineKey = "servicios_prestados";
export type ReportPackEngineKey = "paquete_ars";

export interface ReportDefinition {
  id: number;
  name: string;
  category: string;
  description: string;
  engine_key: ReportEngineKey;
  active: boolean;
  last_generated_at: string | null;
}

export interface ReportPack {
  id: number;
  name: string;
  periodicity: string;
  engine_key: ReportPackEngineKey;
  active: boolean;
  last_generated_at: string | null;
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

export interface PatientGuardian {
  id?: number;
  first_name: string;
  last_name: string;
  cedula: string;
  nss: string;
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
  guardians: PatientGuardian[];
  allergies: string;
  critical_conditions: string;
  whatsapp_opt_in: boolean;
  whatsapp_opt_in_at: string | null;
  whatsapp_opt_in_by: number | null;
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
  created_at: string;
}

export interface PatientLite {
  id: number;
  full_name: string;
  gender: string;
  cedula: string;
  nss: string;
  birth_date: string | null;
  has_guardian: boolean;
  guardians: PatientGuardian[];
}

export type RecordEntryStatus = "DRAFT" | "COMPLETED";

export type FamilyRelationship =
  | "MADRE"
  | "PADRE"
  | "HERMANA"
  | "HERMANO"
  | "HIJA"
  | "HIJO"
  | "ABUELA"
  | "ABUELO"
  | "TIA"
  | "TIO"
  | "OTRO";

export interface RecordPersonalCondition {
  id: number;
  record: number;
  ap_type: number | null;
  custom_label: string;
  is_custom: boolean;
  label: string;
}

export interface RecordFamilyCondition {
  id: number;
  record: number;
  related_patient: number | null;
  relationship: FamilyRelationship;
  relationship_other: string;
  relative_name: string;
  ap_type: number | null;
  custom_label: string;
  is_custom: boolean;
  label: string;
}

export interface ApSnapshotItem {
  ap_type_id: number | null;
  label: string;
  is_custom: boolean;
}

export interface FamilyApSnapshotItem extends ApSnapshotItem {
  related_patient_id: number | null;
  relationship: FamilyRelationship;
  relationship_other: string;
  relative_name: string;
}

export type SubstanceHabitStatus = "no_registrado" | "nunca" | "ex" | "ocasional" | "activo";
export type ActividadFisicaStatus = "no_registrado" | "sedentario" | "insuficiente" | "adecuado" | "intenso";
export type SuenoStatus = "no_registrado" | "reparador" | "irregular" | "insomnio";

export interface TabacoHabit {
  status: SubstanceHabitStatus;
  tipo?: string[];
  cantidad_dia?: number | null;
  tiempo_anios?: number | null;
  dejo_fecha?: string | null;
  humo_ajeno?: boolean;
}
export interface VapeoHabit {
  status: SubstanceHabitStatus;
  frecuencia_tipo?: "veces_dia" | "dias_semana";
  frecuencia_valor?: number | null;
  nicotina_mg?: number | null;
  nicotina?: string[];
  tiempo_anios?: number | null;
  dejo_fecha?: string | null;
}
export interface AlcoholHabit {
  status: SubstanceHabitStatus;
  ud_semana?: number | null;
  bebida?: string[];
  tiempo_anios?: number | null;
  dejo_fecha?: string | null;
}
export interface CafeHabit {
  status: SubstanceHabitStatus;
  tazas_dia?: number | null;
  tipo?: string[];
}
export interface PsicoactivasHabit {
  status: SubstanceHabitStatus;
  tipo?: string[];
  tipo_otro?: string;
  frecuencia?: string;
  via?: string;
  tiempo_anios?: number | null;
  dejo_fecha?: string | null;
}
export interface ActividadFisicaHabit {
  status: ActividadFisicaStatus;
  dias_semana?: number | null;
  minutos_sesion?: number | null;
  tipo?: string;
}
export interface SuenoHabit {
  status: SuenoStatus;
  horas_noche?: number | null;
  duerme_mal?: boolean;
  somnolencia_diurna?: boolean;
}
export interface PatronAlimentarioHabit {
  tags: string[];
}
export interface OtroHabitItem {
  name: string;
  note?: string;
}

export interface HabitsDraft {
  tabaco?: TabacoHabit;
  alcohol?: AlcoholHabit;
  cafe?: CafeHabit;
  vapeo?: VapeoHabit;
  psicoactivas?: PsicoactivasHabit;
  actividad_fisica?: ActividadFisicaHabit;
  sueno?: SuenoHabit;
  patron_alimentario?: PatronAlimentarioHabit;
  otros?: OtroHabitItem[];
}

export interface HabitsSnapshotEntry {
  status: string;
  at: string;
  pack_years?: string;
}
export interface HabitsSnapshot {
  tabaco?: HabitsSnapshotEntry;
  alcohol?: HabitsSnapshotEntry;
  cafe?: HabitsSnapshotEntry;
  vapeo?: HabitsSnapshotEntry;
  psicoactivas?: HabitsSnapshotEntry;
  actividad_fisica?: HabitsSnapshotEntry;
  sueno?: HabitsSnapshotEntry;
  patron_alimentario?: { tags: string[]; at: string };
  otros?: { items: OtroHabitItem[]; at: string };
}

export interface RecordEntry {
  id: number;
  record: number;
  author: number;
  author_name: string;
  status: RecordEntryStatus;
  ta_systolic: number | null;
  ta_diastolic: number | null;
  fc: number | null;
  fr: number | null;
  weight_lb: string | null;
  height_cm: string | null;
  talla_cm: string | null;
  temperature_c: string | null;
  glucose: number | null;
  vitals_notes: string;
  imc: string | null;
  dx: string;
  tx: string;
  observaciones: string;
  habits: HabitsDraft | null;
  habits_notes: string;
  personal_ap_snapshot: ApSnapshotItem[];
  family_ap_snapshot: FamilyApSnapshotItem[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalRecord {
  id: number;
  patient: number;
  patient_info: PatientLite;
  created_by: number;
  created_by_name: string;
  center: number | null;
  center_name: string | null;
  last_visit_at: string | null;
  last_height_cm: string | null;
  last_height_at: string | null;
  last_weight_lb: string | null;
  last_weight_at: string | null;
  last_imc: string | null;
  last_imc_at: string | null;
  last_ta_systolic: number | null;
  last_ta_diastolic: number | null;
  last_ta_at: string | null;
  last_fc: number | null;
  last_fc_at: string | null;
  last_fr: number | null;
  last_fr_at: string | null;
  last_glucose: number | null;
  last_glucose_at: string | null;
  habits_snapshot: HabitsSnapshot;
  images: RecordImage[];
  personal_conditions: RecordPersonalCondition[];
  family_conditions: RecordFamilyCondition[];
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

export interface APCategory {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface APType {
  id: number;
  category: number;
  category_name: string;
  name: string;
  sort_order: number;
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
  patient_info: {
    id: number;
    full_name: string;
    gender: string;
    phone: string;
    whatsapp_opt_in?: boolean;
  };
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

// --- Communications (Comunicaciones) ---

export type CommunicationsChannel = "EMAIL" | "WHATSAPP";
export type CommunicationsAudience = "STAFF" | "PATIENT";
export type CommunicationsKind =
  | "AVISO"
  | "INFORMACION"
  | "ALERTA"
  | "CITA_CREADA"
  | "CITA_RECORDATORIO"
  | "CITA_REAGENDADA"
  | "CITA_CANCELADA";
export type CommunicationsPriority = "NORMAL" | "ALERTA";
export type CommunicationsMessageStatus =
  | "DRAFT"
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";
export type CommunicationsDeliveryStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "UNDELIVERABLE"
  | "OPTED_OUT";

export interface CommunicationsRecipientsInput {
  all_staff: boolean;
  roles: Role[];
  user_ids: number[];
}

export interface CommunicationsMessage {
  id: number;
  channel: CommunicationsChannel;
  audience: CommunicationsAudience;
  kind: CommunicationsKind;
  priority: CommunicationsPriority;
  subject: string;
  body: string;
  template: number | null;
  created_by: number | null;
  created_by_name: string;
  scheduled_for: string | null;
  status: CommunicationsMessageStatus;
  recipient_count: number;
  appointment: number | null;
  created_at: string;
  skipped_no_email?: number;
}

export interface CommunicationsMessageCreate {
  channel: CommunicationsChannel;
  audience: "STAFF";
  kind: CommunicationsKind;
  priority: CommunicationsPriority;
  subject: string;
  body: string;
  scheduled_for?: string | null;
  status: "DRAFT" | "QUEUED";
  recipients: CommunicationsRecipientsInput;
}

export interface CommunicationsDelivery {
  id: number;
  message: number;
  user: number | null;
  user_name: string | null;
  patient: number | null;
  patient_name: string | null;
  appointment: number | null;
  appointment_date: string | null;
  address_masked: string;
  status: CommunicationsDeliveryStatus;
  error: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CommunicationsTemplate {
  id: number;
  channel: CommunicationsChannel;
  kind: CommunicationsKind;
  provider_name: string;
  language: string;
  body_email: string;
  variables_json: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationsSettings {
  from_name: string;
  reply_to: string;
  whatsapp_phone_number_id: string;
  whatsapp_business_account_id: string;
  whatsapp_access_token?: string;
  whatsapp_access_token_last4: string;
  whatsapp_app_secret?: string;
  whatsapp_app_secret_last4: string;
  whatsapp_default_country_code: string;
  whatsapp_reminder_hours: number;
  whatsapp_master_enabled: boolean;
  whatsapp_configured: boolean;
  webhook_url: string;
  updated_at: string;
}
