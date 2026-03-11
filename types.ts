export interface UserProfile {
    id: string;
    email: string;
    role: 'admin' | 'client';
    created_at?: string;
}

export interface OptionLeg {
  id: string; // Changed to string for UUID
  optionType: 'Call' | 'Put';
  strike: number;
  expiryDate: string; 
  quantity: number;
  tradePrice: number;
  openingDate: string;
  closingPrice?: number | null;
  closingDate?: string | null;
  impliedVolatility: number;
  openingCommission?: number;
  closingCommission?: number;
  enabled?: boolean;
  currentPrice?: number; // Real-time theoretical price
  currentIv?: number; // Real-time IV
  manualCurrentPrice?: number | null; // User override for current price
}

export interface MarketData {
    daxSpot: number;
    daxVolatility: number; // VDAX-NEW or similar
    riskFreeRate: number;
    lastUpdate: number;
    isVolatilityFallback?: boolean;
}

export interface Structure {
    id: string; // Changed to string for UUID
    tag: string;
    legs: OptionLeg[];
    status: 'Active' | 'Closed';
    multiplier: 1 | 5 | 25;
    closingDate?: string;
    realizedPnl?: number;
    createdAt?: string; // ISO string
    isShared?: boolean; // New field for global sharing
}

export interface CalculatedGreeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
}

export interface Settings {
    initialCapital: number;
    broker: 'AvaOptions' | 'Interactive Brokers' | 'Webank' | 'BGSaxo';
    defaultMultiplier: 1 | 5 | 25;
    defaultOpeningCommission: number;
    defaultClosingCommission: number;
}