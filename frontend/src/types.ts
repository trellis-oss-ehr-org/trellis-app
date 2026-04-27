/* WebSocket message types matching relay protocol */

interface WsAuthMessage {
  type: "auth";
  token: string;
  sessionType: "intake" | "journal";
  clientId: string;
  intakeMode: "standard" | "iop";
}

interface WsReadyMessage {
  type: "ready";
  sessionId: string;
}

interface WsTranscriptMessage {
  type: "transcript";
  text: string;
}

interface WsTurnCompleteMessage {
  type: "turn_complete";
}

interface WsInterviewEndedMessage {
  type: "interview_ended";
}

interface WsCompleteMessage {
  type: "complete";
  sessionId: string;
  result: Record<string, unknown>;
}

interface WsErrorMessage {
  type: "error";
  message: string;
}

interface WsEndMessage {
  type: "end";
}

export type WsClientMessage = WsAuthMessage | WsEndMessage;

export type WsServerMessage =
  | WsReadyMessage
  | WsTranscriptMessage
  | WsTurnCompleteMessage
  | WsInterviewEndedMessage
  | WsCompleteMessage
  | WsErrorMessage;

/* Scheduling types */

export interface AvailabilityWindow {
  id?: string;
  day_of_week: number; // 0=Sun
  start_time: string;  // "HH:MM"
  end_time: string;
  is_active?: boolean;
}

export interface TimeSlot {
  start: string; // ISO datetime
  end: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  client_email: string;
  client_name: string;
  clinician_id: string;
  clinician_email: string;
  type: "assessment" | "individual" | "individual_extended";
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "released";
  meet_link: string | null;
  calendar_event_id: string | null;
  recurrence_id: string | null;
  encounter_id: string | null;
  created_by: string;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
}

/* Group practice types */

export type PracticeType = "solo" | "group";
export type PracticeRole = "owner" | "clinician";
type ClinicianStatus = "active" | "invited" | "deactivated";

export interface Clinician {
  id: string;
  practice_id: string;
  firebase_uid: string;
  email: string;
  clinician_name: string | null;
  credentials: string | null;
  license_number: string | null;
  license_state: string | null;
  npi: string | null;
  specialties: string[] | null;
  bio: string | null;
  session_rate: number | null;
  intake_rate: number | null;
  sliding_scale: boolean | null;
  sliding_scale_min: number | null;
  default_session_duration: number | null;
  intake_duration: number | null;
  practice_role: PracticeRole;
  status: ClinicianStatus;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

/* Client profile */

export interface ClientProfile {
  exists: boolean;
  id?: string;
  firebase_uid?: string;
  email?: string;
  full_name?: string | null;
  preferred_name?: string | null;
  pronouns?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  payer_name?: string | null;
  member_id?: string | null;
  group_number?: string | null;
  insurance_data?: InsuranceExtraction | null;
  status?: "active" | "discharged" | "inactive";
  discharged_at?: string | null;
  intake_completed_at?: string | null;
  documents_completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/* Practice profile */

export interface PracticeProfile {
  exists: boolean;
  id?: string;
  clinician_uid?: string;
  practice_name?: string | null;
  clinician_name?: string | null;
  credentials?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  npi?: string | null;
  tax_id?: string | null;
  specialties?: string[] | null;
  bio?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  cash_only?: boolean | null;
  booking_enabled?: boolean | null;
  require_client_invite?: boolean | null;
  accepted_insurances?: string[] | null;
  session_rate?: number | null;
  intake_rate?: number | null;
  sliding_scale?: boolean | null;
  sliding_scale_min?: number | null;
  default_session_duration?: number | null;
  intake_duration?: number | null;
  timezone?: string | null;
  /* Group practice fields */
  practice_id?: string | null;
  practice_type?: PracticeType | null;
  practice_role?: PracticeRole | null;
}

/* Hosted text reminder connection */

export interface TextingStatus {
  configured: boolean;
  install_id: string;
  account_id: string | null;
  status: string;
  baa_status: string;
  shared_number_attestation_status: string;
  subscription_status: string;
  telnyx_status: string;
  credential_key_prefix: string | null;
  last_error: string | null;
  last_synced_at: string | null;
  texting_enabled: boolean;
}

/* Client list item (from GET /api/clients) */

export interface ClientListItem {
  id: string;
  firebase_uid: string;
  email: string;
  full_name: string | null;
  preferred_name: string | null;
  phone: string | null;
  payer_name: string | null;
  status: "active" | "discharged" | "inactive";
  intake_completed_at: string | null;
  created_at: string;
  next_appointment: string | null;
  last_session: string | null;
  docs_total: number;
  docs_signed: number;
  primary_clinician_id: string | null;
}

export interface InsuranceExtraction {
  payer_name: string | null;
  plan_name: string | null;
  member_id: string | null;
  group_number: string | null;
  plan_type: string | null;
  subscriber_name: string | null;
  rx_bin: string | null;
  rx_pcn: string | null;
  rx_group: string | null;
  payer_phone: string | null;
  effective_date: string | null;
  copay_info: string | null;
}
