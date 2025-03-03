// src/telegram/components/watchlist.component.ts
import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
import { createGoBackButton } from '../constants/buttons.constant';
import { PaginationComponent, paginateData, registerPaginationHandlers } from './pagination.component';

/**
 * Interface for individual watchlist item
 */
export interface WatchlistItem {
  id: string;
  name: string;
  symbol: string;
  price?: number;
  priceChange24h?: number;
  marketCapRank?: number;
  watchlistId?: string;    // ID of the watchlist this item belongs to
  watchlistName?: string;  // Name of the watchlist this item belongs to
  // Any other properties you want to display
}

/**
 * Interface for watchlist display configuration
 */
export interface WatchlistConfig {
  /**
   * Title to display at the top of the watchlist
   */
  title: string;
  
  /**
   * Subtitle or description text
   */
  description?: string;
  
  /**
   * Items to display in the watchlist
   */
  items: WatchlistItem[];
  
  /**
   * Whether to show the Go Back button
   */
  showBackButton?: boolean;
  
  /**
   * Format to display prices (default: 'USD')
   * Examples: 'USD', 'BTC', 'ETH'
   */
  priceFormat?: string;
  
  /**
   * Whether to show market cap ranks
   */
  showRank?: boolean;
  
  /**
   * Whether to show price changes
   */
  showPriceChange?: boolean;
  
  /**
   * Whether to show watchlist names (useful when displaying mixed watchlists)
   */
  showWatchlistNames?: boolean;
  
  /**
   * Callback action prefix for item selection
   */
  selectActionPrefix?: string;
  
  /**
   * Number of items per page for pagination
   */
  itemsPerPage?: number;
  
  /**
   * Current page number (1-based)
   */
  currentPage?: number;
}

@Injectable()
export class WatchlistComponent {
  private readonly logger = new Logger(WatchlistComponent.name);
  private readonly paginationComponent = new PaginationComponent();

  /**
   * Format price with appropriate currency symbol
   */
  private formatPrice(price: number | undefined, format: string = 'USD'): string {
    if (price === undefined) return 'N/A';
    
    switch (format.toUpperCase()) {
      case 'USD':
        return `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
      case 'BTC':
        return `₿${price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })}`;
      case 'ETH':
        return `Ξ${price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })}`;
      default:
        return `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${format}`;
    }
  }

  /**
   * Format price change with appropriate indicators
   */
  private formatPriceChange(change: number | undefined): string {
    if (change === undefined) return '';
    
    const prefix = change >= 0 ? '🟢 +' : '🔴 ';
    return `${prefix}${Math.abs(change).toFixed(2)}%`;
  }

  /**
   * Transform API watchlist data into displayable items
   * 
   * @param watchlistData - Raw watchlist data from API
   * @returns Formatted watchlist items ready for display
   */
  public transformWatchlistData(watchlistData: any[]): WatchlistItem[] {
    return watchlistData.flatMap(watchlist => {
      // Skip watchlists with no coins
      if (!watchlist.coins || watchlist.coins.length === 0) {
        return [];
      }
      
      return watchlist.coins.map(entry => {
        const coin = entry.coin;
        
        if (!coin) {
          return {
            id: entry.coinIdentifier,
            name: 'Unknown',
            symbol: entry.coinIdentifier.toUpperCase(),
            watchlistId: watchlist.id,
            watchlistName: watchlist.name
          };
        }
        
        return {
          id: entry.coinIdentifier,
          name: coin.name,
          symbol: coin.symbol,
          watchlistId: watchlist.id,
          watchlistName: watchlist.name,
          // Add any additional fields if available in your API response
          price: coin.currentPrice,
          priceChange24h: coin.priceChangePercentage24h
        };
      });
    });
  }

  /**
   * Display a watchlist with optional pagination
   * 
   * @param ctx - The Telegram context
   * @param config - Watchlist configuration
   */
  public async display(ctx: CustomContext, config: WatchlistConfig): Promise<void> {
    try {
      this.logger.log(`Displaying watchlist: ${config.title} with ${config.items.length} items`);
      
      // Set defaults
      const showBackButton = config.showBackButton !== false;
      const priceFormat = config.priceFormat || 'USD';
      const showRank = config.showRank !== false;
      const showPriceChange = config.showPriceChange !== false;
      const selectActionPrefix = config.selectActionPrefix || 'watchlist_select';
      const itemsPerPage = config.itemsPerPage || 5;
      const currentPage = config.currentPage || 1;
      
      // Use pagination utility to get paginated items
      const { items: pageItems, pagination } = paginateData(
        config.items,
        currentPage,
        itemsPerPage
      );
      
      // Format message text
      let messageText = `*${config.title}*\n`;
      
      if (config.description) {
        messageText += `${config.description}\n`;
      }
      
      messageText += `\n`;
      
      // Check if we have items
      if (pageItems.length === 0) {
        messageText += `_No items in watchlist_\n`;
      } else {
        // Format each item
        pageItems.forEach((item, idx) => {
          const rank = showRank && item.marketCapRank ? `#${item.marketCapRank} ` : '';
          const price = item.price ? this.formatPrice(item.price, priceFormat) : 'N/A';
          const change = showPriceChange && item.priceChange24h 
            ? ` ${this.formatPriceChange(item.priceChange24h)}` 
            : '';
          
          // Show watchlist name if we're displaying items from multiple watchlists
          const watchlistInfo = item.watchlistName && config.showWatchlistNames 
            ? ` (${item.watchlistName})` 
            : '';
            
          messageText += `${rank}*${item.name}* (${item.symbol})${watchlistInfo} - ${price}${change}\n`;
        });
      }
      
      // Create item selection buttons
      const buttons: any[] = [];
      
      pageItems.forEach(item => {
        buttons.push([
          Markup.button.callback(
            `${item.symbol} - View Details`, 
            `${selectActionPrefix}_${item.id}`
          )
        ]);
      });
      
      // Add action buttons
      buttons.push([
        Markup.button.callback('🔄 Refresh', 'watchlist_refresh'),
        Markup.button.callback('⚙️ Settings', 'watchlist_settings')
      ]);
      
      // Add back button if needed
      if (showBackButton) {
        buttons.push([createGoBackButton()]);
      }
      
      // Add pagination buttons using the pagination component
      const paginationConfig = {
        totalItems: config.items.length,
        itemsPerPage,
        currentPage,
        callbackPrefix: 'watchlist',
        showCounts: true
      };
      
      const keyboardWithPagination = this.paginationComponent.addToKeyboard(
        buttons, 
        paginationConfig
      );
      
      const keyboard = Markup.inlineKeyboard(keyboardWithPagination);
      
      // Send or edit message
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(messageText, {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown',
          });
        } catch (error) {
          this.logger.error(`Failed to edit watchlist message: ${error.message}`);
          await ctx.reply(messageText, {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown',
          });
        }
      } else {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
      
      this.logger.log(`Watchlist displayed successfully`);
    } catch (error) {
      this.logger.error(`Error displaying watchlist: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Register watchlist component callback handlers on a scene or wizard
 * 
 * @param scene - The scene or wizard to register handlers on
 * @param watchlistComponent - Instance of WatchlistComponent
 * @param getWatchlistItems - Function to retrieve watchlist items
 * @param itemSelectedHandler - Function to handle when an item is selected
 * @param settingsHandler - Optional function to handle watchlist settings
 */
export function registerWatchlistHandlers(
  scene: any,
  watchlistComponent: WatchlistComponent,
  getWatchlistItems: (ctx: CustomContext, page: number) => Promise<WatchlistItem[]>,
  itemSelectedHandler: (ctx: CustomContext, itemId: string) => Promise<void>,
  settingsHandler?: (ctx: CustomContext) => Promise<void>
): void {
  const logger = new Logger('WatchlistHandlers');
  
  // Register the pagination handlers using the shared pagination component
  registerPaginationHandlers(
    scene, 
    'watchlist',
    async (ctx: CustomContext, page: number) => {
      try {
        logger.log(`Navigating to watchlist page ${page}`);
        
        // Store the current page in wizard state if available
        if (ctx.wizard?.state?.parameters) {
          ctx.wizard.state.parameters.watchlistPage = page;
        }
        
        // Get items for the requested page
        const items = await getWatchlistItems(ctx, page);
        
        // Display the updated watchlist
        await watchlistComponent.display(ctx, {
          title: 'Your Watchlist',
          items,
          currentPage: page
        });
      } catch (error) {
        logger.error(`Error handling watchlist pagination: ${error.message}`);
        await ctx.answerCbQuery('Error loading page');
      }
    }
  );
  
  // Handler for refresh button
  scene.action('watchlist_refresh', async (ctx: CustomContext) => {
    try {
      logger.log('Refreshing watchlist');
      
      // Get the current page from state or default to 1
      const currentPage = ctx.wizard?.state?.parameters?.watchlistPage || 1;
      
      // Get updated items
      const items = await getWatchlistItems(ctx, currentPage);
      
      // Display the updated watchlist
      await watchlistComponent.display(ctx, {
        title: 'Your Watchlist',
        items,
        currentPage
      });
      
      await ctx.answerCbQuery('Watchlist refreshed');
    } catch (error) {
      logger.error(`Error refreshing watchlist: ${error.message}`);
      await ctx.answerCbQuery('Error refreshing data');
    }
  });
  
  // Handler for settings button
  scene.action('watchlist_settings', async (ctx: CustomContext) => {
    try {
      logger.log('Opening watchlist settings');
      
      if (settingsHandler) {
        // Use the provided settings handler
        await settingsHandler(ctx);
      } else {
        // Default behavior
        await ctx.answerCbQuery('Settings feature coming soon');
      }
    } catch (error) {
      logger.error(`Error opening watchlist settings: ${error.message}`);
      await ctx.answerCbQuery('Error opening settings');
    }
  });
  
  // Handler for item selection
  scene.action(/^watchlist_select_(.+)$/, async (ctx: CustomContext) => {
    try {
      // Extract the item ID from callback data
      const match = /^watchlist_select_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      if (!match) return;
      
      const itemId = match[1];
      logger.log(`Watchlist item selected: ${itemId}`);
      
      // Call the provided handler
      await itemSelectedHandler(ctx, itemId);
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling watchlist item selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting item');
    }
  });
}