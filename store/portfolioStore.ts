
import { create } from 'zustand';
import { Structure, OptionLeg, MarketData, UserProfile } from '../types';
import { fetchMarketData } from '../services/marketData';
import { supabase } from '../services/supabaseClient';
import { BlackScholes, getYearFraction } from '../services/blackScholes';

interface PortfolioState {
  structures: Structure[];
  marketData: MarketData;
  currentView: 'list' | 'detail' | 'settings' | 'analysis' | 'admin' | 'shared' | 'calculator';
  currentStructureId: string | 'new' | null;
  isLoading: boolean;
  isLoadingSpot: boolean;
  isPriceDelayed: boolean;
  lastUpdate: Date | null;
  
  fetchStructures: () => Promise<void>;
  addStructure: (structure: Omit<Structure, 'id' | 'status'>) => Promise<void>;
  updateStructure: (structure: Structure) => Promise<void>;
  deleteStructure: (structureId: string) => Promise<void>;
  deleteStructures: (structureIds: string[]) => Promise<void>;
  closeStructure: (structureId: string, realizedPnl: number) => Promise<void>;
  reopenStructure: (structureId: string) => Promise<void>;
  setCurrentView: (view: PortfolioState['currentView'], id?: string | 'new' | null) => void;
  setMarketData: (data: Partial<MarketData>) => void;
  fetchSharedStructures: () => Promise<Structure[]>;
  importStructure: (structureId: string) => Promise<void>;
  refreshDaxSpot: () => Promise<void>;
}

const usePortfolioStore = create<PortfolioState>((set, get) => ({
  structures: [],
  marketData: { daxSpot: 24500, daxVolatility: 15, riskFreeRate: 2.61, lastUpdate: Date.now() },
  currentView: 'list',
  currentStructureId: null,
  isLoading: false,
  isLoadingSpot: false,
  isPriceDelayed: false,
  lastUpdate: null,

  fetchStructures: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ isLoading: false }); return; }

      // Fetch ONLY user's own structures (or imported ones)
      const { data, error } = await supabase
        .from('structures')
        .select(`*, legs(*)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const normalized = (data as any[]).map(s => ({
          id: s.id,
          tag: s.tag,
          status: s.status,
          multiplier: s.multiplier,
          closingDate: s.closing_date,
          realizedPnl: s.realized_pnl,
          createdAt: s.created_at,
          isShared: s.is_shared, // Map new column
          legs: (s.legs || []).map((l: any) => ({
            id: l.id,
            optionType: l.option_type,
            strike: l.strike,
            expiryDate: l.expiry_date,
            quantity: l.quantity,
            tradePrice: l.trade_price,
            openingDate: l.opening_date,
            closingPrice: l.closing_price,
            closingDate: l.closing_date,
            impliedVolatility: l.implied_volatility,
            openingCommission: l.opening_commission,
            closingCommission: l.closing_commission,
            manualCurrentPrice: l.manual_current_price
          }))
        }));
        set({ structures: normalized as Structure[] });
      }
    } catch (error) {
      console.error("[PortfolioStore] Fetch Error:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSharedStructures: async () => {
    try {
        // Fetch all structures where is_shared is true
        // No need to filter by admin role if we trust the flag, 
        // but typically only admins can set this flag anyway.
        const { data, error } = await supabase
            .from('structures')
            .select(`*, legs(*)`)
            .eq('is_shared', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;

        if (data) {
            return (data as any[]).map(s => ({
              id: s.id,
              tag: s.tag,
              status: s.status,
              multiplier: s.multiplier,
              closingDate: s.closing_date,
              realizedPnl: s.realized_pnl,
              createdAt: s.created_at,
              isShared: s.is_shared,
              legs: (s.legs || []).map((l: any) => ({
                id: l.id,
                optionType: l.option_type,
                strike: l.strike,
                expiryDate: l.expiry_date,
                quantity: l.quantity,
                tradePrice: l.trade_price,
                openingDate: l.opening_date,
                closingPrice: l.closing_price,
                closingDate: l.closing_date,
                impliedVolatility: l.implied_volatility,
                openingCommission: l.opening_commission,
                closingCommission: l.closing_commission,
                manualCurrentPrice: l.manual_current_price
              }))
            })) as Structure[];
        }
        return [];
    } catch (error) {
        console.error("Error fetching shared structures:", error);
        return [];
    }
  },

  importStructure: async (structureId: string) => {
    set({ isLoading: true });
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        // 1. Fetch the original structure and legs
        const { data: original, error: fetchError } = await supabase
            .from('structures')
            .select(`*, legs(*)`)
            .eq('id', structureId)
            .single();
        
        if (fetchError || !original) throw new Error("Struttura originale non trovata");

        // Check if legs exist (if RLS blocks them, this will be empty)
        if (!original.legs || original.legs.length === 0) {
            throw new Error("La struttura condivisa non ha gambe visibili. Potrebbe essere un problema di permessi (RLS) sulla tabella 'legs'.");
        }

        // 2. Create a copy for the current user
        const { data: newStruct, error: createError } = await supabase
            .from('structures')
            .insert([{
                tag: `${original.tag} (Imported)`,
                multiplier: original.multiplier,
                status: 'Active', // Always import as active
                user_id: user.id
            }])
            .select()
            .single();
        
        if (createError || !newStruct) throw createError;

        // 3. Copy legs
        if (original.legs && original.legs.length > 0) {
            const legsToInsert = original.legs.map((leg: any) => ({
                structure_id: newStruct.id,
                user_id: user.id,
                option_type: leg.option_type,
                strike: leg.strike,
                expiry_date: leg.expiry_date,
                quantity: leg.quantity,
                trade_price: leg.trade_price,
                opening_date: leg.opening_date,
                // Reset closing info for imported structure? Or keep history?
                // Usually importing means starting fresh or copying history. 
                // Let's copy history but keep it open if the original was open.
                closing_price: leg.closing_price,
                closing_date: leg.closing_date,
                implied_volatility: leg.implied_volatility,
                opening_commission: leg.opening_commission,
                closing_commission: leg.closing_commission,
                manual_current_price: leg.manual_current_price
            }));
            
            const { error: legsError } = await supabase.from('legs').insert(legsToInsert);
            if (legsError) throw legsError;
        }

        // 4. Refresh user's structures
        await get().fetchStructures();
        
        // 5. Switch to list view
        set({ currentView: 'list' });

    } catch (error) {
        console.error("Error importing structure:", error);
        throw error;
    } finally {
        set({ isLoading: false });
    }
  },

  addStructure: async (newStructure) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: structData, error: structError } = await supabase
      .from('structures')
      .insert([{ 
        tag: newStructure.tag, 
        multiplier: newStructure.multiplier, 
        status: 'Active', 
        user_id: user.id,
        is_shared: newStructure.isShared || false
      }])
      .select()
      .single();

    if (structError || !structData) throw structError;

    if (newStructure.legs.length > 0) {
      const legsToInsert = newStructure.legs.map(leg => ({ 
        structure_id: structData.id, 
        user_id: user.id,
        option_type: leg.optionType,
        strike: leg.strike,
        expiry_date: leg.expiryDate,
        quantity: leg.quantity,
        trade_price: leg.tradePrice,
        opening_date: leg.openingDate,
        closing_price: leg.closingPrice,
        closing_date: leg.closingDate,
        implied_volatility: leg.impliedVolatility,
        opening_commission: leg.openingCommission,
        closing_commission: leg.closingCommission,
        manual_current_price: leg.manualCurrentPrice
      }));
      const { error: legsError } = await supabase.from('legs').insert(legsToInsert);
      if (legsError) throw legsError;
    }
    
    await get().fetchStructures();
  },

  updateStructure: async (updatedStructure) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: structError } = await supabase
      .from('structures')
      .update({ 
        tag: updatedStructure.tag, 
        multiplier: updatedStructure.multiplier, 
        status: updatedStructure.status,
        closing_date: updatedStructure.closingDate,
        realized_pnl: updatedStructure.realizedPnl,
        is_shared: updatedStructure.isShared || false
      })
      .eq('id', updatedStructure.id);

    if (structError) throw structError;

    await supabase.from('legs').delete().eq('structure_id', updatedStructure.id);
    
    if (updatedStructure.legs.length > 0) {
      const legsToInsert = updatedStructure.legs.map(leg => ({ 
        structure_id: updatedStructure.id, 
        user_id: user.id,
        option_type: leg.optionType,
        strike: leg.strike,
        expiry_date: leg.expiryDate,
        quantity: leg.quantity,
        trade_price: leg.tradePrice,
        opening_date: leg.openingDate,
        closing_price: leg.closingPrice,
        closing_date: leg.closingDate,
        implied_volatility: leg.impliedVolatility,
        opening_commission: leg.openingCommission,
        closing_commission: leg.closingCommission,
        manual_current_price: leg.manualCurrentPrice
      }));
      const { error: legsError } = await supabase.from('legs').insert(legsToInsert);
      if (legsError) throw legsError;
    }
    
    await get().fetchStructures();
  },

  deleteStructure: async (structureId) => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      // 1. Delete legs associated with this structure
      const { error: legsError } = await supabase
        .from('legs')
        .delete()
        .eq('structure_id', structureId);
      
      if (legsError) throw legsError;

      // 2. Then delete the structure
      const { error: structError } = await supabase
        .from('structures')
        .delete()
        .eq('id', structureId);
      
      if (structError) throw structError;
      
      set(state => ({ 
        structures: state.structures.filter(s => s.id !== structureId) 
      }));
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteStructures: async (structureIds) => {
    if (!structureIds || structureIds.length === 0) return;
    
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato. Effettua nuovamente il login.");

      console.log("Tentativo di eliminazione strutture:", structureIds);

      // 1. Delete legs associated with these structures
      // We don't strictly check count here as some structures might not have legs
      const { error: legsError } = await supabase
        .from('legs')
        .delete()
        .in('structure_id', structureIds);
      
      if (legsError) {
        console.error("Errore eliminazione gambe:", legsError);
        throw new Error(`Errore eliminazione gambe: ${legsError.message}`);
      }

      // 2. Then delete the structures and select the deleted rows to verify
      const { data: deletedData, error: structError } = await supabase
        .from('structures')
        .delete()
        .in('id', structureIds)
        .select();
        
      if (structError) {
        console.error("Errore eliminazione strutture:", structError);
        throw new Error(`Errore eliminazione strutture: ${structError.message}`);
      }

      // Check if rows were actually deleted (RLS might silently block deletion)
      if (!deletedData || deletedData.length === 0) {
        console.warn("Nessuna struttura eliminata. Possibile problema di permessi (RLS).");
        throw new Error("Nessuna struttura eliminata. Verifica di avere i permessi necessari o che le strutture esistano.");
      }

      console.log("Strutture eliminate con successo:", deletedData.length);

      set(state => ({ 
        structures: state.structures.filter(s => !structureIds.includes(s.id)) 
      }));
    } catch (error: any) {
      console.error("Errore durante l'eliminazione multipla:", error);
      throw error; // Re-throw to be caught by the UI
    } finally {
      set({ isLoading: false });
    }
  },

  closeStructure: async (structureId, realizedPnl) => {
    const { error } = await supabase
      .from('structures')
      .update({ 
        status: 'Closed', 
        closing_date: new Date().toISOString().split('T')[0],
        realized_pnl: realizedPnl
      })
      .eq('id', structureId);
    
    if (error) throw error;
    await get().fetchStructures();
  },

  reopenStructure: async (structureId) => {
    const { error } = await supabase
      .from('structures')
      .update({ 
        status: 'Active', 
        closing_date: null,
        realized_pnl: null
      })
      .eq('id', structureId);
    
    if (error) throw error;
    await get().fetchStructures();
  },

  setCurrentView: (view, id = null) => set({ currentView: view, currentStructureId: id }),
  setMarketData: (data) => set((state) => ({ marketData: { ...state.marketData, ...data } })),

  refreshDaxSpot: async () => {
    set({ isLoadingSpot: true });
    try {
        const marketData = await fetchMarketData();
        
        if (marketData) {
            const { daxSpot, daxVolatility: fetchedVol } = marketData;
            // Use fetched volatility if valid, otherwise default to 15 as requested
            const daxVolatility = fetchedVol > 0 ? fetchedVol : 15;
            const isVolatilityFallback = fetchedVol <= 0;
            
            const now = new Date();

            set((state) => {
                // Calculate real-time prices for all active legs
                const updatedStructures = state.structures.map(structure => {
                    if (structure.status === 'Closed') return structure;

                    const updatedLegs = structure.legs.map(leg => {
                        if (leg.closingDate) return leg; // Already closed

                        const timeToExpiry = getYearFraction(now.toISOString(), leg.expiryDate);
                        
                        // Use VDAX as the base IV, potentially adjusted by the leg's original IV spread if we had that info.
                        // For now, we use VDAX directly as the market IV proxy.
                        const currentIv = daxVolatility; 

                        let currentPrice = 0;
                        if (timeToExpiry <= 0) {
                            // Expired
                            currentPrice = leg.optionType === 'Call' 
                                ? Math.max(0, daxSpot - leg.strike) 
                                : Math.max(0, leg.strike - daxSpot);
                        } else {
                            const bs = new BlackScholes(
                                daxSpot, 
                                leg.strike, 
                                timeToExpiry, 
                                state.marketData.riskFreeRate, 
                                currentIv
                            );
                            currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
                        }

                        return {
                            ...leg,
                            currentPrice,
                            currentIv
                        };
                    });

                    return { ...structure, legs: updatedLegs };
                });

                return { 
                    marketData: { 
                        ...state.marketData, 
                        daxSpot, 
                        daxVolatility,
                        lastUpdate: Date.now(),
                        isVolatilityFallback
                    }, 
                    structures: updatedStructures,
                    isLoadingSpot: false, 
                    isPriceDelayed: false, 
                    lastUpdate: now 
                };
            });
        } else {
            set({ isLoadingSpot: false, isPriceDelayed: true });
        }
    } catch (error) {
        console.error("Error refreshing market data:", error);
        set({ isLoadingSpot: false, isPriceDelayed: true });
    }
  },
}));

export default usePortfolioStore;
