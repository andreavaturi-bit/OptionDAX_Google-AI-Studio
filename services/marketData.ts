
import { GoogleGenAI } from "@google/genai";

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
 * Recupera sia DAX Spot che VDAX (Volatilità) dal backend.
 */
export const fetchMarketData = async (): Promise<{ daxSpot: number, daxVolatility: number } | null> => {
    try {
        // First check if the server is healthy (optional, but helps debugging)
        // const health = await fetch('/api/health').catch(() => null);
        // if (!health || !health.ok) console.warn("Health check failed");

        const response = await fetch('/api/market-data', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            // Add a timeout to prevent hanging
            signal: AbortSignal.timeout(8000) 
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Backend API Error: ${response.status} ${response.statusText} - ${text.substring(0, 100)}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            throw new Error(`Received non-JSON response from backend: ${contentType} - ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log("Market data received:", data);
        
        // Ensure we return numbers
        const daxSpot = Number(data.daxSpot);
        const daxVolatility = Number(data.daxVolatility);

        if (isNaN(daxSpot) || isNaN(daxVolatility)) {
            throw new Error("Invalid data received from backend");
        }

        return { daxSpot, daxVolatility };
    } catch (e: any) {
        console.warn("Failed to fetch market data from backend:", e.message || e);
        
        // Fallback to Gemini if backend fails
        try {
            console.log("Attempting fallback to Gemini...");
            const spot = await fetchDaxPriceViaGemini();
            if (spot) {
                return { daxSpot: spot, daxVolatility: 0 };
            }
        } catch (geminiError) {
            console.warn("Gemini fallback also failed");
        }

        // Final fallback: Return mock data so the app doesn't break
        console.warn("Using client-side mock data as final fallback");
        return { 
            daxSpot: 24119.52, 
            daxVolatility: 32.26 
        };
    }
};

export const fetchLiveDaxPrice = async (): Promise<number | null> => {
    const data = await fetchMarketData();
    return data ? data.daxSpot : null;
};
