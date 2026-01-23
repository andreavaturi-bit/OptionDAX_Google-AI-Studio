import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  calculateBlackScholes,
  calculateBreakEvenPoints,
  type PayoffPoint,
} from "../../shared/blackScholes";

export const analysisRouter = router({
  calculateBlackScholes: protectedProcedure
    .input(
      z.object({
        spotPrice: z.number().positive(),
        strikePrice: z.number().positive(),
        timeToExpiry: z.number().positive(), // in years
        riskFreeRate: z.number(), // as decimal
        volatility: z.number().positive(), // as decimal
        optionType: z.enum(["call", "put"]),
        strategyId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { strategyId, ...params } = input;

      const results = calculateBlackScholes(params);

      // Save to analysis history
      await db.saveAnalysis({
        userId: ctx.user.id,
        strategyId: strategyId || null,
        analysisType: "black-scholes",
        inputParams: JSON.stringify(params),
        results: JSON.stringify(results),
      });

      return results;
    }),

  calculatePayoff: protectedProcedure
    .input(
      z.object({
        strategyType: z.enum(["call", "put", "spread", "straddle"]),
        strikePrice: z.number().positive(),
        premium: z.number().positive(),
        quantity: z.number().int().positive(),
        spotPriceRange: z.object({
          min: z.number().positive(),
          max: z.number().positive(),
          step: z.number().positive(),
        }),
        strategyId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { strategyId, spotPriceRange, ...params } = input;

      const payoffData = [];
      for (
        let spotPrice = spotPriceRange.min;
        spotPrice <= spotPriceRange.max;
        spotPrice += spotPriceRange.step
      ) {
        let payoff = 0;

        if (params.strategyType === "call") {
          payoff =
            Math.max(0, spotPrice - params.strikePrice) * params.quantity -
            params.premium * params.quantity;
        } else if (params.strategyType === "put") {
          payoff =
            Math.max(0, params.strikePrice - spotPrice) * params.quantity -
            params.premium * params.quantity;
        }

        payoffData.push({
          spotPrice: Math.round(spotPrice * 100) / 100,
          payoff: Math.round(payoff * 100) / 100,
        });
      }

      const results = {
        payoffData,
        maxProfit: Math.max(...payoffData.map((d) => d.payoff)),
        maxLoss: Math.min(...payoffData.map((d) => d.payoff)),
        // Use linear interpolation for accurate break-even calculation
        breakEvenPoints: calculateBreakEvenPoints(payoffData as PayoffPoint[]),
      };

      // Save to analysis history
      await db.saveAnalysis({
        userId: ctx.user.id,
        strategyId: strategyId || null,
        analysisType: "payoff",
        inputParams: JSON.stringify({ ...params, spotPriceRange }),
        results: JSON.stringify(results),
      });

      return results;
    }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().positive().default(50) }))
    .query(async ({ input, ctx }) => {
      return await db.getUserAnalysisHistory(ctx.user.id, input.limit);
    }),
});
