import type {
  ColdChainClientOptions,
  ApiSuccess,
  LoginRequest,
  TokenPair,
  UserResponse,
  CreateUserRequest,
  PatchUserRequest,
  DeviceResponse,
  ProvisionRequest,
  ProvisionResponse,
  PatchDeviceRequest,
  ReadingsPage,
  ReadingsQuery,
  ReadingRecord,
  LocationResponse,
  ZoneResponse,
  CreateLocationRequest,
  CreateZoneRequest,
  AlertRuleResponse,
  CreateAlertRuleRequest,
  PatchAlertRuleRequest,
  AlertEventResponse,
  AcknowledgeRequest,
  WebhookResponse,
  CreateWebhookRequest,
  PatchWebhookRequest,
  WebhookDelivery,
  CalibrationResponse,
  CreateCalibrationRequest,
  ExportQuery,
  MqttCredentials,
} from './types.js';

export class ColdChainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ColdChainError';
  }
}

export class ColdChainClient {
  private readonly baseUrl: string;
  private readonly options: ColdChainClientOptions;

  constructor(options: ColdChainClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private authHeader(): string {
    const { auth } = this.options;
    return auth.type === 'jwt'
      ? `Bearer ${auth.accessToken}`
      : `Bearer ${auth.apiToken}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    rawResponse = false,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 30_000,
    );

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader(),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (rawResponse) {
      return response as unknown as T;
    }

    const json = (await response.json()) as ApiSuccess<T> | { ok: false; error: { code: string; message: string } };

    if (!json.ok) {
      throw new ColdChainError(json.error.code, json.error.message, response.status);
    }

    return (json as ApiSuccess<T>).data;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  /** Authenticate without a pre-existing token (returns a new client with JWT set) */
  static async login(
    baseUrl: string,
    credentials: LoginRequest,
  ): Promise<{ client: ColdChainClient; tokens: TokenPair }> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/auth/login`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const json = await resp.json() as ApiSuccess<TokenPair> | { ok: false; error: { code: string; message: string } };
    if (!json.ok) {
      throw new ColdChainError(json.error.code, json.error.message, resp.status);
    }
    const tokens = (json as ApiSuccess<TokenPair>).data;
    const client = new ColdChainClient({
      baseUrl,
      auth: { type: 'jwt', accessToken: tokens.accessToken },
    });
    return { client, tokens };
  }

  async logout(): Promise<void> {
    await this.request<void>('POST', '/api/v1/auth/logout');
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async getMe(): Promise<UserResponse> {
    return this.request('GET', '/api/v1/users/me');
  }

  async listUsers(): Promise<UserResponse[]> {
    return this.request('GET', '/api/v1/users');
  }

  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    return this.request('POST', '/api/v1/users', data);
  }

  async patchUser(id: string, data: PatchUserRequest): Promise<UserResponse> {
    return this.request('PATCH', `/api/v1/users/${id}`, data);
  }

  async deleteUser(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/users/${id}`);
  }

  // ── Devices ────────────────────────────────────────────────────────────────

  async listDevices(): Promise<DeviceResponse[]> {
    return this.request('GET', '/api/v1/devices');
  }

  async getDevice(serial: string): Promise<DeviceResponse> {
    return this.request('GET', `/api/v1/devices/${serial}`);
  }

  async provisionDevice(data: ProvisionRequest): Promise<ProvisionResponse> {
    return this.request('POST', '/api/v1/devices/provision', data);
  }

  async patchDevice(serial: string, data: PatchDeviceRequest): Promise<DeviceResponse> {
    return this.request('PATCH', `/api/v1/devices/${serial}`, data);
  }

  async decommissionDevice(serial: string): Promise<{ serial: string }> {
    return this.request('DELETE', `/api/v1/devices/${serial}`);
  }

  /** Rotate MQTT credentials. New plaintext password returned once — store securely. */
  async rotateDeviceMqtt(serial: string): Promise<MqttCredentials> {
    return this.request('POST', `/api/v1/devices/${serial}/rotate-mqtt`);
  }

  // ── Readings ───────────────────────────────────────────────────────────────

  async getReadings(serial: string, query?: ReadingsQuery): Promise<ReadingsPage> {
    const params = new URLSearchParams();
    if (query?.limit !== undefined) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    if (query?.since) params.set('since', query.since);
    if (query?.until) params.set('until', query.until);
    const qs = params.toString() ? `?${params}` : '';
    const raw = await this.request<{ data: ReadingRecord[]; cursor: string | null }>(
      'GET',
      `/api/v1/devices/${serial}/readings${qs}`,
    );
    return raw;
  }

  /** Iterate all readings across pages automatically */
  async *readingsIterator(
    serial: string,
    query?: Omit<ReadingsQuery, 'cursor'>,
  ): AsyncGenerator<ReadingRecord> {
    let cursor: string | null | undefined;
    do {
      const page = await this.getReadings(serial, { ...query, cursor: cursor ?? undefined });
      for (const record of page.data) {
        yield record;
      }
      cursor = page.cursor;
    } while (cursor);
  }

  // ── Locations & Zones ──────────────────────────────────────────────────────

  async listLocations(): Promise<LocationResponse[]> {
    return this.request('GET', '/api/v1/locations');
  }

  async createLocation(data: CreateLocationRequest): Promise<LocationResponse> {
    return this.request('POST', '/api/v1/locations', data);
  }

  async patchLocation(id: string, data: CreateLocationRequest): Promise<LocationResponse> {
    return this.request('PATCH', `/api/v1/locations/${id}`, data);
  }

  async deleteLocation(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/locations/${id}`);
  }

  async listZones(locationId: string): Promise<ZoneResponse[]> {
    return this.request('GET', `/api/v1/locations/${locationId}/zones`);
  }

  async createZone(locationId: string, data: CreateZoneRequest): Promise<ZoneResponse> {
    return this.request('POST', `/api/v1/locations/${locationId}/zones`, data);
  }

  async patchZone(zoneId: string, data: CreateZoneRequest): Promise<ZoneResponse> {
    return this.request('PATCH', `/api/v1/zones/${zoneId}`, data);
  }

  async deleteZone(zoneId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/zones/${zoneId}`);
  }

  // ── Alert Rules ────────────────────────────────────────────────────────────

  async listAlertRules(serial: string): Promise<AlertRuleResponse[]> {
    return this.request('GET', `/api/v1/devices/${serial}/alert-rules`);
  }

  async createAlertRule(
    serial: string,
    data: CreateAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    return this.request('POST', `/api/v1/devices/${serial}/alert-rules`, data);
  }

  async patchAlertRule(
    serial: string,
    ruleId: string,
    data: PatchAlertRuleRequest,
  ): Promise<AlertRuleResponse> {
    return this.request('PATCH', `/api/v1/devices/${serial}/alert-rules/${ruleId}`, data);
  }

  async deleteAlertRule(serial: string, ruleId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/devices/${serial}/alert-rules/${ruleId}`);
  }

  // ── Alert Events ───────────────────────────────────────────────────────────

  async listAlertEvents(serial?: string): Promise<AlertEventResponse[]> {
    const path = serial
      ? `/api/v1/devices/${serial}/alert-events`
      : '/api/v1/alert-events';
    return this.request('GET', path);
  }

  async acknowledgeAlertEvent(
    eventId: string,
    data: AcknowledgeRequest,
  ): Promise<AlertEventResponse> {
    return this.request('POST', `/api/v1/alert-events/${eventId}/acknowledge`, data);
  }

  // ── Calibrations ───────────────────────────────────────────────────────────

  async listCalibrations(serial: string): Promise<CalibrationResponse[]> {
    return this.request('GET', `/api/v1/devices/${serial}/calibrations`);
  }

  async createCalibration(
    serial: string,
    data: CreateCalibrationRequest,
  ): Promise<CalibrationResponse> {
    return this.request('POST', `/api/v1/devices/${serial}/calibrations`, data);
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  async listWebhooks(): Promise<WebhookResponse[]> {
    return this.request('GET', '/api/v1/webhooks');
  }

  async createWebhook(data: CreateWebhookRequest): Promise<WebhookResponse> {
    return this.request('POST', '/api/v1/webhooks', data);
  }

  async patchWebhook(id: string, data: PatchWebhookRequest): Promise<WebhookResponse> {
    return this.request('PATCH', `/api/v1/webhooks/${id}`, data);
  }

  async deleteWebhook(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/webhooks/${id}`);
  }

  async listWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
    return this.request('GET', `/api/v1/webhooks/${id}/deliveries`);
  }

  async testWebhook(id: string): Promise<{ delivered: boolean }> {
    return this.request('POST', `/api/v1/webhooks/${id}/test`);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  /** Returns raw Response — pipe to file or stream as needed */
  async exportReadings(query: ExportQuery): Promise<Response> {
    const params = new URLSearchParams();
    if (query.deviceSerial) params.set('deviceSerial', query.deviceSerial);
    if (query.locationId) params.set('locationId', query.locationId);
    params.set('since', query.since);
    params.set('until', query.until);
    params.set('format', query.format ?? 'csv');
    return this.request<Response>('GET', `/api/v1/export/readings?${params}`, undefined, true);
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async health(): Promise<{ version: string; uptime: number }> {
    const resp = await fetch(`${this.baseUrl}/api/v1/health`);
    const json = await resp.json() as ApiSuccess<{ version: string; uptime: number }>;
    return json.data;
  }
}
