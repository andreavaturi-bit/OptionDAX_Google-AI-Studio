import { z } from 'zod';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { protectedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { structures, users, InsertStructure } from '../../drizzle/schema';
import {
  calculateBlackScholes,
  percentToDecimal,
  getTimeToExpiry,
  MIN_TIME_TO_EXPIRY,
} from '../../shared/blackScholes';
import {
  optionLegSchema,
  optionLegsArraySchema,
  DEFAULT_COMMISSION,
  type OptionLeg,
} from '../../shared/optionTypes';

/**
 * Router per gestione strutture Option DAX
 * Implementa logica di visibilità:
 * - Utenti vedono: proprie strutture + strutture admin
 * - Admin vedono: proprie strutture + strutture altri admin (non utenti di default)
 */
export const optionStructuresRouter = router({
  /**
   * Get all structures visible to current user
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'closed', 'all']).default('all'),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const currentUser = ctx.user;
      const isAdmin = currentUser.role === 'admin';

      // Base query - show only structures owned by current user
      const conditions = [eq(structures.userId, currentUser.id)];

      // Filter by status
      if (input.status !== 'all') {
        conditions.push(eq(structures.status, input.status));
      }

      const results = await db.select().from(structures).where(and(...conditions));

      // Parse JSON fields
      return results.map(s => ({
        ...s,
        legs: JSON.parse(s.legs),
        sharedWith: s.sharedWith ? JSON.parse(s.sharedWith) : [],
        status: s.status as 'active' | 'closed',
      }));
    }),

  /**
   * Get single structure by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const [structure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.id))
        .limit(1);

      if (!structure) {
        throw new Error('Structure not found');
      }

      // Check visibility
      const currentUser = ctx.user;
      const isOwner = structure.userId === currentUser.id;
      const sharedWith = structure.sharedWith ? JSON.parse(structure.sharedWith) : [];
      const isSharedWithUser = sharedWith.includes(currentUser.id);

      // Get structure owner
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, structure.userId))
        .limit(1);

      const isOwnerAdmin = owner?.role === 'admin';
      const isCurrentUserAdmin = currentUser.role === 'admin';

      // Visibility logic
      const canView =
        isOwner ||
        isSharedWithUser ||
        (isOwnerAdmin && !isCurrentUserAdmin) || // Users can see admin structures
        (isOwnerAdmin && isCurrentUserAdmin); // Admins can see other admin structures

      if (!canView) {
        throw new Error('Access denied');
      }

      return {
        ...structure,
        legs: JSON.parse(structure.legs),
        sharedWith,
      };
    }),

  /**
   * Create new structure
   */
  create: protectedProcedure
    .input(
      z.object({
        tag: z.string().min(1).max(100),
        multiplier: z.number().int().positive().default(5),
        legsPerContract: z.number().int().positive().default(2),
        legs: optionLegsArraySchema, // Properly validated OptionLeg[]
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      // NOTE: Sensitive data logging removed for security
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const newStructure: InsertStructure = {
        userId: ctx.user.id,
        tag: input.tag,
        multiplier: input.multiplier,
        legsPerContract: input.legsPerContract,
        legs: JSON.stringify(input.legs),
        status: input.status,
        openPnl: input.openPnl,
        pdc: input.pdc,
        delta: input.delta,
        gamma: input.gamma,
        theta: input.theta,
        vega: input.vega,
        closingDate: input.closingDate,
        realizedPnl: input.realizedPnl,
        sharedWith: null,
        isPublic: input.isPublic ?? 0,
        isTemplate: input.isTemplate ?? 0,
        originalStructureId: input.originalStructureId,
      };

      const [result] = await db.insert(structures).values(newStructure);
      
      // Recupera la struttura appena creata dal database
      const [createdStructure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, result.insertId));
      
      if (!createdStructure) {
        throw new Error('Failed to retrieve created structure');
      }
      
      // Restituisci la struttura completa come fa list()
      return {
        id: createdStructure.id,
        userId: createdStructure.userId,
        tag: createdStructure.tag,
        multiplier: createdStructure.multiplier,
        legsPerContract: createdStructure.legsPerContract,
        legs: JSON.parse(createdStructure.legs),
        status: createdStructure.status,
        openPnl: createdStructure.openPnl,
        pdc: createdStructure.pdc,
        delta: createdStructure.delta,
        gamma: createdStructure.gamma,
        theta: createdStructure.theta,
        vega: createdStructure.vega,
        closingDate: createdStructure.closingDate,
        realizedPnl: createdStructure.realizedPnl,
        sharedWith: createdStructure.sharedWith ? createdStructure.sharedWith.split(',') : [],
      };
    }),

  /**
   * Update existing structure
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        tag: z.string().min(1).max(100).optional(),
        multiplier: z.number().int().positive().optional(),
        legsPerContract: z.number().int().positive().optional(),
        legs: optionLegsArraySchema.optional(), // Properly validated OptionLeg[]
        status: z.enum(['active', 'closed']).optional(),
        openPnl: z.string().optional(),
        pdc: z.string().optional(),
        delta: z.string().optional(),
        gamma: z.string().optional(),
        theta: z.string().optional(),
        vega: z.string().optional(),
        closingDate: z.string().optional(),
        realizedPnl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check ownership
      const [existing] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.id))
        .limit(1);

      if (!existing) {
        throw new Error('Structure not found');
      }

      if (existing.userId !== ctx.user.id) {
        throw new Error('Access denied: You can only update your own structures');
      }

      const updates: Partial<InsertStructure> = {};
      if (input.tag !== undefined) updates.tag = input.tag;
      if (input.multiplier !== undefined) updates.multiplier = input.multiplier;
      if (input.legsPerContract !== undefined) updates.legsPerContract = input.legsPerContract;
      if (input.legs !== undefined) updates.legs = JSON.stringify(input.legs);
      if (input.status !== undefined) updates.status = input.status;
      if (input.openPnl !== undefined) updates.openPnl = input.openPnl;
      if (input.pdc !== undefined) updates.pdc = input.pdc;
      if (input.delta !== undefined) updates.delta = input.delta;
      if (input.gamma !== undefined) updates.gamma = input.gamma;
      if (input.theta !== undefined) updates.theta = input.theta;
      if (input.vega !== undefined) updates.vega = input.vega;
      if (input.closingDate !== undefined) updates.closingDate = input.closingDate;
      if (input.realizedPnl !== undefined) updates.realizedPnl = input.realizedPnl;

      await db
        .update(structures)
        .set(updates)
        .where(eq(structures.id, input.id));

      return { success: true };
    }),

  /**
   * Delete structure
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check ownership
      const [existing] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.id))
        .limit(1);

      if (!existing) {
        throw new Error('Structure not found');
      }

      if (existing.userId !== ctx.user.id) {
        throw new Error('Access denied: You can only delete your own structures');
      }

      await db.delete(structures).where(eq(structures.id, input.id));

      return { success: true };
    }),

  /**
   * Share structure with admin
   */
  share: protectedProcedure
    .input(
      z.object({
        structureId: z.number(),
        adminId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check ownership
      const [structure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.structureId))
        .limit(1);

      if (!structure) {
        throw new Error('Structure not found');
      }

      if (structure.userId !== ctx.user.id) {
        throw new Error('Access denied: You can only share your own structures');
      }

      // Verify target user is admin
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.adminId))
        .limit(1);

      if (!targetUser || targetUser.role !== 'admin') {
        throw new Error('Target user is not an admin');
      }

      // Update sharedWith
      const currentSharedWith = structure.sharedWith ? JSON.parse(structure.sharedWith) : [];
      if (!currentSharedWith.includes(input.adminId)) {
        currentSharedWith.push(input.adminId);
      }

      await db
        .update(structures)
        .set({ sharedWith: JSON.stringify(currentSharedWith) })
        .where(eq(structures.id, input.structureId));

      return { success: true };
    }),

  /**
   * Unshare structure
   */
  unshare: protectedProcedure
    .input(
      z.object({
        structureId: z.number(),
        adminId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check ownership
      const [structure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.structureId))
        .limit(1);

      if (!structure) {
        throw new Error('Structure not found');
      }

      if (structure.userId !== ctx.user.id) {
        throw new Error('Access denied');
      }

      // Update sharedWith
      const currentSharedWith = structure.sharedWith ? JSON.parse(structure.sharedWith) : [];
      const newSharedWith = currentSharedWith.filter((id: number) => id !== input.adminId);

      await db
        .update(structures)
        .set({ sharedWith: JSON.stringify(newSharedWith) })
        .where(eq(structures.id, input.structureId));

      return { success: true };
    }),

  /**
   * Close structure (mark as closed with realized P&L)
   */
  close: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        daxSpot: z.number(),
        riskFreeRate: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check ownership
      const [structure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.id))
        .limit(1);

      if (!structure) {
        throw new Error('Structure not found');
      }

      if (structure.userId !== ctx.user.id) {
        throw new Error('Access denied: You can only close your own structures');
      }

      if (structure.status === 'closed') {
        throw new Error('Structure is already closed');
      }

      // Parse legs
      const legs = JSON.parse(structure.legs) as OptionLeg[];

      const closingDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      let realizedPnl = 0;

      const updatedLegs = legs.map((leg) => {
        // Calculate time to expiry using the unified utility
        const timeToExpiry = Math.max(getTimeToExpiry(leg.expiryDate), MIN_TIME_TO_EXPIRY);

        // Normalize optionType to handle both 'Call'/'Put' and 'call'/'put'
        const optionTypeLower = (leg.optionType || '').toLowerCase() as 'call' | 'put';

        // Use the unified Black-Scholes calculation
        const bsResult = calculateBlackScholes({
          spotPrice: input.daxSpot,
          strikePrice: leg.strike,
          timeToExpiry,
          riskFreeRate: percentToDecimal(input.riskFreeRate),
          volatility: percentToDecimal(leg.impliedVolatility),
          optionType: optionTypeLower,
        });

        const theoreticalPrice = bsResult.optionPrice;

        // Use manual closingPrice if already set, otherwise use theoretical
        const finalClosingPrice = leg.closingPrice !== null && leg.closingPrice !== undefined
          ? leg.closingPrice
          : theoreticalPrice;

        // Calculate P&L for this leg
        // P&L in points: for long positions (quantity > 0): currentPrice - tradePrice
        //                for short positions (quantity < 0): tradePrice - currentPrice
        // Then multiply by quantity (which includes sign) and multiplier
        let pnlPoints: number;
        if (leg.quantity > 0) {
          // Long position: profit when price goes up
          pnlPoints = (finalClosingPrice - leg.tradePrice) * leg.quantity;
        } else {
          // Short position: profit when price goes down
          pnlPoints = (leg.tradePrice - finalClosingPrice) * Math.abs(leg.quantity);
        }

        const grossPnl = pnlPoints * structure.multiplier;
        const openingCommission = (leg.openingCommission ?? DEFAULT_COMMISSION) * Math.abs(leg.quantity);
        const closingCommission = (leg.closingCommission ?? DEFAULT_COMMISSION) * Math.abs(leg.quantity);
        const netPnl = grossPnl - openingCommission - closingCommission;

        realizedPnl += netPnl;

        return {
          ...leg,
          closingPrice: finalClosingPrice,
          closingDate: leg.closingDate || closingDate,
        };
      });

      // Update structure
      await db
        .update(structures)
        .set({
          status: 'closed',
          legs: JSON.stringify(updatedLegs),
          closingDate,
          realizedPnl: realizedPnl.toFixed(2),
        })
        .where(eq(structures.id, input.id));

      return { success: true, realizedPnl };
    }),

  /**
   * Reopen a closed structure (change status back to active)
   */
  reopen: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check ownership
      const [structure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.id))
        .limit(1);

      if (!structure) {
        throw new Error('Structure not found');
      }

      if (structure.userId !== ctx.user.id) {
        throw new Error('Access denied: You can only reopen your own structures');
      }

      if (structure.status === 'active') {
        throw new Error('Structure is already active');
      }

      // Parse legs and remove closing info
      const legs = JSON.parse(structure.legs);
      const updatedLegs = legs.map((leg: any) => ({
        ...leg,
        closingPrice: null,
        closingDate: null,
      }));

      // Update structure
      await db
        .update(structures)
        .set({
          status: 'active',
          legs: JSON.stringify(updatedLegs),
          closingDate: null,
          realizedPnl: null,
        })
        .where(eq(structures.id, input.id));

      return { success: true };
    }),

  /**
   * Get all public structures (visible to all users)
   */
  listPublic: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'closed', 'all']).default('all'),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Base query - show only public structures
      const conditions = [eq(structures.isPublic, 1)];

      // Filter by status
      if (input.status !== 'all') {
        conditions.push(eq(structures.status, input.status));
      }

      const results = await db.select().from(structures).where(and(...conditions));

      // Parse JSON fields
      return results.map(s => ({
        ...s,
        legs: JSON.parse(s.legs),
        sharedWith: s.sharedWith ? JSON.parse(s.sharedWith) : [],
        status: s.status as 'active' | 'closed',
      }));
    }),

  /**
   * Import (copy) a public structure to current user's account
   */
  import: protectedProcedure
    .input(z.object({ structureId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get original structure
      const [original] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.structureId))
        .limit(1);

      if (!original) {
        throw new Error('Structure not found');
      }

      // Check if structure is public
      if (original.isPublic !== 1) {
        throw new Error('Structure is not public');
      }

      // Create independent copy
      const newStructure: InsertStructure = {
        userId: ctx.user.id,
        tag: original.tag + ' (Copy)',
        multiplier: original.multiplier,
        legsPerContract: original.legsPerContract,
        legs: original.legs, // Already JSON string
        status: original.status,
        openPnl: original.openPnl,
        pdc: original.pdc,
        delta: original.delta,
        gamma: original.gamma,
        theta: original.theta,
        vega: original.vega,
        closingDate: original.closingDate,
        realizedPnl: original.realizedPnl,
        sharedWith: null,
        isPublic: 0, // Imported copies are private by default
        isTemplate: 0,
        originalStructureId: original.id, // Track original
      };

      const [result] = await db.insert(structures).values(newStructure);

      // Return created structure
      const [createdStructure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, result.insertId));

      if (!createdStructure) {
        throw new Error('Failed to retrieve imported structure');
      }

      return {
        ...createdStructure,
        legs: JSON.parse(createdStructure.legs),
        sharedWith: createdStructure.sharedWith ? JSON.parse(createdStructure.sharedWith) : [],
      };
    }),

  /**
   * Toggle public/private visibility (admin only)
   */
  togglePublic: protectedProcedure
    .input(
      z.object({
        structureId: z.number(),
        isPublic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new Error('Access denied: Only admins can change visibility');
      }

      // Check ownership
      const [structure] = await db
        .select()
        .from(structures)
        .where(eq(structures.id, input.structureId))
        .limit(1);

      if (!structure) {
        throw new Error('Structure not found');
      }

      if (structure.userId !== ctx.user.id) {
        throw new Error('Access denied: You can only change visibility of your own structures');
      }

      // Update visibility
      await db
        .update(structures)
        .set({ isPublic: input.isPublic ? 1 : 0 })
        .where(eq(structures.id, input.structureId));

      return { success: true };
    }),

  /**
   * Get list of admins for sharing dropdown
   */
  getAdmins: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const admins = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, 'admin'));

    return admins;
  }),
});
