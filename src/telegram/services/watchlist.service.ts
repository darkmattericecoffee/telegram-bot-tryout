// src/telegram/services/watchlist.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

// Define interfaces based on your existing code
export interface WatchlistItem {
  id: string;
  name: string;
  symbol: string;
  price?: number;
  priceChange24h?: number;
  marketCapRank?: number;
  watchlistId: string;
  watchlistName: string;
}

export interface Watchlist {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  telegramGroupId?: string | null;
  telegramUserId?: string | null;
  coins: Array<{
    coinIdentifier: string;
    coin: {
      name: string;
      symbol: string;
      price?: number;
      priceChange24h?: number;
    } | null;
  }>;
}

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);
  private watchlists: Watchlist[] = [];

  constructor() {
    // Initialize with some mock data
    this.initializeMockData();
  }

  private initializeMockData() {
    // Create a few sample watchlists
    this.watchlists = [
      {
        id: uuidv4(),
        name: 'Top DeFi',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        coins: [
          {
            coinIdentifier: 'ethereum',
            coin: {
              name: 'Ethereum',
              symbol: 'ETH',
              price: 4500.21,
              priceChange24h: 5.2,
            }
          },
          {
            coinIdentifier: 'uniswap',
            coin: {
              name: 'Uniswap',
              symbol: 'UNI',
              price: 7.35,
              priceChange24h: -2.1,
            }
          },
          {
            coinIdentifier: 'aave',
            coin: {
              name: 'Aave',
              symbol: 'AAVE',
              price: 120.50,
              priceChange24h: 3.7,
            }
          }
        ]
      },
      {
        id: uuidv4(),
        name: 'Market Leaders',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        coins: [
          {
            coinIdentifier: 'bitcoin',
            coin: {
              name: 'Bitcoin',
              symbol: 'BTC',
              price: 68421.32,
              priceChange24h: 2.3,
            }
          },
          {
            coinIdentifier: 'ethereum',
            coin: {
              name: 'Ethereum',
              symbol: 'ETH',
              price: 4500.21,
              priceChange24h: 5.2,
            }
          },
          {
            coinIdentifier: 'binancecoin',
            coin: {
              name: 'Binance Coin',
              symbol: 'BNB',
              price: 650.75,
              priceChange24h: 1.8,
            }
          }
        ]
      }
    ];
  }

  async getWatchlists(telegramId: string, isGroup: boolean): Promise<Watchlist[]> {
    this.logger.log(`Getting watchlists for ${isGroup ? 'group' : 'user'}: ${telegramId}`);
    
    // In a real implementation, you would filter based on the telegramId
    // For mock purposes, just return all watchlists
    return this.watchlists;
  }

  async getWatchlistById(watchlistId: string): Promise<Watchlist> {
    const watchlist = this.watchlists.find(w => w.id === watchlistId);
    
    if (!watchlist) {
      throw new NotFoundException(`Watchlist with ID ${watchlistId} not found`);
    }
    
    return watchlist;
  }

  async createWatchlist(telegramId: string, isGroup: boolean, name: string): Promise<Watchlist> {
    this.logger.log(`Creating watchlist "${name}" for ${isGroup ? 'group' : 'user'}: ${telegramId}`);
    
    const newWatchlist: Watchlist = {
      id: uuidv4(),
      name,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(isGroup ? { telegramGroupId: telegramId } : { telegramUserId: telegramId }),
      coins: []
    };
    
    this.watchlists.push(newWatchlist);
    return newWatchlist;
  }

  async renameWatchlist(telegramId: string, isGroup: boolean, watchlistId: string, newName: string): Promise<Watchlist> {
    this.logger.log(`Renaming watchlist ${watchlistId} to "${newName}"`);
    
    const watchlist = await this.getWatchlistById(watchlistId);
    
    // In a real implementation, you would verify ownership here
    
    watchlist.name = newName;
    watchlist.updatedAt = new Date();
    
    return watchlist;
  }

  async deleteWatchlist(telegramId: string, isGroup: boolean, watchlistId: string): Promise<boolean> {
    this.logger.log(`Deleting watchlist ${watchlistId}`);
    
    const index = this.watchlists.findIndex(w => w.id === watchlistId);
    
    if (index === -1) {
      throw new NotFoundException(`Watchlist with ID ${watchlistId} not found`);
    }
    
    // In a real implementation, you would verify ownership here
    
    this.watchlists.splice(index, 1);
    return true;
  }

  async addToWatchlist(telegramId: string, isGroup: boolean, coinIdentifier: string, watchlistId: string): Promise<Watchlist> {
    this.logger.log(`Adding coin ${coinIdentifier} to watchlist ${watchlistId}`);
    
    const watchlist = await this.getWatchlistById(watchlistId);
    
    // Check if coin already exists in watchlist
    const existingCoin = watchlist.coins.find(c => c.coinIdentifier === coinIdentifier);
    if (existingCoin) {
      this.logger.log(`Coin ${coinIdentifier} already exists in watchlist`);
      return watchlist;
    }
    
    // Mock coin data - in real implementation, you would fetch this from an API
    const coinData = {
      name: coinIdentifier.charAt(0).toUpperCase() + coinIdentifier.slice(1),
      symbol: coinIdentifier.substring(0, 3).toUpperCase(),
      price: Math.random() * 1000,
      priceChange24h: (Math.random() * 20) - 10
    };
    
    watchlist.coins.push({
      coinIdentifier,
      coin: coinData
    });
    
    watchlist.updatedAt = new Date();
    
    return watchlist;
  }

  async removeFromWatchlist(telegramId: string, isGroup: boolean, coinIdentifier: string, watchlistId: string): Promise<Watchlist> {
    this.logger.log(`Removing coin ${coinIdentifier} from watchlist ${watchlistId}`);
    
    const watchlist = await this.getWatchlistById(watchlistId);
    
    const coinIndex = watchlist.coins.findIndex(c => c.coinIdentifier === coinIdentifier);
    
    if (coinIndex === -1) {
      this.logger.log(`Coin ${coinIdentifier} not found in watchlist`);
      return watchlist;
    }
    
    watchlist.coins.splice(coinIndex, 1);
    watchlist.updatedAt = new Date();
    
    return watchlist;
  }

  // Transform watchlist data to the format expected by UI components
  transformWatchlistsToDisplayItems(watchlists: Watchlist[]): WatchlistItem[] {
    const items: WatchlistItem[] = [];
    
    watchlists.forEach(watchlist => {
      watchlist.coins.forEach(entry => {
        if (entry.coin) {
          items.push({
            id: entry.coinIdentifier,
            name: entry.coin.name,
            symbol: entry.coin.symbol,
            price: entry.coin.price,
            priceChange24h: entry.coin.priceChange24h,
            watchlistId: watchlist.id,
            watchlistName: watchlist.name
          });
        }
      });
    });
    
    return items;
  }
}