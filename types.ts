export interface OptionLeg {
  id: number;
  optionType: 'Call' | 'Put';
  strike: number;
  expiryDate: string; 
  quantity: number; // Positive for long, negative for short
  tradePrice: number;
  openingDate: string; // YYYY-MM-DD
  closingPrice?: number | null; // Price at which the leg was closed
  closingDate?: string | null; // YYYY-MM-DD
  impliedVolatility: number; // as percentage, e.g., 18.5
  openingCommission?: number;
  closingCommission?: number;
}

export interface MarketData {
    daxSpot: number;
    riskFreeRate: number; // as percentage, e.g., 2.61
}

export interface Structure {
    id: number;
    tag: string;
    legs: OptionLeg[];
    status: 'Active' | 'Closed';
    multiplier: 1 | 5 | 25; // Product multiplier (e.g., 1=CFD, 5=Micro Future, 25=Future)
    closingDate?: string;
    realizedPnl?: number;
}

export interface CalculatedGreeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
}

export interface ExtractedTrade {
    description: string;
    optionType: 'Call' | 'Put';
    strike: number;
    expiryDate: string; // YYYY-MM-DD
    tradeType: 'Buy' | 'Sell';
    quantity: number;
    price: number;
}

export interface HistoricalImportData {
    tag: string;
    legs: (Omit<OptionLeg, 'id' | 'impliedVolatility' | 'closingDate' | 'closingPrice' | 'openingCommission' | 'closingCommission'> & { closingPrice: number })[];
    realizedPnl: number;
    closingDate: string; // YYYY-MM-DD
}

export interface Settings {
    initialCapital: number;
    broker: 'AvaOptions' | 'Interactive Brokers' | 'Webank' | 'BGSaxo';
    defaultMultiplier: 1 | 5 | 25;
    defaultOpeningCommission: number;
    defaultClosingCommission: number;
}