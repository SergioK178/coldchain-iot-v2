import { describe, it, expect } from 'vitest';
import { DevicePayloadSchema } from '../schemas/payload.js';

describe('DevicePayloadSchema', () => {
  const validTH = {
    v: 1,
    id: 'SENS-TH-00042',
    ts: 1752588600,
    mid: 'a1b2c3d4',
    t: -18.3,
    h: 45.2,
    bat: 87,
    rssi: -67,
    fw: '0.1.3',
  };

  const validTP = {
    v: 1,
    id: 'SENS-TP-00007',
    ts: 1752588600,
    mid: 'e5f6a7b8',
    t: 4.1,
    rssi: -52,
    fw: '0.2.0',
    up: 86400,
  };

  it('parses valid TH payload', () => {
    const result = DevicePayloadSchema.parse(validTH);
    expect(result.t).toBe(-18.3);
    expect(result.h).toBe(45.2);
  });

  it('parses valid TP payload (no humidity)', () => {
    const result = DevicePayloadSchema.parse(validTP);
    expect(result.t).toBe(4.1);
    expect(result.h).toBeUndefined();
  });

  it('parses minimal payload', () => {
    const result = DevicePayloadSchema.parse({
      v: 1,
      id: 'SENS-T-00001',
      ts: 1000000000,
      mid: '1',
    });
    expect(result.v).toBe(1);
  });

  it('rejects wrong version', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, v: 2 })).toThrow();
  });

  it('rejects invalid serial in id', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, id: 'INVALID' })).toThrow();
  });

  it('rejects negative timestamp', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, ts: -1 })).toThrow();
  });

  it('rejects empty mid', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, mid: '' })).toThrow();
  });

  it('rejects temperature out of range', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, t: 200 })).toThrow();
    expect(() => DevicePayloadSchema.parse({ ...validTH, t: -60 })).toThrow();
  });

  it('rejects humidity out of range', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, h: 101 })).toThrow();
    expect(() => DevicePayloadSchema.parse({ ...validTH, h: -1 })).toThrow();
  });

  it('rejects battery out of range', () => {
    expect(() => DevicePayloadSchema.parse({ ...validTH, bat: 101 })).toThrow();
  });
});
