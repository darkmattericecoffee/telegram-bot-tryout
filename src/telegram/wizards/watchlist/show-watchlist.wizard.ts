// src/telegram/wizards/watchlist/show-watchlist.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { WatchlistComponent } from '../../components/watchlist.component';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { WatchlistService } from '../../services/watchlist.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showWatchlistMenu } from '../../menus/sub.menu/watchlist.menu';

// Create logger
const logger = new Logger('ShowWatchlistWizard');

// Initialize components
const watchlistComponent = new WatchlistComponent();

/**
 * ShowWatchlistWizard - Displays user's watchlists
 */
export const createShowWatchlistWizard = (watchlistService: WatchlistService) => {
  const showWatchlistWizard = new Scenes.WizardScene<CustomContext>(
    'show-watchlist-wizard',
    async (ctx) => {
      logger.log('Entering show watchlist wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {
          currentPage: 1
        };
        
        await displayWatchlists(ctx, watchlistService);
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in show watchlist wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to load watchlists. Please try again.');
        return ctx.scene.leave();
      }
    }
  );
  
  // Register pagination handlers
  showWatchlistWizard.action(/^watchlist_page_(\d+)$/, async (ctx) => {
    try {
      // Extract page number from callback data
      const match = /^watchlist_page_(\d+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const page = parseInt(match[1], 10);
        logger.log(`Navigating to watchlist page ${page}`);
        
        // Update current page in wizard state
        ctx.wizard.state.parameters.currentPage = page;
        
        // Display watchlists for the requested page
        await displayWatchlists(ctx, watchlistService);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pagination: ${error.message}`);
      await ctx.answerCbQuery('Error loading page');
    }
  });
  
  // Handle refresh action
  showWatchlistWizard.action('watchlist_refresh', async (ctx) => {
    try {
      logger.log('Refreshing watchlists');
      
      // Get the current page from state or default to 1
      const currentPage = ctx.wizard.state.parameters?.currentPage || 1;
      
      // Update state and refresh display
      ctx.wizard.state.parameters.currentPage = currentPage;
      
      await ctx.answerCbQuery('Watchlists refreshed');
      await displayWatchlists(ctx, watchlistService);
    } catch (error) {
      logger.error(`Error refreshing watchlists: ${error.message}`);
      await ctx.answerCbQuery('Error refreshing data');
    }
  });
  
  // Handle watchlist item selection
  showWatchlistWizard.action(/^watchlist_select_(.+)$/, async (ctx) => {
    try {
      // Extract item ID from callback data
      const match = /^watchlist_select_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const itemId = match[1];
        logger.log(`Selected watchlist item: ${itemId}`);
        
        // Handle selected item (Show details, etc.)
        await ctx.answerCbQuery(`Selected ${itemId}`);
        
        // For now, just refresh the watchlist display
        await displayWatchlists(ctx, watchlistService);
      } else {
        await ctx.answerCbQuery();
      }
    } catch (error) {
      logger.error(`Error handling watchlist item selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting item');
    }
  });
  
  // Handle settings action
  showWatchlistWizard.action('watchlist_settings', async (ctx) => {
    try {
      logger.log('Opening watchlist settings');
      await ctx.answerCbQuery();
      await ctx.scene.leave();
      await showWatchlistMenu(ctx);
    } catch (error) {
      logger.error(`Error opening watchlist settings: ${error.message}`);
      await ctx.answerCbQuery('Error opening settings');
    }
  });
  
  // Handle settings actions
  showWatchlistWizard.action('create_watchlist_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    return ctx.scene.enter('create-watchlist-wizard');
  });
  
  showWatchlistWizard.action('rename_watchlist_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    return ctx.scene.enter('rename-watchlist-wizard');
  });
  
  showWatchlistWizard.action('delete_watchlist_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    return ctx.scene.enter('delete-watchlist-wizard');
  });
  
  showWatchlistWizard.action('add_coins_settings', async (ctx) => {
    await ctx.answerCbQuery('Feature coming soon!');
  });
  
  // Go back button handler
  showWatchlistWizard.action('go_back', async (ctx) => {
    logger.log('Leaving show watchlist wizard');
    await ctx.scene.leave();
    
    // Return to the watchlist menu
    await showWatchlistMenu(ctx);
  });
  
  return showWatchlistWizard;
};

/**
 * Helper function to display watchlists with pagination
 */
async function displayWatchlists(ctx: CustomContext, watchlistService: WatchlistService) {
  try {
    logger.log('Displaying watchlists');
    
    // Get the telegram ID and determine if it's a group
    // In a real implementation, you would extract these from the context
    const telegramId = String(ctx.from?.id || '');
    const isGroup = false; // Assume personal chat for now
    
    // Get watchlists for the user
    const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
    
    // Transform watchlist data to display items
    const items = watchlistService.transformWatchlistsToDisplayItems(watchlists);
    
    // Get current page from state or default to 1
    const currentPage = ctx.wizard.state.parameters?.currentPage || 1;
    
    // Display the watchlist
    await watchlistComponent.display(ctx, {
      title: 'Your Watchlists',
      description: 'Here are the cryptocurrencies you\'re tracking:',
      items,
      currentPage,
      showWatchlistNames: true,
      priceFormat: 'USD',
      showPriceChange: true
    });
  } catch (error) {
    logger.error(`Error displaying watchlists: ${error.message}`);
    await showErrorToast(ctx, 'Failed to load watchlists. Please try again.');
    throw error;
  }
}