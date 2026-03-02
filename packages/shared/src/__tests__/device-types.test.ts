import { describe, it, expect } from 'vitest';
import { parseSerial } from '../constants/device-types.js';

describe('parseSerial', () => {
  it('parses valid TH serial', () => {
    expect(parseSerial('SENS-TH-00042')).toEqual({ type: 'TH', number: '00042' });
  });

  it('parses valid TP serial', () => {
    expect(parseSerial('SENS-TP-00007')).toEqual({ type: 'TP', number: '00007' });
  });

  it('parses valid T serial', () => {
    expect(parseSerial('SENS-T-00001')).toEqual({ type: 'T', number: '00001' });
  });

  it('parses valid HM serial', () => {
    expect(parseSerial('SENS-HM-99999')).toEqual({ type: 'HM', number: '99999' });
  });

  it('throws on invalid format', () => {
    expect(() => parseSerial('INVALID')).toThrow('Invalid serial format');
  });

  it('throws on wrong prefix', () => {
    expect(() => parseSerial('DEV-TH-00001')).toThrow('Invalid serial format');
  });

  it('throws on too few digits', () => {
    expect(() => parseSerial('SENS-TH-001')).toThrow('Invalid serial format');
  });

  it('throws on unknown device type', () => {
    expect(() => parseSerial('SENS-XX-00001')).toThrow('Unknown device type');
  });

  it('throws on lowercase type', () => {
    expect(() => parseSerial('SENS-th-00001')).toThrow('Invalid serial format');
  });
});
