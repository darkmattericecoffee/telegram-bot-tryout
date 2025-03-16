// src/telegram/services/discovery.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  percentChange: number;
  volume: number;
  marketCap: number;
  trendScore: number;
  rsi: number;
  priceVsTrend: number;
  volumeVsTrend: number;
}

export interface DiscoveryResult {
  coins: CoinData[];
  totalItems: number;
  page: number;
  hasMore: boolean;
}

export interface DiscoveryOptions {
  feature: 'strength' | 'average' | 'signals' | 'divergences' | 'market_cap' | 'volume';
  type?: string; // Specific type within feature (e.g., 'weakest' or 'strongest' for strength)
  pairing?: string; // USD, BTC, ETH, etc.
  timeframe?: string; // 6h, 12h, 1D, 1W, 1M
  sentiment?: 'bullish_to_bearish' | 'bearish_to_bullish'; // For signals feature
  indicator?: string; // TrendScore, RSI, etc.
  page?: number; // Pagination
  limit?: number; // Items per page
}

/**
 * Service for cryptocurrency discovery features
 */
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private mockCoins: CoinData[] = [];

  constructor() {
    this.initializeMockData();
  }

  /**
   * Initialize mock coin data for discovery features
   */
  private initializeMockData(): void {
    // Base coin data
    const baseCoins = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
      { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
      { id: 'solana', name: 'Solana', symbol: 'SOL' },
      { id: 'ripple', name: 'XRP', symbol: 'XRP' },
      { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
      { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
      { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
      { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
      { id: 'tron', name: 'Tron', symbol: 'TRX' },
      { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
      { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
      { id: 'uniswap', name: 'Uniswap', symbol: 'UNI' },
      { id: 'cosmos', name: 'Cosmos', symbol: 'ATOM' },
      { id: 'stellar', name: 'Stellar', symbol: 'XLM' },
      { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR' },
      { id: 'algorand', name: 'Algorand', symbol: 'ALGO' },
      { id: 'filecoin', name: 'Filecoin', symbol: 'FIL' },
      { id: 'vechain', name: 'VeChain', symbol: 'VET' },
      { id: 'hedera-hashgraph', name: 'Hedera', symbol: 'HBAR' }
    ];

    // Generate random technical indicators and price data for each coin
    this.mockCoins = baseCoins.map(coin => ({
      ...coin,
      price: this.randomPrice(),
      percentChange: this.randomPercentChange(),
      volume: this.randomVolume(),
      marketCap: this.randomMarketCap(),
      trendScore: this.randomScore(0, 100),
      rsi: this.randomScore(0, 100),
      priceVsTrend: this.randomScore(-100, 100),
      volumeVsTrend: this.randomScore(-100, 100)
    }));

    this.logger.log(`Initialized ${this.mockCoins.length} mock coins for discovery feature`);
  }

  /**
   * Get discovery results based on options
   */
  async getDiscoveryResults(options: DiscoveryOptions): Promise<DiscoveryResult> {
    this.logger.log(`Getting discovery results for feature: ${options.feature}`);
    
    // Add artificial delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Default pagination
    const page = options.page || 1;
    const limit = options.limit || 5;
    const startIndex = (page - 1) * limit;
    
    // Filter and sort based on the feature and options
    let filteredCoins = [...this.mockCoins];
    
    switch (options.feature) {
      case 'strength':
        // Sort by percent change
        filteredCoins = filteredCoins.sort((a, b) => {
          if (options.type === 'weakest') {
            return a.percentChange - b.percentChange;
          } else {
            return b.percentChange - a.percentChange;
          }
        });
        break;
        
      case 'average':
        // Use appropriate indicator for sorting
        const indicatorKey = this.getIndicatorKey(options.indicator);
        filteredCoins = filteredCoins.sort((a, b) => b[indicatorKey] - a[indicatorKey]);
        break;
        
      case 'signals':
        // Filter based on signal direction (sentiment)
        if (options.sentiment === 'bullish_to_bearish') {
          filteredCoins = filteredCoins.filter(coin => coin.trendScore > 60 && coin.percentChange < 0)
            .sort((a, b) => b.trendScore - a.trendScore);
        } else {
          filteredCoins = filteredCoins.filter(coin => coin.trendScore < 40 && coin.percentChange > 0)
            .sort((a, b) => a.trendScore - b.trendScore);
        }
        break;
        
      case 'divergences':
        // Sort by volume vs trend divergence
        filteredCoins = filteredCoins.sort((a, b) => 
          Math.abs(b.volumeVsTrend) - Math.abs(a.volumeVsTrend)
        );
        break;
        
      case 'market_cap':
        // Randomize order since this is just mock data
        filteredCoins = this.shuffleArray(filteredCoins);
        break;
        
      case 'volume':
        // Sort by volume
        filteredCoins = filteredCoins.sort((a, b) => b.volume - a.volume);
        break;
        
      default:
        break;
    }
    
    // Paginate the results
    const paginatedCoins = filteredCoins.slice(startIndex, startIndex + limit);
    
    return {
      coins: paginatedCoins,
      totalItems: filteredCoins.length,
      page,
      hasMore: startIndex + limit < filteredCoins.length
    };
  }

  /**
   * Generate a chart for a specific coin and feature
   * This is just a placeholder - the actual implementation would call your chart service
   */
  async generateDiscoveryChart(coin: CoinData, options: DiscoveryOptions): Promise<{ chartUrl: string; caption: string }> {
    this.logger.log(`Generating discovery chart for ${coin.name} with feature ${options.feature}`);
    
    // In a real implementation, this would call your chart service
    // For now, just return a mock chart URL and caption
    return {
      chartUrl: `https://example.com/charts/${coin.id}`,
      caption: `Chart for ${coin.name} (${coin.symbol}) - ${options.feature} view`
    };
  }

  /**
   * Utility to get the correct indicator key from option
   */
  private getIndicatorKey(indicator: string | undefined): string {
    switch (indicator) {
      case 'TrendScore': return 'trendScore';
      case 'RSI': return 'rsi';
      case 'Price vs Trend': return 'priceVsTrend';
      case 'Volume to Trend': return 'volumeVsTrend';
      default: return 'trendScore';
    }
  }

  /**
   * Utilities for generating random data
   */
  private randomPrice(): number {
    // Generate realistic crypto price
    const basePrice = Math.random() * 1000;
    if (basePrice < 1) return parseFloat(basePrice.toFixed(4));
    if (basePrice < 10) return parseFloat(basePrice.toFixed(3));
    if (basePrice < 100) return parseFloat(basePrice.toFixed(2));
    return parseFloat(basePrice.toFixed(0));
  }

  private randomPercentChange(): number {
    return parseFloat((Math.random() * 20 - 10).toFixed(2));
  }

  private randomVolume(): number {
    return Math.floor(Math.random() * 1000000000);
  }

  private randomMarketCap(): number {
    return Math.floor(Math.random() * 10000000000);
  }

  private randomScore(min: number, max: number): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
}