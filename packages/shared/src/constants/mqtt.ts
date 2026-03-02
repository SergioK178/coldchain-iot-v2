export const MQTT = {
  telemetry: (serial: string) => `d/${serial}/t` as const,
  status:    (serial: string) => `d/${serial}/s` as const,

  sub: {
    allTelemetry: 'd/+/t' as const,
    allStatus:    'd/+/s' as const,
  },
} as const;
