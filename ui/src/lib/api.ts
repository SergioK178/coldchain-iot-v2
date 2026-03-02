const API_BASE = `${window.location.origin}/api/v1`;

function getToken(): string | null {
  return sessionStorage.getItem('apiToken');
}

export function setToken(token: string) {
  sessionStorage.setItem('apiToken', token);
}

export function clearToken() {
  sessionStorage.removeItem('apiToken');
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error?.message ?? 'Unknown error');
  }
  return json.data as T;
}

export interface Device {
  serial: string;
  deviceType: string;
  displayName: string | null;
  zoneName: string | null;
  locationName: string | null;
  powerSource: string;
  lastSeenAt: string | null;
  lastTemperatureC: number | null;
  lastHumidityPct: number | null;
  lastBatteryPct: number | null;
  connectivityStatus: 'online' | 'offline';
  alertStatus: 'normal' | 'alert';
  provisionedAt: string;
}

export interface AlertEvent {
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

export function fetchDevices(): Promise<Device[]> {
  return apiFetch('/devices');
}

export function fetchUnacknowledgedAlerts(): Promise<AlertEvent[]> {
  return apiFetch('/alert-events?acknowledged=false');
}

export function acknowledgeAlert(id: string, acknowledgedBy: string): Promise<void> {
  return apiFetch(`/alert-events/${id}/acknowledge`, {
    method: 'PATCH',
    body: JSON.stringify({ acknowledgedBy }),
  });
}
