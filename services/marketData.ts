
import { GoogleGenAI } from "@google/genai";

/**
 * Funzione di utilità per il retry con backoff esponenziale.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Fallback di emergenza con Gemini Search.
 * Gestito silenziosamente per evitare fastidiosi pop-up di quota.
 */
async function fetchDaxPriceViaGemini(): Promise<number | null> {
  try {
    if (!process.env.API_KEY) return null;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "What is the exact current real-time index price of the DAX 40 (GDAXI)? Provide only the number.",
      config: {
        tools: [{ googleSearch: {} }]
      },
    });

    const text = response.text?.replace(/[^0-9.]/g, '') || "";
    const price = parseFloat(text);
    
    if (!isNaN(price) && price > 10000 && price < 40000) {
      return price;
    }
    return null;
  } catch (error: any) {
    // Silenziamo completamente l'errore per evitare il pop-up Gemini Quota Exceeded (429)
    // che interferirebbe con la navigazione dell'utente.
    return null;
  }
}

/**
 * Tenta il recupero da Yahoo Finance usando un proxy specifico.
 */
async function fetchFromYahooViaProxy(symbol: string, proxyBaseUrl: string): Promise<number> {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
        throw new Error("Offline");
    }

    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    const fullUrl = `${proxyBaseUrl}${encodeURIComponent(targetUrl)}&t=${Date.now()}`;
    
    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
        
        const data = await response.json();
        // Alcuni proxy wrappano il contenuto in un campo 'contents'
        const jsonContent = data.contents ? JSON.parse(data.contents) : data;
        const spot = jsonContent?.chart?.result?.[0]?.meta?.regularMarketPrice;
        
        if (typeof spot === 'number' && spot > 0) {
            return spot;
        }
        throw new Error("Dati non validi");
    } catch (error: any) {
        // Log solo se non è un errore di rete atteso (es. offline)
        if (error.message !== "Offline" && error.message !== "Failed to fetch") {
             console.warn(`Fetch failed for ${symbol} via ${proxyBaseUrl}:`, error.message);
        }
        throw error;
    }
}

/**
 * Recupera sia DAX Spot che VDAX (Volatilità).
 */
export const fetchMarketData = async (): Promise<{ daxSpot: number, daxVolatility: number } | null> => {
    try {
        // 1. Fetch DAX Spot
        let daxSpot: number;
        try {
            daxSpot = await withRetry(() => fetchFromYahooViaProxy('%5EGDAXI', 'https://corsproxy.io/?url='));
        } catch (e) {
            // Fallback proxy for DAX
            daxSpot = await withRetry(() => fetchFromYahooViaProxy('%5EGDAXI', 'https://api.allorigins.win/get?url='));
        }
        
        // 2. Fetch VDAX (V1X)
        let daxVolatility = 0; 
        try {
            daxVolatility = await withRetry(() => fetchFromYahooViaProxy('%5EV1X', 'https://corsproxy.io/?url='));
        } catch (e) {
            try {
                // Fallback proxy for VDAX
                daxVolatility = await withRetry(() => fetchFromYahooViaProxy('%5EV1X', 'https://api.allorigins.win/get?url='));
            } catch (e2) {
                console.warn("VDAX fetch failed on all proxies");
            }
        }

        return { daxSpot, daxVolatility };
    } catch (e) {
        // Fallback finale (Gemini) gestito silenziosamente
        try {
            const spot = await fetchDaxPriceViaGemini();
            return spot ? { daxSpot: spot, daxVolatility: 0 } : null;
        } catch (geminiError) {
            return null;
        }
    }
};

export const fetchLiveDaxPrice = async (): Promise<number | null> => {
    const data = await fetchMarketData();
    return data ? data.daxSpot : null;
};
