// src/telegram/services/discovery.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface StrengthParams {
  type: 'strongest' | 'weakest';
  pairing: string;
  timeframe: string;
}

export interface LatestSignalsParams {
  indicatorType: string;
  sentiment: string;
}

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  pairing: string;
  timeframe: string;
  score: number;
  direction?: string;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  
  // Mock database of coins
  private readonly mockCoins = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'binancecoin', name: 'Binance Coin', symbol: 'BNB' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
    { id: 'solana', name: 'Solana', symbol: 'SOL' },
    { id: 'ripple', name: 'XRP', symbol: 'XRP' },
    { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
    { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
    { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB' },
    { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
    { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
    { id: 'cosmos', name: 'Cosmos', symbol: 'ATOM' },
    { id: 'uniswap', name: 'Uniswap', symbol: 'UNI' },
    { id: 'algorand', name: 'Algorand', symbol: 'ALGO' }
  ];
  
  /**
   * Get mock strength analysis results
   */
  async getStrength(params: StrengthParams): Promise<CoinData[]> {
    this.logger.log(`Getting ${params.type} coins for ${params.pairing}/${params.timeframe}`);
    
    // Generate random strength scores
    const mockResults = this.mockCoins.map(coin => {
      const score = Math.random() * 10; // Random score between 0-10
      return {
        ...coin,
        pairing: params.pairing,
        timeframe: params.timeframe,
        score
      };
    });
    
    // Sort by score
    mockResults.sort((a, b) => {
      // For strongest, sort descending (highest first)
      // For weakest, sort ascending (lowest first)
      return params.type === 'strongest' 
        ? b.score - a.score 
        : a.score - b.score;
    });
    
    // Return top 5 results
    return mockResults.slice(0, 5);
  }
  
  /**
   * Get mock signals based on indicator type and sentiment
   */
  async getLatestSignals(params: LatestSignalsParams): Promise<CoinData[]> {
    this.logger.log(`Getting latest signals for ${params.indicatorType} with sentiment ${params.sentiment}`);
    
    // Select random coins from the mock data
    const selectedCoins = this.getRandomCoins(5);
    
    // Generate signal data
    const mockResults = selectedCoins.map(coin => {
      // Random score between 0-10
      const score = Math.random() * 10;
      
      // Direction based on sentiment
      const direction = params.sentiment === 'bearish to bullish' 
        ? 'Bullish' 
        : 'Bearish';
      
      return {
        ...coin,
        pairing: 'USD', // Default pairing
        timeframe: '1D', // Default timeframe
        score,
        direction
      };
    });
    
    return mockResults;
  }
  
  /**
   * Helper function to get n random coins from the mock database
   */
  private getRandomCoins(count: number): any[] {
    const shuffled = [...this.mockCoins].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}