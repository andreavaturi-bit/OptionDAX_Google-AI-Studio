
export const normalCDF = (x: number): number => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014337 * Math.exp(-x * x / 2);
    const prob = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - prob : prob;
};

export const normalPDF = (x: number): number => {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
};

export interface Greeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    price: number;
}

export const calculateBlackScholes = (
    S: number, // Spot Price
    K: number, // Strike Price
    T: number, // Time to Expiry (years)
    r: number, // Risk-free Rate (decimal, e.g. 0.05)
    sigma: number, // Volatility (decimal, e.g. 0.2)
    q: number, // Dividend Yield (decimal, e.g. 0.0)
    type: 'Call' | 'Put'
): Greeks => {
    if (T <= 0) {
        const intrinsic = type === 'Call' ? Math.max(0, S - K) : Math.max(0, K - S);
        return {
            price: intrinsic,
            delta: type === 'Call' ? (S >= K ? 1 : 0) : (S < K ? -1 : 0),
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0
        };
    }

    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const nd1 = normalCDF(d1);
    const nd2 = normalCDF(d2);
    const nnd1 = normalCDF(-d1);
    const nnd2 = normalCDF(-d2);
    const npd1 = normalPDF(d1);

    const e_qt = Math.exp(-q * T);
    const e_rt = Math.exp(-r * T);

    let price = 0;
    let delta = 0;
    let theta = 0;
    let rho = 0;

    if (type === 'Call') {
        price = S * e_qt * nd1 - K * e_rt * nd2;
        delta = e_qt * nd1;
        theta = (-S * e_qt * npd1 * sigma / (2 * Math.sqrt(T)) - r * K * e_rt * nd2 + q * S * e_qt * nd1) / 365;
        rho = (K * T * e_rt * nd2) / 100;
    } else {
        price = K * e_rt * nnd2 - S * e_qt * nnd1;
        delta = -e_qt * nnd1;
        theta = (-S * e_qt * npd1 * sigma / (2 * Math.sqrt(T)) + r * K * e_rt * nnd2 - q * S * e_qt * nnd1) / 365;
        rho = (-K * T * e_rt * nnd2) / 100;
    }

    const gamma = (e_qt * npd1) / (S * sigma * Math.sqrt(T));
    const vega = (S * e_qt * npd1 * Math.sqrt(T)) / 100;

    return {
        price,
        delta,
        gamma: gamma * 100, // Scaled for readability as requested
        theta,
        vega,
        rho
    };
};

export const calculateImpliedVolatility = (
    targetPrice: number,
    S: number,
    K: number,
    T: number,
    r: number,
    q: number,
    type: 'Call' | 'Put'
): number => {
    const MAX_ITERATIONS = 100;
    const PRECISION = 1e-5;
    let sigma = 0.5; // Initial guess

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const greeks = calculateBlackScholes(S, K, T, r, sigma, q, type);
        const price = greeks.price;
        const vega = greeks.vega * 100; // Unscale vega for Newton-Raphson (since we scaled it in calculateBlackScholes)

        const diff = price - targetPrice;

        if (Math.abs(diff) < PRECISION) {
            return sigma;
        }

        if (Math.abs(vega) < 1e-8) {
            break; // Avoid division by zero
        }

        sigma = sigma - diff / vega;
        
        // Ensure sigma stays positive
        if (sigma <= 0) sigma = 1e-5;
    }

    return sigma;
};
