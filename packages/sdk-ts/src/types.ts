// ── API envelope ──────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  /** refreshToken is delivered as HTTP-only cookie */
  expiresIn: number;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'operator';

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
}

export interface PatchUserRequest {
  email?: string;
  role?: UserRole;
}

// ── Devices ───────────────────────────────────────────────────────────────────

export type PowerSource = 'battery' | 'wired';
export type ConnectivityStatus = 'online' | 'offline';
export type AlertStatus = 'normal' | 'alert';

export interface DeviceResponse {
  serial: string;
  deviceType: string;
  displayName: string | null;
  zoneName: string | null;
  locationName: string | null;
  powerSource: PowerSource;
  lastSeenAt: string | null;
  lastTemperatureC: number | null;
  lastHumidityPct: number | null;
  lastBatteryPct: number | null;
  connectivityStatus: ConnectivityStatus;
  alertStatus: AlertStatus;
  provisionedAt: string;
}

export interface ProvisionRequest {
  /** Format: SENS-XX-NNNNN, e.g. SENS-TH-00001 */
  serial: string;
  displayName?: string;
  powerSource: PowerSource;
  zoneId?: string;
  calibrationOffsetC?: number;
}

export interface MqttCredentials {
  username: string;
  password: string;
  topic: string;
  statusTopic: string;
}

export interface ProvisionResponse {
  serial: string;
  deviceType: string;
  mqtt: MqttCredentials;
}

export interface PatchDeviceRequest {
  displayName?: string;
  /** Pass null to unassign from zone */
  zoneId?: string | null;
  calibrationOffsetC?: number;
}

// ── Readings ──────────────────────────────────────────────────────────────────

export interface ReadingRecord {
  recordedAt: string;
  temperatureC: number | null;
  humidityPct: number | null;
  batteryPct: number | null;
}

export interface ReadingsPage {
  data: ReadingRecord[];
  cursor: string | null;
}

export interface ReadingsQuery {
  limit?: number;
  cursor?: string;
  since?: string;
  until?: string;
}

// ── Locations & Zones ─────────────────────────────────────────────────────────

export interface LocationResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface ZoneResponse {
  id: string;
  locationId: string;
  name: string;
  createdAt: string;
}

export interface CreateLocationRequest {
  name: string;
}

export interface CreateZoneRequest {
  name: string;
}

// ── Alert rules ───────────────────────────────────────────────────────────────

export type AlertMetric = 'temperature_c' | 'humidity_pct';
export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte';

export interface AlertRuleResponse {
  id: string;
  deviceSerial: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAlertRuleRequest {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  cooldownMinutes?: number;
}

export interface PatchAlertRuleRequest {
  threshold?: number;
  operator?: AlertOperator;
  isActive?: boolean;
  cooldownMinutes?: number;
}

// ── Alert events ──────────────────────────────────────────────────────────────

export interface AlertEventResponse {
  id: string;
  deviceSerial: string;
  deviceName: string | null;
  metric: string;
  operator: string;
  readingValue: number;
  thresholdValue: number;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface AcknowledgeRequest {
  acknowledgedBy: string;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'alert.triggered'
  | 'alert.acknowledged'
  | 'device.offline'
  | 'device.online';

export interface WebhookResponse {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateWebhookRequest {
  url: string;
  /** HMAC-SHA256 signing secret */
  secret: string;
  events: WebhookEvent[];
}

export interface PatchWebhookRequest {
  url?: string;
  secret?: string;
  events?: WebhookEvent[];
  isActive?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  attemptCount: number;
  deliveredAt: string | null;
  failedAt: string | null;
}

// ── Calibrations ──────────────────────────────────────────────────────────────

export interface CalibrationResponse {
  id: string;
  deviceSerial: string;
  offsetC: number;
  note: string | null;
  appliedAt: string;
  appliedBy: string;
}

export interface CreateCalibrationRequest {
  offsetC: number;
  note?: string;
}

// ── Export ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv';

export interface ExportQuery {
  deviceSerial?: string;
  locationId?: string;
  since: string;
  until: string;
  format?: ExportFormat;
}

// ── SDK options ───────────────────────────────────────────────────────────────

export type AuthMode =
  | { type: 'jwt'; accessToken: string }
  | { type: 'token'; apiToken: string };

export interface ColdChainClientOptions {
  /** Base URL of the ColdChain API, e.g. https://api.example.com */
  baseUrl: string;
  auth: AuthMode;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}
