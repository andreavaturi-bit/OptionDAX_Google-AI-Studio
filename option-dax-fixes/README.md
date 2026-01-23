# Option DAX - Bug Fixes & Improvements

Questa cartella contiene tutti i file corretti per il progetto Option DAX.

## Come applicare i fix

1. **Copia i file nella posizione corrispondente** del tuo progetto, sovrascrivendo i file esistenti
2. I file nella cartella `shared/` sono **NUOVI** - creali se non esistono
3. Il file `server/_core/rateLimiter.ts` è **NUOVO** - crealo se non esiste

## Struttura dei file

```
option-dax-fixes/
├── shared/
│   ├── blackScholes.ts      [NUOVO] Modulo Black-Scholes unificato
│   └── optionTypes.ts       [NUOVO] Schema Zod per validazione OptionLeg
├── server/
│   ├── _core/
│   │   └── rateLimiter.ts   [NUOVO] Rate limiter per API
│   └── routers/
│       ├── analysis.ts      [MODIFICATO] Usa modulo BS unificato
│       ├── marketData.ts    [MODIFICATO] Rate limiting + caching
│       └── optionStructures.ts [MODIFICATO] Validazione + BS unificato
└── client/
    └── src/
        └── components/
            ├── SettingsView.tsx     [MODIFICATO] Fix tema dark/light
            ├── GreeksCalculator.tsx [MODIFICATO] Fix tema dark/light
            ├── PayoffSimulator.tsx  [MODIFICATO] Fix tema dark/light
            └── PayoffChart.tsx      [MODIFICATO] Fix tema dark/light + colori dinamici
```

## Riepilogo dei fix

### Fix Critici (Backend)
- ✅ Unificato Black-Scholes (eliminata duplicazione codice)
- ✅ Protezione divisione per zero
- ✅ Rimosso logging dati sensibili
- ✅ Aggiunto rate limiting (10 req/min API esterne)
- ✅ Sostituito `z.any()` con validazione Zod corretta

### Fix Calcoli Finanziari
- ✅ Implied Volatility con upper bound e fallback bisection
- ✅ Break-even con interpolazione lineare (più preciso)
- ✅ Consistenza anno 365.25 giorni

### Fix Frontend (Tema)
- ✅ SettingsView.tsx - colori tema-aware
- ✅ GreeksCalculator.tsx - fix `bg-[#0a0a0f]` illeggibile
- ✅ PayoffSimulator.tsx - fix `bg-[#0a0a0f]` illeggibile
- ✅ PayoffChart.tsx - colori chart dinamici con `useTheme()`

## Note importanti

- I file usano le variabili CSS già definite nel progetto (`--card`, `--foreground`, etc.)
- Il rate limiter è in-memory, ideale per sviluppo. Per produzione scalabile, considera Redis.
- La cache del prezzo DAX dura 30 secondi per ridurre chiamate a Yahoo Finance.
