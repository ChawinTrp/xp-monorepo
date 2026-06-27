import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../src/validation.js';

describe('validateMetadata', () => {
  it('accepts valid TASK metadata', () => {
    const md = { dueDate: '2026-06-30', priority: 'HIGH', estimatedHours: 3 };
    expect(validateMetadata('TASK', md)).toEqual(md);
  });

  it('rejects TASK estimatedHours of wrong type', () => {
    expect(() => validateMetadata('TASK', { estimatedHours: 'three' })).toThrow(/estimatedHours/);
  });

  it('accepts valid PERSON metadata', () => {
    const md = { email: 'a@b.com', phone: '123' };
    expect(validateMetadata('PERSON', md)).toEqual(md);
  });

  it('passes through unknown extra keys (forward-compatible)', () => {
    const md = { dueDate: '2026-06-30', somethingNew: true };
    expect(validateMetadata('TASK', md)).toEqual(md);
  });

  it('returns undefined when metadata is undefined', () => {
    expect(validateMetadata('TASK', undefined)).toBeUndefined();
  });
});
