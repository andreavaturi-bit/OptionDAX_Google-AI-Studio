
// Error function (erf) approximation using the same Abramowitz and Stegun constants for consistency.
const erf = (x: number): number => {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    
    return sign * y;
};

// Standard Normal Cumulative Distribution Function (CDF) using the error function.
// This is a more standard and numerically stable implementation.
const normCdf = (x: number): number => {
    return 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
};


// Standard Normal Probability Density Function (PDF)
const normPdf = (x: number): number => {
    return (1/Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export class BlackScholes {
  private S: number;
  private K: number;
  private T: number;
  private r: number;
  private sigma: number;
  private d1: number;
  private d2: number;

  constructor(spot: number, strike: number, timeToExpiry: number, riskFreeRate: number, volatility: number) {
    this.S = spot;
    this.K = strike;
    this.T = timeToExpiry > 0 ? timeToExpiry : 0.000001; // Avoid division by zero
    this.r = riskFreeRate / 100;
    this.sigma = volatility / 100;

    const d1_num = Math.log(this.S / this.K) + (this.r + 0.5 * this.sigma * this.sigma) * this.T;
    const d1_den = this.sigma * Math.sqrt(this.T);
    this.d1 = d1_num / d1_den;
    this.d2 = this.d1 - this.sigma * Math.sqrt(this.T);
  }

  callPrice(): number {
    return this.S * normCdf(this.d1) - this.K * Math.exp(-this.r * this.T) * normCdf(this.d2);
  }

  putPrice(): number {
    return this.K * Math.exp(-this.r * this.T) * normCdf(-this.d2) - this.S * normCdf(-this.d1);
  }

  callGreeks(): { delta: number, gamma: number, theta: number, vega: number } {
    const delta = normCdf(this.d1);
    // FIX: The standard gamma formula results in very small numbers for high-priced underlyings like DAX.
    // This scales the result to show the change in delta for a 1% move in the spot price, which is a more readable convention.
    // The formula simplifies from (N'(d1)/(S*σ*√T)) * (S/100) to N'(d1)/(100*σ*√T).
    const gamma = normPdf(this.d1) / (100 * this.sigma * Math.sqrt(this.T));
    const theta = -((this.S * normPdf(this.d1) * this.sigma) / (2 * Math.sqrt(this.T))) - (this.r * this.K * Math.exp(-this.r * this.T) * normCdf(this.d2));
    const vega = this.S * Math.sqrt(this.T) * normPdf(this.d1);
    
    return { delta, gamma, theta: theta / 365, vega: vega / 100 };
  }

  putGreeks(): { delta: number, gamma: number, theta: number, vega: number } {
    const delta = normCdf(this.d1) - 1;
    // FIX: Apply the same scaling to put gamma for consistency.
    const gamma = normPdf(this.d1) / (100 * this.sigma * Math.sqrt(this.T));
    const theta = -((this.S * normPdf(this.d1) * this.sigma) / (2 * Math.sqrt(this.T))) + (this.r * this.K * Math.exp(-this.r * this.T) * normCdf(-this.d2));
    const vega = this.S * Math.sqrt(this.T) * normPdf(this.d1);

    return { delta, gamma, theta: theta / 365, vega: vega / 100 };
  }
}

export const getTimeToExpiry = (expiryDate: string): number => {
    // BUG FIX: Ensure consistent UTC calculation.
    // An expiryDate string like 'YYYY-MM-DD' is parsed by `new Date()` as midnight UTC.
    // `Date.now()` returns milliseconds since epoch in UTC.
    // This correctly compares UTC expiry time with the current UTC time.
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - Date.now();
    if (diffTime <= 0) return 0;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays / 365.0;
};

// Calculate Implied Volatility using Newton-Raphson method
export const calculateImpliedVolatility = (
    targetPrice: number,
    s: number,
    k: number,
    t: number,
    r: number,
    type: 'Call' | 'Put'
): number | null => {
    let vol = 20; // Initial guess (20%)
    const maxIter = 100;
    const epsilon = 0.001; // Precision

    for (let i = 0; i < maxIter; i++) {
        const bs = new BlackScholes(s, k, t, r, vol);
        const price = type === 'Call' ? bs.callPrice() : bs.putPrice();
        const diff = price - targetPrice;

        if (Math.abs(diff) < epsilon) {
            return vol;
        }

        // We use the Vega from our class.
        // Our class returns Vega scaled by 100 (change in price per 1% vol change).
        // Since `vol` variable is in percentage points (e.g. 20), this matches directly.
        // NewVol = OldVol - (Price - Target) / (dPrice/dVol)
        const vega = type === 'Call' ? bs.callGreeks().vega : bs.putGreeks().vega;

        // Prevent division by zero or extremely small vega (deep ITM/OTM)
        if (Math.abs(vega) < 1e-4) {
            break; 
        }

        vol = vol - diff / vega;

        // Clamp volatility to reasonable bounds
        if (vol <= 0) vol = 0.1;
    }
    
    return vol;
};
