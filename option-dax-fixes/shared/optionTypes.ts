/**
 * Option Types - Shared type definitions for option trading structures
 */

import { z } from 'zod';

// ============================================================================
// OPTION LEG SCHEMA AND TYPE
// ============================================================================

/**
 * Zod schema for validating option leg data
 * This replaces z.any() with proper validation
 */
export const optionLegSchema = z.object({
  // Core leg properties
  optionType: z.enum(['Call', 'Put', 'call', 'put']),
  strike: z.number().positive('Strike must be positive'),
  expiryDate: z.string().min(1, 'Expiry date is required'), // ISO date string
  quantity: z.number().int('Quantity must be an integer'),
  tradePrice: z.number().min(0, 'Trade price cannot be negative'),
  impliedVolatility: z.number().min(0, 'IV cannot be negative').max(500, 'IV seems unreasonably high'),

  // Commission fields (optional)
  openingCommission: z.number().min(0).optional().default(2),
  closingCommission: z.number().min(0).optional().default(2),

  // Closing fields (optional - only present when leg is closed)
  closingPrice: z.number().min(0).optional().nullable(),
  closingDate: z.string().optional().nullable(),

  // Optional metadata
  notes: z.string().optional(),
  id: z.string().optional(), // Unique identifier for the leg
});

/**
 * Type inferred from the Zod schema
 */
export type OptionLeg = z.infer<typeof optionLegSchema>;

/**
 * Schema for an array of option legs
 */
export const optionLegsArraySchema = z.array(optionLegSchema).min(1, 'At least one leg is required');

// ============================================================================
// STRUCTURE INPUT SCHEMAS
// ============================================================================

/**
 * Schema for creating a new structure
 */
export const createStructureSchema = z.object({
  tag: z.string().min(1, 'Tag is required').max(100, 'Tag too long'),
  multiplier: z.number().int().positive().default(5),
  legsPerContract: z.number().int().positive().default(2),
  legs: optionLegsArraySchema,
  status: z.enum(['active', 'closed']).default('active'),
  openPnl: z.string().optional(),
  pdc: z.string().optional(),
  delta: z.string().optional(),
  gamma: z.string().optional(),
  theta: z.string().optional(),
  vega: z.string().optional(),
  closingDate: z.string().optional(),
  realizedPnl: z.string().optional(),
  isPublic: z.number().int().min(0).max(1).default(0).optional(),
  isTemplate: z.number().int().min(0).max(1).default(0).optional(),
  originalStructureId: z.number().int().positive().optional(),
});

export type CreateStructureInput = z.infer<typeof createStructureSchema>;

/**
 * Schema for updating an existing structure
 */
export const updateStructureSchema = z.object({
  id: z.number().int().positive(),
  tag: z.string().min(1).max(100).optional(),
  multiplier: z.number().int().positive().optional(),
  legsPerContract: z.number().int().positive().optional(),
  legs: optionLegsArraySchema.optional(),
  status: z.enum(['active', 'closed']).optional(),
  openPnl: z.string().optional(),
  pdc: z.string().optional(),
  delta: z.string().optional(),
  gamma: z.string().optional(),
  theta: z.string().optional(),
  vega: z.string().optional(),
  closingDate: z.string().optional(),
  realizedPnl: z.string().optional(),
});

export type UpdateStructureInput = z.infer<typeof updateStructureSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default commission per contract (in currency units)
 */
export const DEFAULT_COMMISSION = 2;

/**
 * Available product multipliers
 */
export const MULTIPLIERS = {
  CFD: 1,
  MICRO_FUTURE: 5,
  FUTURE: 25,
} as const;

export type MultiplierType = typeof MULTIPLIERS[keyof typeof MULTIPLIERS];
