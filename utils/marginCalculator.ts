import { Structure, MarketData, Settings } from '../types';

/**
 * Calculates the theoretical margin occupied by a structure.
 * 
 * Logic:
 * 1. Base Margin: Maximum risk (loss) of the structure at the earliest expiry date.
 * 2. Additional Saxo Margin (only for BGSaxo/Saxo Bank): 0.3% of the strike for each sold leg.
 */
export function calculateStructureMargin(structure: Structure, marketData: MarketData, settings: Settings): number {
    if (structure.status === 'Closed') return 0;

    const legs = structure.legs.filter(l => l.enabled !== false);
    if (legs.length === 0) return 0;

    // 1. Calculate Max Risk (Base Margin)
    // We sample the payoff at expiry at critical points: strikes, current spot, and far wings.
    const strikes = legs.map(l => l.strike);
    const currentSpot = marketData.daxSpot;
    const minStrike = Math.min(...strikes, currentSpot);
    const maxStrike = Math.max(...strikes, currentSpot);
    
    // Use a wide enough range to catch tail risks for naked options
    const spread = Math.max(maxStrike - minStrike, currentSpot * 0.2);
    
    const samplePoints = [
        ...strikes,
        currentSpot,
        Math.max(0, minStrike - spread),
        maxStrike + spread,
        // Add some intermediate points just in case
        minStrike - spread / 2,
        maxStrike + spread / 2
    ];

    // Find the earliest expiry date among open legs
    const openLegs = legs.filter(l => l.closingPrice === null || l.closingPrice === undefined);
    if (openLegs.length === 0) return 0;

    const expiryDates = openLegs.map(l => new Date(l.expiryDate).getTime());
    const earliestExpiryTime = Math.min(...expiryDates);
    const earliestExpiryDate = new Date(earliestExpiryTime);
    earliestExpiryDate.setHours(13, 0, 0, 0);

    let maxLossPoints = 0;

    samplePoints.forEach(spot => {
        let pnlPoints = 0;
        legs.forEach(leg => {
            const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;
            const tradePrice = leg.tradePrice;
            
            let valAtExpiry = 0;
            if (isClosed) {
                valAtExpiry = leg.closingPrice!;
            } else {
                // Use pure intrinsic value at the earliest expiry date.
                // This follows the "Delta Strike" logic requested by the user:
                // Risk is the strike difference minus net credit, ignoring extrinsic value
                // of longer-dated legs for margin safety.
                valAtExpiry = leg.optionType === 'Call'
                    ? Math.max(0, spot - leg.strike)
                    : Math.max(0, leg.strike - spot);
            }
            pnlPoints += (valAtExpiry - tradePrice) * leg.quantity;
        });

        if (pnlPoints < 0) {
            maxLossPoints = Math.max(maxLossPoints, Math.abs(pnlPoints));
        }
    });

    const baseMarginEuro = maxLossPoints * structure.multiplier;

    // 2. Additional Saxo Margin (0.3% of Strike for sold legs)
    let additionalSaxoMarginEuro = 0;
    const isSaxo = settings.broker === 'BGSaxo' || settings.broker === 'Saxo Bank';

    if (isSaxo) {
        legs.forEach(leg => {
            const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;
            if (!isClosed && leg.quantity < 0) {
                // Additional margin = 0.3% of strike * multiplier * abs(quantity)
                const marginPoints = leg.strike * 0.003;
                additionalSaxoMarginEuro += marginPoints * structure.multiplier * Math.abs(leg.quantity);
            }
        });
    }

    return baseMarginEuro + additionalSaxoMarginEuro;
}
