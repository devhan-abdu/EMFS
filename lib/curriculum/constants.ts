import { PACE_GROUP_SIZE_PRESETS } from '@/lib/validations/pace-group';

/**
 * Internal curriculum pagination step unit in pages.
 * Note: Internal calculation math only; must not be rendered into user-facing UI copy.
 */
export const PAGE_UNIT = 5;

/**
 * Supported pace group size presets [5, 10, 20, 40] pages/day.
 * Reused directly from the canonical pace group validations.
 */
export const PACE_SIZES = PACE_GROUP_SIZE_PRESETS;

/**
 * Standard product reference timezone for all cohort scheduling and daily task calculation.
 */
export const PRODUCT_TIMEZONE = 'Africa/Addis_Ababa';
