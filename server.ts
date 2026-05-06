import express from "express";
import pkg from 'yahoo-finance2';

// Handle potential ESM/CJS interop issues or library quirks
let yahooFinance: any;

try {
    // Simplified initialization logic based on verified script
    if (typeof pkg === 'function') {
        try {
            // @ts-ignore
            yahooFinance = new pkg();
        } catch (e) {
            yahooFinance = pkg;
        }
    } else if ((pkg as any).default) {
        try {
            yahooFinance = new (pkg as any).default();
        } catch (e) {
            yahooFinance = (pkg as any).default;
        }
    } else {
        yahooFinance = pkg;
    }
    
    // Suppress the survey notice
    if (yahooFinance && typeof yahooFinance.setGlobalConfig === 'function') {
        yahooFinance.setGlobalConfig({ suppressNotices: ['yahooSurvey'] });
    }
} catch (e) {
    console.error("Failed to instantiate yahoo-finance2:", e);
    yahooFinance = pkg;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  console.log(`Starting server in ${process.env.NODE_ENV} mode`);
  console.log(`Configured to listen on port ${PORT}`);

  // API Route for New User Notification Webhook
  app.post("/api/notify-signup", async (req, res) => {
    try {
      // Verify Webhook Secret
      if (!process.env.WEBHOOK_SECRET) {
        console.error("WEBHOOK_SECRET is not configured in environment variables.");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const secret = req.headers['x-webhook-secret'];
      if (secret !== process.env.WEBHOOK_SECRET) {
        console.warn("Unauthorized webhook attempt detected.");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payload = req.body;
      
      // Supabase sends the new record in payload.record
      const newUserEmail = payload?.record?.email || "Email sconosciuta";
      const newUserId = payload?.record?.id || "ID sconosciuto";

      console.log(`New user signup detected: ${newUserEmail}`);

      // Check if SMTP credentials are provided
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("SMTP credentials not configured. Skipping email notification.");
        return res.status(200).json({ message: "Webhook received, but email skipped (no SMTP config)" });
      }

      // Dynamic import of nodemailer
      const nodemailer = await import('nodemailer');

      // Create reusable transporter object using the default SMTP transport
      const transporter = nodemailer.createTransport({
        service: 'gmail', // You can change this or use host/port for other providers
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Comma-separated list of admin emails from env var, or fallback
      const adminEmails = process.env.ADMIN_EMAILS || process.env.SMTP_USER;

      // Send mail with defined transport object
      const info = await transporter.sendMail({
        from: `"Option DAX Notifiche" <${process.env.SMTP_USER}>`,
        to: adminEmails, // list of receivers
        subject: "🎉 Nuovo iscritto su Option DAX!",
        html: `
          <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
            <h2 style="color: #0f172a;">Nuova Iscrizione</h2>
            <p style="color: #334155; font-size: 16px;">Un nuovo utente si è appena registrato alla piattaforma Option DAX.</p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 20px;">
              <p style="margin: 0; color: #0f172a;"><strong>Email:</strong> ${newUserEmail}</p>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;"><strong>ID Utente:</strong> ${newUserId}</p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Questa è una notifica automatica generata dal sistema.</p>
          </div>
        `,
      });

      console.log("Notification email sent: %s", info.messageId);
      res.status(200).json({ success: true, message: "Notification sent" });
    } catch (error) {
      console.error("Error sending notification email:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // API Route for Market Data
  app.get("/api/market-data", async (req, res) => {
    console.log("Received request for /api/market-data");
    
    // Set JSON content type explicitly
    res.setHeader('Content-Type', 'application/json');

    try {
      const daxSymbol = '^GDAXI';
      
      // Function to scrape VDAX from stoxx.com
      const fetchVDAXFromStoxx = async (): Promise<number | null> => {
          try {
              console.log("Fetching VDAX from stoxx.com...");
              const response = await fetch('https://stoxx.com/index/v1x/', {
                  headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                  }
              });
              if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
              }
              const text = await response.text();
              // Regex to find the value in the span with id "overview-last-value"
              const match = text.match(/<span class="color-gray-xdark data-current-price" id="overview-last-value">([0-9.]+)<\/span>/);
              if (match && match[1]) {
                  const val = parseFloat(match[1]);
                  console.log(`Scraped VDAX value: ${val}`);
                  return val;
              }
              console.warn("Could not find VDAX value in page content");
              return null;
          } catch (error) {
              console.error("Error scraping VDAX from Stoxx:", error);
              return null;
          }
      };

      console.log(`Fetching quotes for ${daxSymbol} (Yahoo) and VDAX (Stoxx)...`);

      const fetchYahooWithTimeout = async (symbol: string, timeoutMs: number = 4000) => {
        try {
            if (!yahooFinance || typeof yahooFinance.quote !== 'function') {
                console.error("yahooFinance is not properly initialized or quote is not a function");
                return null;
            }
            
            const quotePromise = yahooFinance.quote(symbol);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout fetching ${symbol}`)), timeoutMs)
            );

            const q: any = await Promise.race([quotePromise, timeoutPromise]);
            console.log(`Fetched ${symbol} quote: ${q?.regularMarketPrice}`);
            return q;
        } catch (e: any) {
            console.error(`Error fetching ${symbol}:`, e.message || e);
            return null;
        }
      };

      // Fetch in parallel
      const [daxQuote, vdaxValue] = await Promise.all([
        fetchYahooWithTimeout(daxSymbol),
        fetchVDAXFromStoxx()
      ]);

      const daxSpot = daxQuote?.regularMarketPrice || 0;
      const daxVolatility = vdaxValue || 0;

      if (daxSpot === 0 && daxVolatility === 0) {
        console.warn("Both DAX and VDAX quotes are 0 or failed to fetch");
        console.warn("Returning mock data as fallback");
        return res.json({
            daxSpot: 24119.52, // Mock value
            daxVolatility: 15.0, // Default volatility
            lastUpdate: Date.now(),
            isMock: true
        });
      }

      console.log(`Returning market data: DAX=${daxSpot}, VDAX=${daxVolatility}`);
      res.json({
        daxSpot,
        daxVolatility,
        lastUpdate: Date.now(),
        isMock: false
      });
    } catch (error: any) {
      console.error("Market data fetch error:", error);
      // Even in case of catastrophic error, return mock data to keep UI alive
      res.json({
        daxSpot: 24119.52,
        daxVolatility: 15.0,
        lastUpdate: Date.now(),
        isMock: true,
        error: error.message || String(error)
      });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "Test endpoint working" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    // Force no-cache in development mode
    app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });
    
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const path = await import("path");
    const fs = await import("fs");
    const distPath = path.resolve("dist");
    
    if (!fs.existsSync(distPath)) {
        console.error(`Error: 'dist' directory not found at ${distPath}. Did you run 'npm run build'?`);
    } else {
        console.log(`Serving static files from ${distPath}`);
    }

    // Serve static files with no-cache for index.html
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    
    // Use regex for catch-all to be safe across Express versions
    app.get(/.*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(e => {
    console.error("Failed to start server:", e);
    process.exit(1);
});
