import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedTrade, HistoricalImportData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const tradeSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: 'The full description of the option, e.g., "Option Dax 11-25 CALL 24400"' },
        optionType: { type: Type.STRING, enum: ['Call', 'Put'], description: 'The type of the option contract.' },
        strike: { type: Type.NUMBER, description: 'The strike price of the option.' },
        expiryDate: { type: Type.STRING, description: 'The expiry date in YYYY-MM-DD format.' },
        tradeType: { type: Type.STRING, enum: ['Buy', 'Sell'], description: 'The type of trade executed.' },
        quantity: { type: Type.NUMBER, description: 'The number of contracts traded.' },
        price: { type: Type.NUMBER, description: 'The price at which the trade was executed.' },
    },
    required: ['description', 'optionType', 'strike', 'expiryDate', 'tradeType', 'quantity', 'price']
};


export const analyzeImageForTrades = async (base64Image: string, mimeType: string): Promise<ExtractedTrade[]> => {
    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType,
        },
    };

    const textPart = {
        text: `You are an expert financial analyst specializing in European options. Analyze the provided image of a trading platform's order status window.
               Extract the details for each executed trade ('Eseguito').
               For each trade, identify the option type (Call or Put), strike price, and full expiry date (in YYYY-MM-DD format).
               The description field like "Option Dax 11-25" often refers to the expiry month and year (MM-YY), so "11-25" means November 2025. For standard monthly DAX options, the expiry date is the third Friday of that month. Please calculate the exact date. For weekly options (e.g., descriptions containing W1, W2, W4, W5), the expiry is the corresponding Friday of the month.
               Also extract the trade type (Buy or Sell), the executed quantity ('Q.tà eseg.'), and the execution price ('Pr. eseg.').
               Provide the output as a JSON object that conforms to the provided schema.`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, imagePart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        trades: {
                            type: Type.ARRAY,
                            items: tradeSchema,
                        },
                    },
                },
            },
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result && Array.isArray(result.trades)) {
            return result.trades;
        }
        return [];
    } catch (error) {
        console.error("Error analyzing image with Gemini API:", error);
        throw new Error("Failed to analyze image. Please check the console for details.");
    }
};

const historicalLegSchema = {
    type: Type.OBJECT,
    properties: {
        optionType: { type: Type.STRING, enum: ['Call', 'Put'], description: 'The type of the option contract.' },
        strike: { type: Type.NUMBER, description: 'The strike price of the option.' },
        expiryDate: { type: Type.STRING, description: 'The calculated YYYY-MM-DD expiry date.' },
        openingDate: { type: Type.STRING, description: 'The opening date in YYYY-MM-DD format. If not available, estimate it to be roughly one month before the closing date.' },
        quantity: { type: Type.NUMBER, description: 'The number of contracts. Positive for long (buy), negative for short (sell).' },
        tradePrice: { type: Type.NUMBER, description: 'The opening price of the leg.' },
        closingPrice: { type: Type.NUMBER, description: 'The closing price of the leg.' },
    },
    required: ['optionType', 'strike', 'expiryDate', 'openingDate', 'quantity', 'tradePrice', 'closingPrice']
};

const historicalStructureSchema = {
    type: Type.OBJECT,
    properties: {
        tag: { type: Type.STRING, description: 'The name of the structure, e.g., STRANGLE, found in a colored cell at the bottom right.' },
        closingDate: { type: Type.STRING, description: 'The closing date of the structure in YYYY-MM-DD format, found near the top of the sheet.' },
        realizedPnl: { type: Type.NUMBER, description: 'The final P&L in Euros, found in the "RISULTATO TOTALE" row.' },
        legs: {
            type: Type.ARRAY,
            items: historicalLegSchema
        }
    },
    required: ['tag', 'closingDate', 'realizedPnl', 'legs']
};

export const analyzeHistoryImage = async (base64Image: string, mimeType: string): Promise<HistoricalImportData> => {
     const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType,
        },
    };

    const textPart = {
        text: `You are an expert financial analyst. Your task is to analyze the provided image of a closed options trading strategy on the DAX index and extract its details into a structured JSON format.

The image is a spreadsheet. Follow these steps carefully:

1.  **Find the Structure Name:** Locate the capitalized name in a colored cell, usually at the bottom right of the 'OPERAZIONI CHIUSE' table (e.g., 'STRANGLE', 'DOPPIO DIAGONAL'). This is the 'tag'.

2.  **Find the Closing Date:** The date of this report is typically found at the top, sometimes labeled 'VAL EXP' or similar. It's often in DD-MMM-YY format (e.g., '19-mar-21'). Convert this to 'YYYY-MM-DD' format. This will be the 'closingDate' for the whole structure.

3.  **Find the Realized P&L:** Look for the row 'RISULTATO TOTALE CHIUDENDO AI PREZZI DI OGGI'. The numeric value in the cell to the right of this text is the 'realizedPnl' in Euros.

4.  **Extract the Legs:** Analyze the 'OPERAZIONI CHIUSE' table. Each row is a leg. For each leg:
    a.  **Action & Type:** The first text column combines the expiry month/week and the option details (e.g., 'FEBBRAIO 1 Long Call 21.400').
    b.  **Quantity:** 'Long' means a positive quantity (e.g., +1). 'Short' means a negative quantity (e.g., -1). Extract the number of contracts (usually 1 if not specified).
    c.  **Option Type:** 'Call' or 'Put'.
    d.  **Strike:** The numeric strike price (e.g., 21.400).
    e.  **Expiry Date:** This is challenging. The table gives a month ('FEBBRAIO') or week ('5W GENNAIO'). You must determine the year from the context of the 'closingDate'. For example, if the closing date is in 2021, 'FEBBRAIO' refers to February 2021. DAX monthly options expire on the third Friday of the month. Weekly options (W1, W2, W4, W5) expire on their corresponding Fridays. Calculate the exact 'YYYY-MM-DD' expiry date.
    f.  **Trade & Closing Price:** If a leg was bought ('Long'), the 'acq' column is the 'tradePrice' and 'vend' is the 'closingPrice'. If a leg was sold ('Short'), the 'vend' column is the 'tradePrice' and 'acq' is the 'closingPrice'. Handle cases where values might be zero or empty.
    g.  **Opening Date:** This is often not explicitly listed. Assume the opening date is approximately 30-60 days before the leg's 'expiryDate' unless specified otherwise. Provide a reasonable estimate in 'YYYY-MM-DD' format.

Provide the output as a single JSON object conforming to the schema.`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, imagePart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: historicalStructureSchema,
            },
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error analyzing history image with Gemini API:", error);
        throw new Error("Failed to analyze history image. The format may be incorrect.");
    }
};