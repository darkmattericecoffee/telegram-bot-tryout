import { Injectable, Logger } from '@nestjs/common';

export interface CoinDynamicMetadata {
  market_cap_rank: number;
  price_usd?: number;
  volume_24h?: number;
  market_cap?: number;
  price_change_percentage_24h?: number;
}

export interface Coin {
  id: string;
  identifier: string;
  symbol: string;
  name: string;
  dynamicMetadata?: CoinDynamicMetadata;
}

export interface SearchResult {
  coin: Coin;
  score: number;
}

export interface SearchResponse {
  data: SearchResult[];
  total: number;
  page: number;
  lastPage: number;
}

@Injectable()
export class CoinSearchService {
  private readonly logger = new Logger(CoinSearchService.name);

  // Mock data to simulate database response
  private readonly mockCoins: Coin[] = [
    {
      id: '1',
      identifier: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      dynamicMetadata: { market_cap_rank: 1 }
    },
    {
      id: '2',
      identifier: 'ethereum',
      symbol: 'ETH',
      name: 'Ethereum',
      dynamicMetadata: { market_cap_rank: 2 }
    },
    {
      id: '3',
      identifier: 'binancecoin',
      symbol: 'BNB',
      name: 'Binance Coin',
      dynamicMetadata: { market_cap_rank: 3 }
    },
    {
      id: '4',
      identifier: 'solana',
      symbol: 'SOL',
      name: 'Solana',
      dynamicMetadata: { market_cap_rank: 4 }
    },
    {
      id: '5',
      identifier: 'xrp',
      symbol: 'XRP',
      name: 'XRP',
      dynamicMetadata: { market_cap_rank: 5 }
    },
    {
      id: '6',
      identifier: 'cardano',
      symbol: 'ADA',
      name: 'Cardano',
      dynamicMetadata: { market_cap_rank: 6 }
    },
    {
      id: '7',
      identifier: 'dogecoin',
      symbol: 'DOGE',
      name: 'Dogecoin',
      dynamicMetadata: { market_cap_rank: 7 }
    },
    {
      id: '8',
      identifier: 'polkadot',
      symbol: 'DOT',
      name: 'Polkadot',
      dynamicMetadata: { market_cap_rank: 8 }
    },
    {
      id: '9',
      identifier: 'bitcoincash',
      symbol: 'BCH',
      name: 'Bitcoin Cash',
      dynamicMetadata: { market_cap_rank: 9 }
    },
    {
      id: '10',
      identifier: 'litecoin',
      symbol: 'LTC',
      name: 'Litecoin',
      dynamicMetadata: { market_cap_rank: 10 }
    },
    {
      id: '11',
      identifier: 'bitcoin-sv',
      symbol: 'BSV',
      name: 'Bitcoin SV',
      dynamicMetadata: { market_cap_rank: 11 }
    },
    {
      id: '12',
      identifier: 'bitcoin-gold',
      symbol: 'BTG',
      name: 'Bitcoin Gold',
      dynamicMetadata: { market_cap_rank: 12 }
    },
    {
      id: '13',
      identifier: 'bitcoin-diamond',
      symbol: 'BCD',
      name: 'Bitcoin Diamond',
      dynamicMetadata: { market_cap_rank: 13 }
    },
  ];

  /**
   * Calculate similarity between two strings (Levenshtein distance-based).
   * This is a simplified version of the similarity calculation.
   */
  private calculateSimilarity(a: string, b: string): number {
    // For exact match, return highest similarity
    if (a === b) return 1.0;
    
    // For starts with, return high similarity
    if (b.startsWith(a)) return 0.9;
    
    // For contains, return medium similarity
    if (b.includes(a)) return 0.7;
    
    // For more complex similarity, we would use Levenshtein distance
    // but for this mock, we'll return a lower value
    return 0.3;
  }

  /**
   * Mock implementation of the searchCoins method that mimics the behavior
   * of the real service but uses in-memory data.
   */
  async searchCoins(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<SearchResponse> {
    this.logger.log(`Searching for coins with query: ${query}`);
    
    const searchTerm = query.toLowerCase().trim();
    
    // Simulate filtering from the database
    const filteredCoins = this.mockCoins.filter(coin => 
      coin.symbol.toLowerCase().includes(searchTerm) ||
      coin.identifier.toLowerCase().includes(searchTerm) ||
      coin.name.toLowerCase().includes(searchTerm)
    );
    
    // Calculate scores for each coin
    const scoredResults = filteredCoins.map(coin => {
      // Calculate base similarity scores
      const symbolScore = this.calculateSimilarity(searchTerm, coin.symbol.toLowerCase()) * 2;
      const identifierScore = this.calculateSimilarity(searchTerm, coin.identifier.toLowerCase());
      const nameScore = this.calculateSimilarity(searchTerm, coin.name.toLowerCase());
      
      // Enhanced exact match scoring
      let exactMatchBonus = 0;
      
      // Exact symbol match gets highest priority
      if (coin.symbol.toLowerCase() === searchTerm) {
        exactMatchBonus = 3;
      }
      // Exact identifier match gets second priority
      else if (coin.identifier.toLowerCase() === searchTerm) {
        exactMatchBonus = 2;
      }
      // Exact name match gets third priority
      else if (coin.name.toLowerCase() === searchTerm) {
        exactMatchBonus = 1;
      }
      
      const scores = [symbolScore, identifierScore, nameScore];
      
      // Use market cap rank as a tiebreaker
      const marketCapBonus = coin.dynamicMetadata?.market_cap_rank
        ? 1 / (1 + coin.dynamicMetadata.market_cap_rank)
        : 0;
        
      return {
        coin,
        score: Math.max(...scores) + exactMatchBonus + marketCapBonus,
      };
    });
    
    // Sort by score
    const sortedResults = scoredResults.sort((a, b) => {
      // First sort by score
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      
      // If scores are equal, sort by market cap rank
      const aRank = a.coin.dynamicMetadata?.market_cap_rank || Infinity;
      const bRank = b.coin.dynamicMetadata?.market_cap_rank || Infinity;
      return aRank - bRank;
    });
    
    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedResults = sortedResults.slice(skip, skip + limit);
    
    return {
      data: paginatedResults,
      total: sortedResults.length,
      page,
      lastPage: Math.ceil(sortedResults.length / limit),
    };
  }

    /**
   * Get coin details by ID
   * @param id Coin ID
   * @returns Coin details or null if not found
   */
    async getCoinById(id: string): Promise<Coin | null> {
      this.logger.log(`Getting coin details for ID: ${id}`);
      
      const coin = this.mockCoins.find(c => c.id.toLowerCase() === id.toLowerCase());
      
      if (coin) {
        this.logger.log(`Found coin: ${coin.name} (${coin.symbol})`);
        return coin;
      }
      
      this.logger.log(`Coin with ID ${id} not found`);
      return null;
    }
}