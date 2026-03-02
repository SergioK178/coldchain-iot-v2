export const DEVICE_TYPES = {
  TH: { label: 'Temperature + Humidity', capabilities: ['temperature_c', 'humidity_pct'] },
  TP: { label: 'Temperature Probe',     capabilities: ['temperature_c'] },
  T:  { label: 'Temperature Only',      capabilities: ['temperature_c'] },
  HM: { label: 'Humidity Only',         capabilities: ['humidity_pct'] },
} as const;

export type DeviceTypeCode = keyof typeof DEVICE_TYPES;

export function parseSerial(serial: string): { type: DeviceTypeCode; number: string } {
  const match = serial.match(/^SENS-([A-Z]{1,2})-(\d{5})$/);
  if (!match) throw new Error(`Invalid serial format: ${serial}`);
  const type = match[1] as DeviceTypeCode;
  if (!(type in DEVICE_TYPES)) throw new Error(`Unknown device type: ${type}`);
  return { type, number: match[2] };
}
