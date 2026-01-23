/**
 * Unified Black-Scholes Option Pricing Module
 *
 * This module provides a single, consistent implementation of Black-Scholes
 * pricing and Greeks calculations to be used throughout the application.
 *
 * All formulas follow standard financial mathematics conventions.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Days in a year (accounting for leap years) */
export const DAYS_PER_YEAR = 365.25;

/** Minimum time to expiry to avoid division by zero */
export const MIN_TIME_TO_EXPIRY = 0.000001;

/** Maximum volatility for IV calculation convergence check */
export const MAX_VOLATILITY = 500;

/** Minimum volatility to avoid numerical issues */
export const MIN_VOLATILITY = 0.0001;

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Error function approximation using Abramowitz & Stegun method
 * Maximum error: 1.5 × 10^-7
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function
 * Uses the error function for accurate approximation
 */
export function normalCDF(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
}

/**
 * Standard Normal Probability Density Function
 */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

export interface BlackScholesInput {
  spotPrice: number;
  strikePrice: number;
  timeToExpiry: number; // in years
  riskFreeRate: number; // as decimal (e.g., 0.05 for 5%)
  volatility: number;   // as decimal (e.g., 0.20 for 20%)
  optionType: 'call' | 'put';
}

export interface BlackScholesResult {
  optionPrice: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  d1: number;
  d2: number;
}

export class BlackScholesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlackScholesValidationError';
  }
}

/**
 * Validates Black-Scholes input parameters
 * @throws BlackScholesValidationError if inputs are invalid
 */
export function validateInputs(params: BlackScholesInput): void {
  const { spotPrice, strikePrice, timeToExpiry, volatility } = params;

  if (spotPrice <= 0) {
    throw new BlackScholesValidationError('Spot price must be positive');
  }
  if (strikePrice <= 0) {
    throw new BlackScholesValidationError('Strike price must be positive');
  }
  if (timeToExpiry < 0) {
    throw new BlackScholesValidationError('Time to expiry cannot be negative');
  }
  if (volatility < 0) {
    throw new BlackScholesValidationError('Volatility cannot be negative');
  }
}

// ============================================================================
// BLACK-SCHOLES CALCULATION
// ============================================================================

/**
 * Calculate d1 and d2 parameters for Black-Scholes
 */
export function calculateD1D2(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  riskFreeRate: number,
  volatility: number
): { d1: number; d2: number } {
  // Protect against division by zero
  const T = Math.max(timeToExpiry, MIN_TIME_TO_EXPIRY);
  const sigma = Math.max(volatility, MIN_VOLATILITY);

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spotPrice / strikePrice) + (riskFreeRate + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  return { d1, d2 };
}

/**
 * Main Black-Scholes calculation function
 * Returns option price and all Greeks
 */
export function calculateBlackScholes(params: BlackScholesInput): BlackScholesResult {
  validateInputs(params);

  const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, optionType } = params;

  // Protect against edge cases
  const T = Math.max(timeToExpiry, MIN_TIME_TO_EXPIRY);
  const sigma = Math.max(volatility, MIN_VOLATILITY);

  const { d1, d2 } = calculateD1D2(spotPrice, strikePrice, T, riskFreeRate, sigma);
  const sqrtT = Math.sqrt(T);
  const expRT = Math.exp(-riskFreeRate * T);

  let optionPrice: number;
  let delta: number;
  let rho: number;

  if (optionType === 'call') {
    optionPrice = spotPrice * normalCDF(d1) - strikePrice * expRT * normalCDF(d2);
    delta = normalCDF(d1);
    rho = strikePrice * T * expRT * normalCDF(d2) / 100;
  } else {
    optionPrice = strikePrice * expRT * normalCDF(-d2) - spotPrice * normalCDF(-d1);
    delta = normalCDF(d1) - 1;
    rho = -strikePrice * T * expRT * normalCDF(-d2) / 100;
  }

  // Ensure non-negative price
  optionPrice = Math.max(0, optionPrice);

  // Greeks (same for call and put except where noted above)
  const npd1 = normalPDF(d1);

  const gamma = npd1 / (spotPrice * sigma * sqrtT);

  // Vega: per 1% volatility change (divided by 100)
  const vega = spotPrice * sqrtT * npd1 / 100;

  // Theta: daily (divided by 365)
  const thetaAnnual = optionType === 'call'
    ? (-spotPrice * npd1 * sigma / (2 * sqrtT)) - riskFreeRate * strikePrice * expRT * normalCDF(d2)
    : (-spotPrice * npd1 * sigma / (2 * sqrtT)) + riskFreeRate * strikePrice * expRT * normalCDF(-d2);
  const theta = thetaAnnual / DAYS_PER_YEAR;

  return {
    optionPrice: roundTo(optionPrice, 2),
    delta: roundTo(delta, 4),
    gamma: roundTo(gamma, 6),
    vega: roundTo(vega, 2),
    theta: roundTo(theta, 2),
    rho: roundTo(rho, 2),
    d1,
    d2,
  };
}

// ============================================================================
// IMPLIED VOLATILITY
// ============================================================================

export interface ImpliedVolatilityInput {
  targetPrice: number;
  spotPrice: number;
  strikePrice: number;
  timeToExpiry: number;
  riskFreeRate: number;
  optionType: 'call' | 'put';
}

export interface ImpliedVolatilityResult {
  impliedVolatility: number | null;
  converged: boolean;
  iterations: number;
}

/**
 * Calculate Implied Volatility using Newton-Raphson method with safeguards
 *
 * Improvements over basic implementation:
 * - Upper bound clamping to prevent explosion
 * - Bisection fallback when Newton-Raphson diverges
 * - Proper convergence checking
 * - Returns null when non-convergent
 */
export function calculateImpliedVolatility(
  params: ImpliedVolatilityInput,
  options: { maxIterations?: number; epsilon?: number } = {}
): ImpliedVolatilityResult {
  const { targetPrice, spotPrice, strikePrice, timeToExpiry, riskFreeRate, optionType } = params;
  const { maxIterations = 100, epsilon = 0.001 } = options;

  // Validate target price
  if (targetPrice <= 0) {
    return { impliedVolatility: null, converged: false, iterations: 0 };
  }

  // Initial guess based on ATM approximation
  let vol = Math.sqrt(2 * Math.PI / Math.max(timeToExpiry, MIN_TIME_TO_EXPIRY)) * (targetPrice / spotPrice);
  vol = Math.max(0.1, Math.min(vol, 2)); // Clamp initial guess to [10%, 200%]

  let lowerBound = MIN_VOLATILITY;
  let upperBound = MAX_VOLATILITY;
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;

    const result = calculateBlackScholes({
      spotPrice,
      strikePrice,
      timeToExpiry,
      riskFreeRate,
      volatility: vol,
      optionType,
    });

    const price = result.optionPrice;
    const diff = price - targetPrice;

    // Check convergence
    if (Math.abs(diff) < epsilon) {
      return { impliedVolatility: roundTo(vol * 100, 2), converged: true, iterations };
    }

    // Calculate vega for Newton-Raphson step
    // Vega is already per 1% change, so multiply by 100 for per 100% change
    const vega = result.vega * 100;

    // If vega is too small, use bisection instead
    if (Math.abs(vega) < 1e-10) {
      // Bisection step
      if (diff > 0) {
        upperBound = vol;
      } else {
        lowerBound = vol;
      }
      vol = (lowerBound + upperBound) / 2;
    } else {
      // Newton-Raphson step
      const newVol = vol - diff / vega;

      // Check if Newton-Raphson is diverging
      if (newVol <= 0 || newVol > MAX_VOLATILITY || !isFinite(newVol)) {
        // Fall back to bisection
        if (diff > 0) {
          upperBound = vol;
        } else {
          lowerBound = vol;
        }
        vol = (lowerBound + upperBound) / 2;
      } else {
        // Update bounds for potential bisection fallback
        if (diff > 0) {
          upperBound = Math.min(upperBound, vol);
        } else {
          lowerBound = Math.max(lowerBound, vol);
        }
        vol = newVol;
      }
    }

    // Safety check: if bounds are too close, we've converged as much as possible
    if (upperBound - lowerBound < MIN_VOLATILITY) {
      return { impliedVolatility: roundTo(vol * 100, 2), converged: true, iterations };
    }
  }

  // Did not converge
  return { impliedVolatility: null, converged: false, iterations };
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Calculate time to expiry in years from expiry date
 */
export function getTimeToExpiry(expiryDate: string | Date): number {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();

  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 0; // Expired
  }

  return diffMs / (DAYS_PER_YEAR * 24 * 60 * 60 * 1000);
}

// ============================================================================
// BREAK-EVEN CALCULATION
// ============================================================================

export interface PayoffPoint {
  spotPrice: number;
  payoff: number;
}

/**
 * Calculate break-even points using linear interpolation
 * This provides more accurate break-even values than simple filtering
 */
export function calculateBreakEvenPoints(payoffData: PayoffPoint[]): number[] {
  const breakEvenPoints: number[] = [];

  for (let i = 1; i < payoffData.length; i++) {
    const prev = payoffData[i - 1];
    const curr = payoffData[i];

    // Check if payoff crosses zero between these points
    if ((prev.payoff < 0 && curr.payoff >= 0) || (prev.payoff >= 0 && curr.payoff < 0)) {
      // Linear interpolation to find exact break-even
      const ratio = Math.abs(prev.payoff) / (Math.abs(prev.payoff) + Math.abs(curr.payoff));
      const breakEven = prev.spotPrice + ratio * (curr.spotPrice - prev.spotPrice);
      breakEvenPoints.push(roundTo(breakEven, 2));
    }
  }

  return breakEvenPoints;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Round a number to a specified number of decimal places
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Convert percentage to decimal (e.g., 5 -> 0.05)
 */
export function percentToDecimal(percent: number): number {
  return percent / 100;
}

/**
 * Convert decimal to percentage (e.g., 0.05 -> 5)
 */
export function decimalToPercent(decimal: number): number {
  return decimal * 100;
}
