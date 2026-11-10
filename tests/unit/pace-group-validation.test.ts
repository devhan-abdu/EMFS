import { describe, expect, it } from 'vitest';
import {
  createPaceGroupSchema,
  updatePaceGroupSchema,
} from '@/lib/validations/pace-group';

const batchId = '11111111-1111-4111-8111-111111111111';
const paceGroupId = '22222222-2222-4222-8222-222222222222';

describe('pace group page-range validation', () => {
  it('accepts a valid min/max page range', () => {
    expect(
      createPaceGroupSchema.parse({
        batchId,
        name: 'Group Alpha',
        min_pages: '7',
        max_pages: '15',
      }),
    ).toMatchObject({
      min_pages: 7,
      max_pages: 15,
    });
  });

  it('rejects a minimum greater than the maximum', () => {
    expect(
      createPaceGroupSchema.safeParse({
        batchId,
        name: 'Group Alpha',
        min_pages: 20,
        max_pages: 10,
      }).success,
    ).toBe(false);
  });

  it('accepts a maximum that is not one of the former presets', () => {
    expect(
      createPaceGroupSchema.safeParse({
        batchId,
        name: 'Group Alpha',
        min_pages: 20,
        max_pages: 25,
      }).success,
    ).toBe(true);
  });

  it('validates a provided min/max pair on updates', () => {
    expect(
      updatePaceGroupSchema.safeParse({
        paceGroupId,
        min_pages: 15,
        max_pages: 20,
      }).success,
    ).toBe(true);
    expect(
      updatePaceGroupSchema.safeParse({
        paceGroupId,
        min_pages: 20,
        max_pages: 10,
      }).success,
    ).toBe(false);
  });
});
