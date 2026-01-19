
export const fetchLiveDaxPrice = async (): Promise<number | null> => {
    try {
        // Using a CORS proxy to fetch data from Yahoo Finance for DAX (^GDAXI)
        // Note: We use query1.finance.yahoo.com/v8/finance/chart/%5EGDAXI
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGDAXI?interval=1d&range=1d';
        // We use corsproxy.io to bypass CORS restrictions in the browser
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        
        if (typeof price === 'number') {
            return price;
        }
        return null;
    } catch (error) {
        console.error("Error fetching DAX price:", error);
        return null;
    }
};
