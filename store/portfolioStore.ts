
import { create } from 'zustand';
import { Structure, OptionLeg, MarketData, HistoricalImportData } from '../types';
import { BlackScholes, getTimeToExpiry } from '../services/blackScholes';
import useSettingsStore from './settingsStore';

interface PortfolioState {
  structures: Structure[];
  marketData: MarketData;
  nextStructureId: number;
  currentView: 'list' | 'detail' | 'settings' | 'analysis';
  currentStructureId: number | 'new' | null;
  
  addStructure: (structure: Omit<Structure, 'id' | 'status'>) => void;
  addHistoricalStructures: (structuresData: HistoricalImportData[]) => void;
  updateStructure: (structure: Structure) => void;
  deleteStructure: (structureId: number) => void;
  deleteStructures: (structureIds: number[]) => void;
  closeStructure: (structureId: number) => void;
  reopenStructure: (structureId: number) => void;
  setMarketData: (data: Partial<MarketData>) => void;
  setCurrentView: (view: 'list' | 'detail' | 'settings' | 'analysis', structureId?: number | 'new' | null) => void;
}

const initialStructures: Structure[] = [
      // --- Nuove strutture di esempio con scadenze FUTURE (Oggi: 16/11/2025) ---
      {
        id: 63,
        tag: 'BPS5',
        status: 'Active',
        multiplier: 5,
        legs: [
            { id: 1, optionType: 'Put', strike: 21500, expiryDate: '2025-12-19', openingDate: '2025-10-20', quantity: -1, tradePrice: 250, impliedVolatility: 18, openingCommission: 2, closingCommission: 2 },
            { id: 2, optionType: 'Put', strike: 21000, expiryDate: '2025-12-19', openingDate: '2025-10-20', quantity: 1, tradePrice: 180, impliedVolatility: 19, openingCommission: 2, closingCommission: 2 },
        ]
      },
      {
        id: 64,
        tag: 'BCS6',
        status: 'Active',
        multiplier: 5,
        legs: [
            { id: 1, optionType: 'Call', strike: 22500, expiryDate: '2026-01-16', openingDate: '2025-11-15', quantity: -1, tradePrice: 280, impliedVolatility: 16, openingCommission: 2, closingCommission: 2 },
            { id: 2, optionType: 'Call', strike: 23000, expiryDate: '2026-01-16', openingDate: '2025-11-15', quantity: 1, tradePrice: 210, impliedVolatility: 15, openingCommission: 2, closingCommission: 2 },
        ]
      },
      {
        id: 65,
        tag: 'STG7',
        status: 'Active',
        multiplier: 25,
        legs: [
            { id: 1, optionType: 'Put', strike: 20000, expiryDate: '2026-03-20', openingDate: '2025-11-10', quantity: -1, tradePrice: 150, impliedVolatility: 20, openingCommission: 2, closingCommission: 2 },
            { id: 2, optionType: 'Call', strike: 23500, expiryDate: '2026-03-20', openingDate: '2025-11-10', quantity: -1, tradePrice: 180, impliedVolatility: 14, openingCommission: 2, closingCommission: 2 },
        ]
      },
      {
        id: 66,
        tag: 'CAL8',
        status: 'Active',
        multiplier: 25,
        legs: [
            { id: 1, optionType: 'Call', strike: 22000, expiryDate: '2026-02-20', openingDate: '2025-11-05', quantity: -1, tradePrice: 200, impliedVolatility: 16, openingCommission: 2, closingCommission: 2 },
            { id: 2, optionType: 'Call', strike: 22000, expiryDate: '2026-04-17', openingDate: '2025-11-05', quantity: 1, tradePrice: 350, impliedVolatility: 17, openingCommission: 2, closingCommission: 2 },
        ]
      },
      // Esempi di strutture chiuse
      { id: 3, tag: "SP01", status: 'Closed', multiplier: 25, closingDate: '2023-06-16', realizedPnl: 2496, legs: [{ id: 1, optionType: 'Put', strike: 20000, expiryDate: '2023-06-16', openingDate: '2023-05-15', closingDate: '2023-06-16', quantity: -1, tradePrice: 150, closingPrice: 50, impliedVolatility: 18, openingCommission: 2, closingCommission: 2 }] },
      { id: 4, tag: "ST02", status: 'Closed', multiplier: 25, closingDate: '2023-07-21', realizedPnl: -1510, legs: [{ id: 1, optionType: 'Put', strike: 19500, expiryDate: '2023-07-21', openingDate: '2023-06-20', closingDate: '2023-07-21', quantity: -1, tradePrice: 120, closingPrice: 200, impliedVolatility: 20, openingCommission: 2.5, closingCommission: 2.5 }, { id: 2, optionType: 'Call', strike: 21500, expiryDate: '2023-07-21', openingDate: '2023-06-20', closingDate: '2023-07-21', quantity: -1, tradePrice: 100, closingPrice: 80, impliedVolatility: 15, openingCommission: 2.5, closingCommission: 2.5 }] },
      { id: 5, tag: "IC03", status: 'Closed', multiplier: 5, closingDate: '2023-08-18', realizedPnl: 284, legs: [{ id: 1, optionType: 'Put', strike: 19000, expiryDate: '2023-08-18', openingDate: '2023-07-18', closingDate: '2023-08-18', quantity: 1, tradePrice: 40, closingPrice: 10, impliedVolatility: 22, openingCommission: 2, closingCommission: 2 }, { id: 2, optionType: 'Put', strike: 19500, expiryDate: '2023-08-18', openingDate: '2023-07-18', closingDate: '2023-08-18', quantity: -1, tradePrice: 90, closingPrice: 30, impliedVolatility: 20, openingCommission: 2, closingCommission: 2 }, { id: 3, optionType: 'Call', strike: 21500, expiryDate: '2023-08-18', openingDate: '2023-07-18', closingDate: '2023-08-18', quantity: -1, tradePrice: 85, closingPrice: 25, impliedVolatility: 16, openingCommission: 2, closingCommission: 2 }, { id: 4, optionType: 'Call', strike: 22000, expiryDate: '2023-08-18', openingDate: '2023-07-18', closingDate: '2023-08-18', quantity: 1, tradePrice: 35, closingPrice: 5, impliedVolatility: 15, openingCommission: 2, closingCommission: 2 }] },
      { id: 6, tag: "LC04", status: 'Closed', multiplier: 25, closingDate: '2023-09-15', realizedPnl: 4992, legs: [{ id: 1, optionType: 'Call', strike: 21000, expiryDate: '2023-09-15', openingDate: '2023-08-15', closingDate: '2023-09-15', quantity: 1, tradePrice: 100, closingPrice: 300, impliedVolatility: 14, openingCommission: 4, closingCommission: 4 }] },
      { id: 7, tag: "CS05", status: 'Closed', multiplier: 25, closingDate: '2023-10-20', realizedPnl: -510, legs: [{ id: 1, optionType: 'Call', strike: 21000, expiryDate: '2023-10-20', openingDate: '2023-09-20', closingDate: '2023-10-20', quantity: -1, tradePrice: 150, closingPrice: 250, impliedVolatility: 17, openingCommission: 2.5, closingCommission: 2.5 }, { id: 2, optionType: 'Call', strike: 21000, expiryDate: '2023-11-17', openingDate: '2023-09-20', closingDate: '2023-10-20', quantity: 1, tradePrice: 220, closingPrice: 300, impliedVolatility: 16, openingCommission: 2.5, closingCommission: 2.5 }] },
      { id: 8, tag: "ST06", status: 'Closed', multiplier: 25, closingDate: '2023-11-17', realizedPnl: 3740, legs: [{ id: 1, optionType: 'Put', strike: 20000, expiryDate: '2023-11-17', openingDate: '2023-10-17', closingDate: '2023-11-17', quantity: -1, tradePrice: 180, closingPrice: 50, impliedVolatility: 19, openingCommission: 2.5, closingCommission: 2.5 }, { id: 2, optionType: 'Call', strike: 22000, expiryDate: '2023-11-17', openingDate: '2023-10-17', closingDate: '2023-11-17', quantity: -1, tradePrice: 120, closingPrice: 100, impliedVolatility: 14, openingCommission: 2.5, closingCommission: 2.5 }] },
      { id: 9, tag: "BCS07", status: 'Closed', multiplier: 5, closingDate: '2023-12-15', realizedPnl: 242, legs: [{ id: 1, optionType: 'Call', strike: 21500, expiryDate: '2023-12-15', openingDate: '2023-11-15', closingDate: '2023-12-15', quantity: -1, tradePrice: 150, closingPrice: 50, impliedVolatility: 16, openingCommission: 2, closingCommission: 2 }, { id: 2, optionType: 'Call', strike: 22000, expiryDate: '2023-12-15', openingDate: '2023-11-15', closingDate: '2023-12-15', quantity: 1, tradePrice: 60, closingPrice: 10, impliedVolatility: 15, openingCommission: 2, closingCommission: 2 }] },
      { id: 10, tag: "LP08", status: 'Closed', multiplier: 25, closingDate: '2024-01-19', realizedPnl: -5060, legs: [{ id: 1, optionType: 'Put', strike: 21000, expiryDate: '2024-01-19', openingDate: '2023-12-19', closingDate: '2024-01-19', quantity: 2, tradePrice: 200, closingPrice: 99, impliedVolatility: 18, openingCommission: 2.5, closingCommission: 2.5 }] },
      { id: 11, tag: "IC09", status: 'Closed', multiplier: 5, closingDate: '2024-02-16', realizedPnl: 968, legs: [{ id: 1, optionType: 'Put', strike: 20500, expiryDate: '2024-02-16', openingDate: '2024-01-16', closingDate: '2024-02-16', quantity: 2, tradePrice: 50, closingPrice: 5, impliedVolatility: 21, openingCommission: 2, closingCommission: 2 }, { id: 2, optionType: 'Put', strike: 21000, expiryDate: '2024-02-16', openingDate: '2024-01-16', closingDate: '2024-02-16', quantity: -2, tradePrice: 110, closingPrice: 15, impliedVolatility: 19, openingCommission: 2, closingCommission: 2 }, { id: 3, optionType: 'Call', strike: 22500, expiryDate: '2024-02-16', openingDate: '2024-01-16', closingDate: '2024-02-16', quantity: -2, tradePrice: 120, closingPrice: 20, impliedVolatility: 16, openingCommission: 2, closingCommission: 2 }, { id: 4, optionType: 'Call', strike: 23000, expiryDate: '2024-02-16', openingDate: '2024-01-16', closingDate: '2024-02-16', quantity: 2, tradePrice: 60, closingPrice: 10, impliedVolatility: 15, openingCommission: 2, closingCommission: 2 }] },
      { id: 12, tag: "RS10", status: 'Closed', multiplier: 25, closingDate: '2024-03-15', realizedPnl: 732, legs: [{ id: 1, optionType: 'Call', strike: 21500, expiryDate: '2024-03-15', openingDate: '2024-02-15', closingDate: '2024-03-15', quantity: 1, tradePrice: 200, closingPrice: 350, impliedVolatility: 16, openingCommission: 3, closingCommission: 3 }, { id: 2, optionType: 'Call', strike: 22000, expiryDate: '2024-03-15', openingDate: '2024-02-15', closingDate: '2024-03-15', quantity: -2, tradePrice: 120, closingPrice: 180, impliedVolatility: 15, openingCommission: 3, closingCommission: 3 }] },
      // --- Additional 50 Closed Trades ---
      // FIX: Added missing expiryDate to legs of closed structures. Assumed expiryDate is the same as closingDate.
      { id: 13, tag: "BPS11", status: 'Closed', multiplier: 5, closingDate: '2024-04-19', realizedPnl: 450, legs: [{ id: 1, optionType: 'Put', strike: 21000, expiryDate: '2024-04-19', openingDate: '2024-03-19', closingDate: '2024-04-19', quantity: 1, tradePrice: 60, closingPrice: 10, impliedVolatility: 18 }, { id: 2, optionType: 'Put', strike: 21500, expiryDate: '2024-04-19', openingDate: '2024-03-19', closingDate: '2024-04-19', quantity: -1, tradePrice: 150, closingPrice: 50, impliedVolatility: 17 }] },
      { id: 14, tag: "SP12", status: 'Closed', multiplier: 25, closingDate: '2024-05-17', realizedPnl: 3120, legs: [{ id: 1, optionType: 'Put', strike: 22000, expiryDate: '2024-05-17', openingDate: '2024-04-17', closingDate: '2024-05-17', quantity: -2, tradePrice: 180, closingPrice: 54, impliedVolatility: 15 }] },
      { id: 15, tag: "DD13", status: 'Closed', multiplier: 25, closingDate: '2024-06-21', realizedPnl: -2800, legs: [{ id: 1, optionType: 'Call', strike: 23000, expiryDate: '2024-06-21', openingDate: '2024-05-21', closingDate: '2024-06-21', quantity: -1, tradePrice: 120, closingPrice: 250, impliedVolatility: 14 }, { id: 2, optionType: 'Call', strike: 23500, expiryDate: '2024-07-19', openingDate: '2024-05-21', closingDate: '2024-06-21', quantity: 1, tradePrice: 100, closingPrice: 180, impliedVolatility: 15 }] },
      { id: 16, tag: "IC14", status: 'Closed', multiplier: 5, closingDate: '2024-07-19', realizedPnl: 780, legs: [{ id: 1, optionType: 'Put', strike: 21000, expiryDate: '2024-07-19', openingDate: '2024-06-19', closingDate: '2024-07-19', quantity: 1, tradePrice: 50, closingPrice: 5, impliedVolatility: 20 }, { id: 2, optionType: 'Put', strike: 21500, expiryDate: '2024-07-19', openingDate: '2024-06-19', closingDate: '2024-07-19', quantity: -1, tradePrice: 100, closingPrice: 10, impliedVolatility: 19 }, { id: 3, optionType: 'Call', strike: 23500, expiryDate: '2024-07-19', openingDate: '2024-06-19', closingDate: '2024-07-19', quantity: -1, tradePrice: 110, closingPrice: 15, impliedVolatility: 16 }, { id: 4, optionType: 'Call', strike: 24000, expiryDate: '2024-07-19', openingDate: '2024-06-19', closingDate: '2024-07-19', quantity: 1, tradePrice: 60, closingPrice: 10, impliedVolatility: 15 }] },
      { id: 17, tag: "ST15", status: 'Closed', multiplier: 25, closingDate: '2024-08-16', realizedPnl: 1980, legs: [{ id: 1, optionType: 'Put', strike: 22000, expiryDate: '2024-08-16', openingDate: '2024-07-16', closingDate: '2024-08-16', quantity: -1, tradePrice: 250, closingPrice: 180, impliedVolatility: 18 }, { id: 2, optionType: 'Call', strike: 24000, expiryDate: '2024-08-16', openingDate: '2024-07-16', closingDate: '2024-08-16', quantity: -1, tradePrice: 220, closingPrice: 190, impliedVolatility: 14 }] },
      { id: 18, tag: "LC16", status: 'Closed', multiplier: 25, closingDate: '2024-09-20', realizedPnl: -1550, legs: [{ id: 1, optionType: 'Call', strike: 23500, expiryDate: '2024-09-20', openingDate: '2024-08-20', closingDate: '2024-09-20', quantity: 1, tradePrice: 300, closingPrice: 238, impliedVolatility: 16 }] },
      { id: 19, tag: "IC17", status: 'Closed', multiplier: 5, closingDate: '2024-10-18', realizedPnl: 690, legs: [{ id: 1, optionType: 'Put', strike: 22500, expiryDate: '2024-10-18', openingDate: '2024-09-18', closingDate: '2024-10-18', quantity: 1, tradePrice: 70, closingPrice: 10, impliedVolatility: 19 }, { id: 2, optionType: 'Put', strike: 23000, expiryDate: '2024-10-18', openingDate: '2024-09-18', closingDate: '2024-10-18', quantity: -1, tradePrice: 140, closingPrice: 20, impliedVolatility: 18 }, { id: 3, optionType: 'Call', strike: 24500, expiryDate: '2024-10-18', openingDate: '2024-09-18', closingDate: '2024-10-18', quantity: -1, tradePrice: 150, closingPrice: 30, impliedVolatility: 15 }, { id: 4, optionType: 'Call', strike: 25000, expiryDate: '2024-10-18', openingDate: '2024-09-18', closingDate: '2024-10-18', quantity: 1, tradePrice: 80, closingPrice: 10, impliedVolatility: 14 }] },
      { id: 20, tag: "SP18", status: 'Closed', multiplier: 25, closingDate: '2024-11-15', realizedPnl: 4500, legs: [{ id: 1, optionType: 'Put', strike: 23000, expiryDate: '2024-11-15', openingDate: '2024-10-15', closingDate: '2024-11-15', quantity: -3, tradePrice: 200, closingPrice: 50, impliedVolatility: 17 }] },
      { id: 21, tag: "BCS19", status: 'Closed', multiplier: 5, closingDate: '2024-12-20', realizedPnl: 320, legs: [{ id: 1, optionType: 'Call', strike: 24000, expiryDate: '2024-12-20', openingDate: '2024-11-20', closingDate: '2024-12-20', quantity: -2, tradePrice: 180, closingPrice: 120, impliedVolatility: 16 }, { id: 2, optionType: 'Call', strike: 24500, expiryDate: '2024-12-20', openingDate: '2024-11-20', closingDate: '2024-12-20', quantity: 2, tradePrice: 110, closingPrice: 80, impliedVolatility: 15 }] },
      { id: 22, tag: "LP20", status: 'Closed', multiplier: 25, closingDate: '2025-01-17', realizedPnl: 5200, legs: [{ id: 1, optionType: 'Put', strike: 23500, expiryDate: '2025-01-17', openingDate: '2024-12-17', closingDate: '2025-01-17', quantity: 1, tradePrice: 150, closingPrice: 358, impliedVolatility: 19 }] },
      { id: 23, tag: "ST21", status: 'Closed', multiplier: 25, closingDate: '2025-02-21', realizedPnl: -4100, legs: [{ id: 1, optionType: 'Put', strike: 22500, expiryDate: '2025-02-21', openingDate: '2025-01-21', closingDate: '2025-02-21', quantity: -1, tradePrice: 180, closingPrice: 400, impliedVolatility: 21 }, { id: 2, optionType: 'Call', strike: 24500, expiryDate: '2025-02-21', openingDate: '2025-01-21', closingDate: '2025-02-21', quantity: -1, tradePrice: 200, closingPrice: 150, impliedVolatility: 16 }] },
      { id: 24, tag: "IC22", status: 'Closed', multiplier: 5, closingDate: '2025-03-21', realizedPnl: 810, legs: [{ id: 1, optionType: 'Put', strike: 22000, expiryDate: '2025-03-21', openingDate: '2025-02-21', closingDate: '2025-03-21', quantity: 3, tradePrice: 60, closingPrice: 10, impliedVolatility: 22 }, { id: 2, optionType: 'Put', strike: 22500, expiryDate: '2025-03-21', openingDate: '2025-02-21', closingDate: '2025-03-21', quantity: -3, tradePrice: 120, closingPrice: 20, impliedVolatility: 20 }, { id: 3, optionType: 'Call', strike: 24000, expiryDate: '2025-03-21', openingDate: '2025-02-21', closingDate: '2025-03-21', quantity: -3, tradePrice: 130, closingPrice: 30, impliedVolatility: 17 }, { id: 4, optionType: 'Call', strike: 24500, expiryDate: '2025-03-21', openingDate: '2025-02-21', closingDate: '2025-03-21', quantity: 3, tradePrice: 70, closingPrice: 10, impliedVolatility: 16 }] },
      { id: 25, tag: "RS23", status: 'Closed', multiplier: 25, closingDate: '2025-04-18', realizedPnl: 1250, legs: [{ id: 1, optionType: 'Put', strike: 23000, expiryDate: '2025-04-18', openingDate: '2025-03-18', closingDate: '2025-04-18', quantity: 2, tradePrice: 150, closingPrice: 250, impliedVolatility: 18 }, { id: 2, optionType: 'Put', strike: 22500, expiryDate: '2025-04-18', openingDate: '2025-03-18', closingDate: '2025-04-18', quantity: -3, tradePrice: 100, closingPrice: 120, impliedVolatility: 19 }] },
      { id: 26, tag: "CS24", status: 'Closed', multiplier: 25, closingDate: '2025-05-16', realizedPnl: 980, legs: [{ id: 1, optionType: 'Call', strike: 23500, expiryDate: '2025-05-16', openingDate: '2025-04-16', closingDate: '2025-05-16', quantity: -1, tradePrice: 200, closingPrice: 150, impliedVolatility: 17 }, { id: 2, optionType: 'Call', strike: 23500, expiryDate: '2025-06-20', openingDate: '2025-04-16', closingDate: '2025-05-16', quantity: 1, tradePrice: 280, closingPrice: 310, impliedVolatility: 16 }] },
      { id: 27, tag: "SP25", status: 'Closed', multiplier: 25, closingDate: '2025-06-20', realizedPnl: 1880, legs: [{ id: 1, optionType: 'Put', strike: 23000, expiryDate: '2025-06-20', openingDate: '2025-05-20', closingDate: '2025-06-20', quantity: -1, tradePrice: 250, closingPrice: 174.8, impliedVolatility: 18 }] },
      { id: 28, tag: "LC26", status: 'Closed', multiplier: 25, closingDate: '2025-07-18', realizedPnl: 3400, legs: [{ id: 1, optionType: 'Call', strike: 24000, expiryDate: '2025-07-18', openingDate: '2025-06-18', closingDate: '2025-07-18', quantity: 2, tradePrice: 180, closingPrice: 248, impliedVolatility: 15 }] },
      { id: 29, tag: "IC27", status: 'Closed', multiplier: 5, closingDate: '2025-08-15', realizedPnl: 910, legs: [{ id: 1, optionType: 'Put', strike: 23500, expiryDate: '2025-08-15', openingDate: '2025-07-15', closingDate: '2025-08-15', quantity: 2, tradePrice: 80, closingPrice: 15, impliedVolatility: 20 }, { id: 2, optionType: 'Put', strike: 24000, expiryDate: '2025-08-15', openingDate: '2025-07-15', closingDate: '2025-08-15', quantity: -2, tradePrice: 150, closingPrice: 25, impliedVolatility: 19 }, { id: 3, optionType: 'Call', strike: 25500, expiryDate: '2025-08-15', openingDate: '2025-07-15', closingDate: '2025-08-15', quantity: -2, tradePrice: 160, closingPrice: 30, impliedVolatility: 16 }, { id: 4, optionType: 'Call', strike: 26000, expiryDate: '2025-08-15', openingDate: '2025-07-15', closingDate: '2025-08-15', quantity: 2, tradePrice: 90, closingPrice: 10, impliedVolatility: 15 }] },
      { id: 30, tag: "ST28", status: 'Closed', multiplier: 25, closingDate: '2025-09-19', realizedPnl: -800, legs: [{ id: 1, optionType: 'Put', strike: 24000, expiryDate: '2025-09-19', openingDate: '2025-08-19', closingDate: '2025-09-19', quantity: -1, tradePrice: 220, closingPrice: 260, impliedVolatility: 19 }, { id: 2, optionType: 'Call', strike: 26000, expiryDate: '2025-09-19', openingDate: '2025-08-19', closingDate: '2025-09-19', quantity: -1, tradePrice: 210, closingPrice: 202, impliedVolatility: 14 }] },
      { id: 31, tag: "LP29", status: 'Closed', multiplier: 25, closingDate: '2025-10-17', realizedPnl: -2100, legs: [{ id: 1, optionType: 'Put', strike: 25000, expiryDate: '2025-10-17', openingDate: '2025-09-17', closingDate: '2025-10-17', quantity: 1, tradePrice: 300, closingPrice: 216, impliedVolatility: 20 }] },
      { id: 32, tag: "BPS30", status: 'Closed', multiplier: 5, closingDate: '2025-11-21', realizedPnl: 480, legs: [{ id: 1, optionType: 'Put', strike: 24000, expiryDate: '2025-11-21', openingDate: '2025-10-21', closingDate: '2025-11-21', quantity: 2, tradePrice: 80, closingPrice: 20, impliedVolatility: 18 }, { id: 2, optionType: 'Put', strike: 24500, expiryDate: '2025-11-21', openingDate: '2025-10-21', closingDate: '2025-11-21', quantity: -2, tradePrice: 160, closingPrice: 40, impliedVolatility: 17 }] },
      { id: 33, tag: "DD31", status: 'Closed', multiplier: 25, closingDate: '2025-12-19', realizedPnl: 3200, legs: [{ id: 1, optionType: 'Put', strike: 24000, expiryDate: '2025-12-19', openingDate: '2025-11-19', closingDate: '2025-12-19', quantity: -2, tradePrice: 150, closingPrice: 50, impliedVolatility: 18 }, { id: 2, optionType: 'Put', strike: 23500, expiryDate: '2026-01-16', openingDate: '2025-11-19', closingDate: '2025-12-19', quantity: 2, tradePrice: 130, closingPrice: 90, impliedVolatility: 19 }] },
      { id: 34, tag: "IC32", status: 'Closed', multiplier: 5, closingDate: '2026-01-16', realizedPnl: 850, legs: [{ id: 1, optionType: 'Put', strike: 24000, expiryDate: '2026-01-16', openingDate: '2025-12-16', closingDate: '2026-01-16', quantity: 1, tradePrice: 90, closingPrice: 10, impliedVolatility: 19 }, { id: 2, optionType: 'Put', strike: 24500, expiryDate: '2026-01-16', openingDate: '2025-12-16', closingDate: '2026-01-16', quantity: -1, tradePrice: 170, closingPrice: 20, impliedVolatility: 18 }, { id: 3, optionType: 'Call', strike: 26500, expiryDate: '2026-01-16', openingDate: '2025-12-16', closingDate: '2026-01-16', quantity: -1, tradePrice: 180, closingPrice: 30, impliedVolatility: 15 }, { id: 4, optionType: 'Call', strike: 27000, expiryDate: '2026-01-16', openingDate: '2025-12-16', closingDate: '2026-01-16', quantity: 1, tradePrice: 100, closingPrice: 10, impliedVolatility: 14 }] },
      { id: 35, tag: "SP33", status: 'Closed', multiplier: 25, closingDate: '2026-02-20', realizedPnl: 2950, legs: [{ id: 1, optionType: 'Put', strike: 25000, expiryDate: '2026-02-20', openingDate: '2026-01-20', closingDate: '2026-02-20', quantity: -2, tradePrice: 220, closingPrice: 102, impliedVolatility: 17 }] },
      { id: 36, tag: "ST34", status: 'Closed', multiplier: 25, closingDate: '2026-03-20', realizedPnl: 2100, legs: [{ id: 1, optionType: 'Put', strike: 24500, expiryDate: '2026-03-20', openingDate: '2026-02-20', closingDate: '2026-03-20', quantity: -1, tradePrice: 190, closingPrice: 120, impliedVolatility: 18 }, { id: 2, optionType: 'Call', strike: 26500, expiryDate: '2026-03-20', openingDate: '2026-02-20', closingDate: '2026-03-20', quantity: -1, tradePrice: 160, closingPrice: 146, impliedVolatility: 15 }] },
      { id: 37, tag: "LC35", status: 'Closed', multiplier: 25, closingDate: '2026-04-17', realizedPnl: -950, legs: [{ id: 1, optionType: 'Call', strike: 26000, expiryDate: '2026-04-17', openingDate: '2026-03-17', closingDate: '2026-04-17', quantity: 1, tradePrice: 250, closingPrice: 212, impliedVolatility: 16 }] },
      { id: 38, tag: "BCS36", status: 'Closed', multiplier: 5, closingDate: '2026-05-15', realizedPnl: -150, legs: [{ id: 1, optionType: 'Call', strike: 26000, expiryDate: '2026-05-15', openingDate: '2026-04-15', closingDate: '2026-05-15', quantity: -1, tradePrice: 200, closingPrice: 250, impliedVolatility: 16 }, { id: 2, optionType: 'Call', strike: 26500, expiryDate: '2026-05-15', openingDate: '2026-04-15', closingDate: '2026-05-15', quantity: 1, tradePrice: 140, closingPrice: 180, impliedVolatility: 15 }] },
      { id: 39, tag: "LP37", status: 'Closed', multiplier: 25, closingDate: '2026-06-19', realizedPnl: 6200, legs: [{ id: 1, optionType: 'Put', strike: 25500, expiryDate: '2026-06-19', openingDate: '2026-05-19', closingDate: '2026-06-19', quantity: 2, tradePrice: 180, closingPrice: 304, impliedVolatility: 20 }] },
      { id: 40, tag: "IC38", status: 'Closed', multiplier: 5, closingDate: '2026-07-17', realizedPnl: 930, legs: [{ id: 1, optionType: 'Put', strike: 24500, expiryDate: '2026-07-17', openingDate: '2026-06-17', closingDate: '2026-07-17', quantity: 2, tradePrice: 100, closingPrice: 15, impliedVolatility: 21 }, { id: 2, optionType: 'Put', strike: 25000, expiryDate: '2026-07-17', openingDate: '2026-06-17', closingDate: '2026-07-17', quantity: -2, tradePrice: 180, closingPrice: 25, impliedVolatility: 20 }, { id: 3, optionType: 'Call', strike: 27000, expiryDate: '2026-07-17', openingDate: '2026-06-17', closingDate: '2026-07-17', quantity: -2, tradePrice: 190, closingPrice: 30, impliedVolatility: 16 }, { id: 4, optionType: 'Call', strike: 27500, expiryDate: '2026-07-17', openingDate: '2026-06-17', closingDate: '2026-07-17', quantity: 2, tradePrice: 110, closingPrice: 10, impliedVolatility: 15 }] },
      { id: 41, tag: "RS39", status: 'Closed', multiplier: 25, closingDate: '2026-08-21', realizedPnl: -1800, legs: [{ id: 1, optionType: 'Call', strike: 26500, expiryDate: '2026-08-21', openingDate: '2026-07-21', closingDate: '2026-08-21', quantity: 1, tradePrice: 220, closingPrice: 400, impliedVolatility: 17 }, { id: 2, optionType: 'Call', strike: 27000, expiryDate: '2026-08-21', openingDate: '2026-07-21', closingDate: '2026-08-21', quantity: -2, tradePrice: 150, closingPrice: 250, impliedVolatility: 16 }] },
      { id: 42, tag: "SP40", status: 'Closed', multiplier: 25, closingDate: '2026-09-18', realizedPnl: 3800, legs: [{ id: 1, optionType: 'Put', strike: 25000, expiryDate: '2026-09-18', openingDate: '2026-08-18', closingDate: '2026-09-18', quantity: -2, tradePrice: 250, closingPrice: 98, impliedVolatility: 19 }] },
      { id: 43, tag: "ST41", status: 'Closed', multiplier: 25, closingDate: '2026-10-16', realizedPnl: 4100, legs: [{ id: 1, optionType: 'Put', strike: 25000, expiryDate: '2026-10-16', openingDate: '2026-09-16', closingDate: '2026-10-16', quantity: -1, tradePrice: 300, closingPrice: 150, impliedVolatility: 20 }, { id: 2, optionType: 'Call', strike: 27500, expiryDate: '2026-10-16', openingDate: '2026-09-16', closingDate: '2026-10-16', quantity: -1, tradePrice: 280, closingPrice: 166, impliedVolatility: 16 }] },
      { id: 44, tag: "CS42", status: 'Closed', multiplier: 25, closingDate: '2026-11-20', realizedPnl: 750, legs: [{ id: 1, optionType: 'Put', strike: 26000, expiryDate: '2026-11-20', openingDate: '2026-10-20', closingDate: '2026-11-20', quantity: -1, tradePrice: 250, closingPrice: 200, impliedVolatility: 19 }, { id: 2, optionType: 'Put', strike: 26000, expiryDate: '2026-12-18', openingDate: '2026-10-20', closingDate: '2026-11-20', quantity: 1, tradePrice: 310, closingPrice: 290, impliedVolatility: 18 }] },
      { id: 45, tag: "IC43", status: 'Closed', multiplier: 5, closingDate: '2026-12-18', realizedPnl: 880, legs: [{ id: 1, optionType: 'Put', strike: 25500, expiryDate: '2026-12-18', openingDate: '2026-11-18', closingDate: '2026-12-18', quantity: 1, tradePrice: 110, closingPrice: 20, impliedVolatility: 20 }, { id: 2, optionType: 'Put', strike: 26000, expiryDate: '2026-12-18', openingDate: '2026-11-18', closingDate: '2026-12-18', quantity: -1, tradePrice: 200, closingPrice: 40, impliedVolatility: 19 }, { id: 3, optionType: 'Call', strike: 28000, expiryDate: '2026-12-18', openingDate: '2026-11-18', closingDate: '2026-12-18', quantity: -1, tradePrice: 210, closingPrice: 50, impliedVolatility: 15 }, { id: 4, optionType: 'Call', strike: 28500, expiryDate: '2026-12-18', openingDate: '2026-11-18', closingDate: '2026-12-18', quantity: 1, tradePrice: 120, closingPrice: 20, impliedVolatility: 14 }] },
      { id: 46, tag: "DD44", status: 'Closed', multiplier: 25, closingDate: '2027-01-15', realizedPnl: -1200, legs: [{ id: 1, optionType: 'Call', strike: 28000, expiryDate: '2027-01-15', openingDate: '2026-12-15', closingDate: '2027-01-15', quantity: -1, tradePrice: 180, closingPrice: 250, impliedVolatility: 16 }, { id: 2, optionType: 'Call', strike: 28500, expiryDate: '2027-02-19', openingDate: '2026-12-15', closingDate: '2027-01-15', quantity: 1, tradePrice: 160, closingPrice: 190, impliedVolatility: 17 }] },
      { id: 47, tag: "LC45", status: 'Closed', multiplier: 25, closingDate: '2027-02-19', realizedPnl: 4800, legs: [{ id: 1, optionType: 'Call', strike: 27500, expiryDate: '2027-02-19', openingDate: '2027-01-19', closingDate: '2027-02-19', quantity: 2, tradePrice: 200, closingPrice: 296, impliedVolatility: 15 }] },
      { id: 48, tag: "SP46", status: 'Closed', multiplier: 25, closingDate: '2027-03-19', realizedPnl: -3300, legs: [{ id: 1, optionType: 'Put', strike: 28000, expiryDate: '2027-03-19', openingDate: '2027-02-19', closingDate: '2027-03-19', quantity: -2, tradePrice: 150, closingPrice: 315, impliedVolatility: 19 }] },
      { id: 49, tag: "BPS47", status: 'Closed', multiplier: 5, closingDate: '2027-04-16', realizedPnl: 510, legs: [{ id: 1, optionType: 'Put', strike: 27000, expiryDate: '2027-04-16', openingDate: '2027-03-16', closingDate: '2027-04-16', quantity: 3, tradePrice: 90, closingPrice: 30, impliedVolatility: 18 }, { id: 2, optionType: 'Put', strike: 27500, expiryDate: '2027-04-16', openingDate: '2027-03-16', closingDate: '2027-04-16', quantity: -3, tradePrice: 170, closingPrice: 60, impliedVolatility: 17 }] },
      { id: 50, tag: "IC48", status: 'Closed', multiplier: 5, closingDate: '2027-05-21', realizedPnl: 950, legs: [{ id: 1, optionType: 'Put', strike: 26500, expiryDate: '2027-05-21', openingDate: '2027-04-21', closingDate: '2027-05-21', quantity: 1, tradePrice: 120, closingPrice: 10, impliedVolatility: 22 }, { id: 2, optionType: 'Put', strike: 27000, expiryDate: '2027-05-21', openingDate: '2027-04-21', closingDate: '2027-05-21', quantity: -1, tradePrice: 210, closingPrice: 20, impliedVolatility: 20 }, { id: 3, optionType: 'Call', strike: 29000, expiryDate: '2027-05-21', openingDate: '2027-04-21', closingDate: '2027-05-21', quantity: -1, tradePrice: 220, closingPrice: 30, impliedVolatility: 17 }, { id: 4, optionType: 'Call', strike: 29500, expiryDate: '2027-05-21', openingDate: '2027-04-21', closingDate: '2027-05-21', quantity: 1, tradePrice: 130, closingPrice: 10, impliedVolatility: 16 }] },
      { id: 51, tag: "LP49", status: 'Closed', multiplier: 25, closingDate: '2027-06-18', realizedPnl: 2900, legs: [{ id: 1, optionType: 'Put', strike: 28000, expiryDate: '2027-06-18', openingDate: '2027-05-18', closingDate: '2027-06-18', quantity: 1, tradePrice: 250, closingPrice: 366, impliedVolatility: 20 }] },
      { id: 52, tag: "ST50", status: 'Closed', multiplier: 25, closingDate: '2027-07-16', realizedPnl: 3300, legs: [{ id: 1, optionType: 'Put', strike: 27500, expiryDate: '2027-07-16', openingDate: '2027-06-16', closingDate: '2027-07-16', quantity: -1, tradePrice: 280, closingPrice: 180, impliedVolatility: 19 }, { id: 2, optionType: 'Call', strike: 29500, expiryDate: '2027-07-16', openingDate: '2027-06-16', closingDate: '2027-07-16', quantity: -1, tradePrice: 260, closingPrice: 194, impliedVolatility: 15 }] },
      { id: 53, tag: "BCS51", status: 'Closed', multiplier: 5, closingDate: '2027-08-20', realizedPnl: 490, legs: [{ id: 1, optionType: 'Call', strike: 29000, expiryDate: '2027-08-20', openingDate: '2027-07-20', closingDate: '2027-08-20', quantity: -2, tradePrice: 220, closingPrice: 150, impliedVolatility: 16 }, { id: 2, optionType: 'Call', strike: 29500, expiryDate: '2027-08-20', openingDate: '2027-07-20', closingDate: '2027-08-20', quantity: 2, tradePrice: 150, closingPrice: 101, impliedVolatility: 15 }] },
      { id: 54, tag: "IC52", status: 'Closed', multiplier: 5, closingDate: '2027-09-17', realizedPnl: 980, legs: [{ id: 1, optionType: 'Put', strike: 28000, expiryDate: '2027-09-17', openingDate: '2027-08-17', closingDate: '2027-09-17', quantity: 2, tradePrice: 130, closingPrice: 20, impliedVolatility: 21 }, { id: 2, optionType: 'Put', strike: 28500, expiryDate: '2027-09-17', openingDate: '2027-08-17', closingDate: '2027-09-17', quantity: -2, tradePrice: 220, closingPrice: 30, impliedVolatility: 19 }, { id: 3, optionType: 'Call', strike: 30500, expiryDate: '2027-09-17', openingDate: '2027-08-17', closingDate: '2027-09-17', quantity: -2, tradePrice: 230, closingPrice: 40, impliedVolatility: 16 }, { id: 4, optionType: 'Call', strike: 31000, expiryDate: '2027-09-17', openingDate: '2027-08-17', closingDate: '2027-09-17', quantity: 2, tradePrice: 140, closingPrice: 10, impliedVolatility: 15 }] },
      { id: 55, tag: "SP53", status: 'Closed', multiplier: 25, closingDate: '2027-10-15', realizedPnl: 5100, legs: [{ id: 1, optionType: 'Put', strike: 29000, expiryDate: '2027-10-15', openingDate: '2027-09-15', closingDate: '2027-10-15', quantity: -3, tradePrice: 280, closingPrice: 112, impliedVolatility: 18 }] },
      { id: 56, tag: "RS54", status: 'Closed', multiplier: 25, closingDate: '2027-11-19', realizedPnl: 2400, legs: [{ id: 1, optionType: 'Call', strike: 29500, expiryDate: '2027-11-19', openingDate: '2027-10-19', closingDate: '2027-11-19', quantity: 2, tradePrice: 180, closingPrice: 350, impliedVolatility: 16 }, { id: 2, optionType: 'Call', strike: 30000, expiryDate: '2027-11-19', openingDate: '2027-10-19', closingDate: '2027-11-19', quantity: -3, tradePrice: 120, closingPrice: 200, impliedVolatility: 15 }] },
      { id: 57, tag: "DD55", status: 'Closed', multiplier: 25, closingDate: '2027-12-17', realizedPnl: 1900, legs: [{ id: 1, optionType: 'Put', strike: 28500, expiryDate: '2027-12-17', openingDate: '2027-11-17', closingDate: '2027-12-17', quantity: -1, tradePrice: 200, closingPrice: 150, impliedVolatility: 19 }, { id: 2, optionType: 'Put', strike: 28000, expiryDate: '2028-01-21', openingDate: '2027-11-17', closingDate: '2027-12-17', quantity: 1, tradePrice: 180, closingPrice: 154, impliedVolatility: 20 }] },
      { id: 58, tag: "IC56", status: 'Closed', multiplier: 5, closingDate: '2028-01-21', realizedPnl: 1020, legs: [{ id: 1, optionType: 'Put', strike: 28000, expiryDate: '2028-01-21', openingDate: '2027-12-21', closingDate: '2028-01-21', quantity: 1, tradePrice: 150, closingPrice: 10, impliedVolatility: 22 }, { id: 2, optionType: 'Put', strike: 28500, expiryDate: '2028-01-21', openingDate: '2027-12-21', closingDate: '2028-01-21', quantity: -1, tradePrice: 250, closingPrice: 20, impliedVolatility: 20 }, { id: 3, optionType: 'Call', strike: 31000, expiryDate: '2028-01-21', openingDate: '2027-12-21', closingDate: '2028-01-21', quantity: -1, tradePrice: 260, closingPrice: 30, impliedVolatility: 17 }, { id: 4, optionType: 'Call', strike: 31500, expiryDate: '2028-01-21', openingDate: '2027-12-21', closingDate: '2028-01-21', quantity: 1, tradePrice: 160, closingPrice: 10, impliedVolatility: 16 }] },
      { id: 59, tag: "LC57", status: 'Closed', multiplier: 25, closingDate: '2028-02-18', realizedPnl: -2950, legs: [{ id: 1, optionType: 'Call', strike: 30000, expiryDate: '2028-02-18', openingDate: '2028-01-18', closingDate: '2028-02-18', quantity: 1, tradePrice: 400, closingPrice: 282, impliedVolatility: 16 }] },
      { id: 60, tag: "ST58", status: 'Closed', multiplier: 25, closingDate: '2028-03-17', realizedPnl: -5200, legs: [{ id: 1, optionType: 'Put', strike: 29000, expiryDate: '2028-03-17', openingDate: '2028-02-17', closingDate: '2028-03-17', quantity: -2, tradePrice: 200, closingPrice: 350, impliedVolatility: 21 }, { id: 2, optionType: 'Call', strike: 31500, expiryDate: '2028-03-17', openingDate: '2028-02-17', closingDate: '2028-03-17', quantity: -2, tradePrice: 180, closingPrice: 210, impliedVolatility: 16 }] },
      { id: 61, tag: "SP59", status: 'Closed', multiplier: 25, closingDate: '2028-04-21', realizedPnl: 4300, legs: [{ id: 1, optionType: 'Put', strike: 29500, expiryDate: '2028-04-21', openingDate: '2028-03-21', closingDate: '2028-04-21', quantity: -2, tradePrice: 300, closingPrice: 128, impliedVolatility: 19 }] },
      { id: 62, tag: "IC60", status: 'Closed', multiplier: 5, closingDate: '2028-05-19', realizedPnl: 1100, legs: [{ id: 1, optionType: 'Put', strike: 29000, expiryDate: '2028-05-19', openingDate: '2028-04-19', closingDate: '2028-05-19', quantity: 2, tradePrice: 160, closingPrice: 20, impliedVolatility: 21 }, { id: 2, optionType: 'Put', strike: 29500, expiryDate: '2028-05-19', openingDate: '2028-04-19', closingDate: '2028-05-19', quantity: -2, tradePrice: 260, closingPrice: 30, impliedVolatility: 20 }, { id: 3, optionType: 'Call', strike: 32000, expiryDate: '2028-05-19', openingDate: '2028-04-19', closingDate: '2028-05-19', quantity: -2, tradePrice: 270, closingPrice: 40, impliedVolatility: 16 }, { id: 4, optionType: 'Call', strike: 32500, expiryDate: '2028-05-19', openingDate: '2028-04-19', closingDate: '2028-05-19', quantity: 2, tradePrice: 170, closingPrice: 10, impliedVolatility: 15 }] }
];

const usePortfolioStore = create<PortfolioState>((set, get) => {
  // Safety check: Ensure all legs have an expiryDate. If missing in closed structures, fallback to closingDate.
  const safeStructures = initialStructures.map(s => ({
    ...s,
    legs: s.legs.map(leg => ({
      ...leg,
      expiryDate: leg.expiryDate || (s.status === 'Closed' ? s.closingDate! : leg.expiryDate)
    }))
  }));

  return {
    structures: safeStructures,
    marketData: {
      daxSpot: 21885.79,
      riskFreeRate: 2.61,
    },
    nextStructureId: 67,
    currentView: 'list',
    currentStructureId: null,

    addStructure: (structure) => set((state) => ({ 
        structures: [...state.structures, { ...structure, id: state.nextStructureId, status: 'Active' }],
        nextStructureId: state.nextStructureId + 1,
    })),
      addHistoricalStructures: (structuresData) => set(state => {
          const { settings } = useSettingsStore.getState();
          let nextId = state.nextStructureId;
          const newStructures = structuresData.map(data => {
              const structure: Structure = {
                  id: nextId++,
                  tag: data.tag,
                  status: 'Closed',
                  multiplier: 25, // Defaulting to 25 as it's the most common
                  closingDate: data.closingDate,
                  realizedPnl: data.realizedPnl,
                  legs: data.legs.map((leg, index) => ({
                      ...leg,
                      id: index + 1,
                      closingDate: data.closingDate,
                      impliedVolatility: 15, // Default IV
                      openingCommission: settings.defaultOpeningCommission,
                      closingCommission: settings.defaultClosingCommission,
                  })),
              };
              return structure;
          });
          
          return {
              structures: [...state.structures, ...newStructures],
              nextStructureId: nextId,
          }
      }),
    updateStructure: (updatedStructure) => set((state) => ({
        structures: state.structures.map(s => s.id === updatedStructure.id ? updatedStructure : s),
    })),
    deleteStructure: (structureId) => set((state) => ({
        structures: state.structures.filter(s => s.id !== structureId),
    })),
    deleteStructures: (structureIds) => set((state) => {
      const idsToDelete = new Set(structureIds);
      return {
          structures: state.structures.filter(s => !idsToDelete.has(s.id)),
      };
    }),
    closeStructure: (structureId) => set((state) => {
      const marketData = get().marketData;
      const { settings } = useSettingsStore.getState();
      const today = new Date().toISOString().split('T')[0];
      const structures = state.structures.map(s => {
          if (s.id === structureId) {
              
              const finalLegs = s.legs.map(leg => {
                  if (leg.closingPrice !== null && leg.closingPrice !== undefined) {
                      return leg; // Gamba già chiusa
                  }
                  // Chiude la gamba al prezzo di mercato attuale
                  const timeToExpiry = getTimeToExpiry(leg.expiryDate);
                  let closingPrice;
                  if (timeToExpiry > 0) {
                      const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                      closingPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
                  } else { // A scadenza
                      closingPrice = leg.optionType === 'Call' 
                          ? Math.max(0, marketData.daxSpot - leg.strike) 
                          : Math.max(0, leg.strike - marketData.daxSpot);
                  }
                  return { ...leg, closingPrice, closingDate: today };
              });

              const totalRealizedPnl = finalLegs.reduce((acc, leg) => {
                  let pnlPoints = 0;
                  // FIX: Correct and explicit P&L logic for both long and short positions.
                  if (leg.quantity > 0) { // Long position
                      pnlPoints = (leg.closingPrice! - leg.tradePrice) * leg.quantity;
                  } else { // Short position
                      pnlPoints = (leg.tradePrice - leg.closingPrice!) * Math.abs(leg.quantity);
                  }
                  // The final monetary value is P&L in points multiplied by the contract multiplier.
                  const grossPnlEuro = pnlPoints * s.multiplier;
                  
                  // Subtract commissions
                  const openingCommission = (leg.openingCommission ?? settings.defaultOpeningCommission) * Math.abs(leg.quantity);
                  const closingCommission = (leg.closingCommission ?? settings.defaultClosingCommission) * Math.abs(leg.quantity);
                  const netPnlEuro = grossPnlEuro - openingCommission - closingCommission;

                  return acc + netPnlEuro;
              }, 0);

              return { 
                  ...s, 
                  status: 'Closed', 
                  legs: finalLegs,
                  realizedPnl: totalRealizedPnl, 
                  closingDate: today
              };
          }
          return s;
      });
      return { structures };
    }),
    reopenStructure: (structureId) => set((state) => ({
        structures: state.structures.map(s => {
            if (s.id === structureId) {
                const { closingDate, realizedPnl, ...rest } = s;
                const reopenedLegs = s.legs.map(leg => {
                    const { closingPrice, closingDate, ...legRest } = leg;
                    return {
                        ...legRest,
                        closingPrice: null,
                        closingDate: null,
                    };
                });
                return {
                    ...rest,
                    status: 'Active',
                    legs: reopenedLegs,
                };
            }
            return s;
        }),
    })),
    setMarketData: (data) => set((state) => ({
        marketData: { ...state.marketData, ...data }
    })),
    setCurrentView: (view, structureId = null) => set({
        currentView: view,
        currentStructureId: structureId,
    }),
  };
});

export default usePortfolioStore;
