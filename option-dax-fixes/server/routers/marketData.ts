import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { rateLimiter, RATE_LIMITS, createRateLimitError } from "../_core/rateLimiter";

// Simple cache to reduce external API calls
let priceCache: { price: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

export const marketDataRouter = router({
  getDaxPrice: publicProcedure.query(async ({ ctx }) => {
    // Rate limiting based on IP address or a default key for public access
    const clientKey = (ctx as any).ip || 'anonymous';
    const rateCheck = rateLimiter.check(clientKey, RATE_LIMITS.EXTERNAL_API);

    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Please try again in ${Math.ceil((rateCheck.resetTime - Date.now()) / 1000)} seconds.`,
      });
    }

    // Return cached price if still valid
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL_MS) {
      return {
        price: priceCache.price,
        timestamp: priceCache.timestamp,
        symbol: "^GDAXI",
        cached: true,
      };
    }

    try {
      // Yahoo Finance API per DAX (^GDAXI)
      const symbol = "^GDAXI";
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch DAX price from Yahoo Finance",
        });
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];
      const currentPrice = result?.meta?.regularMarketPrice;

      if (!currentPrice || typeof currentPrice !== 'number') {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "DAX price not available",
        });
      }

      // Update cache
      priceCache = {
        price: currentPrice,
        timestamp: Date.now(),
      };

      return {
        price: currentPrice,
        timestamp: Date.now(),
        symbol: "^GDAXI",
        cached: false,
      };
    } catch (error) {
      // If we have a cached value, return it even if stale (better than error)
      if (priceCache) {
        return {
          price: priceCache.price,
          timestamp: priceCache.timestamp,
          symbol: "^GDAXI",
          cached: true,
          stale: true,
        };
      }

      // Only log unexpected errors, not rate limits or known issues
      if (!(error instanceof TRPCError)) {
        console.error("Error fetching DAX price:", error);
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch DAX price",
      });
    }
  }),
});
