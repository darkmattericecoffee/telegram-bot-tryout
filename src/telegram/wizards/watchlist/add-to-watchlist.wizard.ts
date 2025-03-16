// src/telegram/wizards/watchlist/add-to-watchlist.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../components/toast.component';
import { WatchlistService } from '../../services/watchlist.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showWatchlistMenu } from '../../menus/submenus/watchlist.menu';
import { CoinSearchComponent, CoinSearchConfig, CoinSearchState } from '../../components/coin-search.component';
import { CoinSearchService } from '../../services/coin-search.service';
import { LoadingMessageComponent, withLoading } from '../../components/loading-message.component';

// Create logger for the wizard
const logger = new Logger('AddToWatchlistWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();
const loadingMessageComponent = new LoadingMessageComponent();

// Define a proper type for scene state that includes coinId
interface AddToWatchlistSceneState {
  coinId?: string;
  [key: string]: any;
}

/**
 * AddToWatchlistWizard - Allows users to add coins to a watchlist
 * Can be launched with or without a predefined coin ID
 */
export const createAddToWatchlistWizard = (
  watchlistService: WatchlistService,
  coinSearchService: CoinSearchService
) => {
  // Initialize the coin search component
  const coinSearchComponent = new CoinSearchComponent(coinSearchService);

  const addToWatchlistWizard = new Scenes.WizardScene<CustomContext>(
    'add-to-watchlist-wizard',
    // Step 1: Initialize and check if we have a coin ID or need to search
    async (ctx) => {
      logger.log('Step 1: Starting Add to Watchlist wizard');

      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {
          coinSearchState: {
            page: 1,
            results: []
          }
        };

        // Check if we already have a coin ID from parameters (passed from action buttons)
        // Access scene state with proper typing
        const sceneState = ctx.scene.state as AddToWatchlistSceneState;
        const coinId = sceneState.coinId;
        
        if (coinId) {
          logger.log(`Coin ID provided: ${coinId}`);
          
          // Load coin details
          await withLoading(
            ctx,
            async () => {
              // Fetch coin details from service
              const coinDetails = await coinSearchService.getCoinById(coinId);
              
              // Store in wizard state
              if (coinDetails) {
                ctx.wizard.state.parameters.selectedCoin = coinDetails;
                logger.log(`Coin details loaded: ${coinDetails.name} (${coinDetails.symbol})`);
              } else {
                logger.error(`Coin with ID ${coinId} not found`);
                await ctx.reply('Could not find the selected coin. Please try searching instead.');
                // Continue to search step
                return await promptForCoinSearch(ctx, coinSearchComponent);
              }
              
              // If successful, proceed to watchlist selection
              return await showWatchlistSelection(ctx, watchlistService);
            },
            {
              messages: [
                'Loading coin details...',
                'Fetching cryptocurrency information...',
                'Getting coin data...'
              ],
              emoji: '🔍'
            }
          );
        } else {
          // No coin ID provided, ask user to search
          await promptForCoinSearch(ctx, coinSearchComponent);
        }
        
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in Add to Watchlist wizard initialization: ${error.message}`);
        await showErrorToast(ctx, 'Failed to start Add to Watchlist wizard. Please try again.');
        await ctx.scene.leave();
        return;
      }
    },

    // Step 2: Handle coin search or show watchlist selection
    async (ctx) => {
      // This step handles text inputs for coin search
      // Or transitions between steps - most logic is in action handlers
      logger.log('Step 2: Handling coin search or transitions');
      return ctx.wizard.next();
    },

    // Step 3: Select watchlist or display search results
    async (ctx) => {
      // This step is for handling watchlist selection
      // Most logic is in action handlers
      logger.log('Step 3: Watchlist selection or search results');
      return ctx.wizard.next();
    },

    // Step 4: Confirm addition and process
    async (ctx) => {
      logger.log('Step 4: Confirming and processing addition');
      
      try {
        const { selectedCoin, selectedWatchlistId, selectedWatchlistName } = ctx.wizard.state.parameters;
        
        if (!selectedCoin || !selectedWatchlistId) {
          await showErrorToast(ctx, 'Missing required information. Please try again.');
          await ctx.scene.leave();
          await showWatchlistMenu(ctx);
          return;
        }
        
        // Get Telegram user ID
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat
        
        // Add coin to watchlist
        await withLoading(
          ctx,
          async () => {
            // Call service to add coin to watchlist
            const updatedWatchlist = await watchlistService.addToWatchlist(
              telegramId,
              isGroup,
              selectedCoin.id,
              selectedWatchlistId
            );
            
            // Show success message
            await showSuccessToast(ctx, `Added ${selectedCoin.name} (${selectedCoin.symbol}) to "${selectedWatchlistName}"!`);
            
            // Show detailed success message
            await ctx.reply(
              `✅ *Success!*\n\nAdded *${selectedCoin.name}* (${selectedCoin.symbol}) to your "${selectedWatchlistName}" watchlist.\n\nYou can now track its price and performance.`,
              { parse_mode: 'Markdown' as any }
            );
            
            // Return to watchlist menu
            await showWatchlistMenu(ctx);
            
            // Leave the scene
            await ctx.scene.leave();
          },
          {
            messages: [
              'Adding to watchlist...',
              'Updating your watchlist...',
              'Saving your selection...'
            ],
            emoji: '💾'
          }
        );
      } catch (error) {
        logger.error(`Error adding coin to watchlist: ${error.message}`);
        await showErrorToast(ctx, 'Failed to add coin to watchlist. Please try again.');
        await ctx.scene.leave();
        await showWatchlistMenu(ctx);
      }
    }
  );

  // Handle text input for coin search
  addToWatchlistWizard.on('text', async (ctx) => {
    logger.log('Processing text input for coin search');
    
    try {
      // Get the search query
      const query = ctx.message.text;
      logger.log(`Search query: "${query}"`);
      
      // Process the search with loading indicator
      await withLoading(
        ctx,
        async () => {
          // Configure search parameters
          const searchConfig = {
            promptText: '',  // Not used here
            fieldName: 'selectedCoin',
            confidenceThreshold: 2.5
          };
          
          // Process the search
          const state = await coinSearchComponent.processSearch(ctx, query, searchConfig);
          
          // Store the search state
          ctx.wizard.state.parameters.coinSearchState = state;
          
          // If we have a high confidence match, store it and proceed
          if (state.selectedCoin) {
            logger.log(`High confidence match found: ${state.selectedCoin.name}`);
            ctx.wizard.state.parameters.selectedCoin = state.selectedCoin;
            
            // Proceed to watchlist selection
            await showWatchlistSelection(ctx, watchlistService);
          } else {
            // Show search results
            logger.log('No high confidence match, showing results');
            await coinSearchComponent.showResults(ctx, state, 'coinsearch');
          }
        },
        {
          messages: [
            'Searching for coins...',
            'Looking up cryptocurrency data...',
            'Fetching market information...'
          ],
          emoji: '🔍'
        }
      );
    } catch (error) {
      logger.error(`Error processing search: ${error.message}`);
      await ctx.reply('An error occurred while searching. Please try again.');
      await promptForCoinSearch(ctx, coinSearchComponent);
    }
  });

  // Coin search result selection
  addToWatchlistWizard.action(/^coinsearch_select_\w+$/, async (ctx) => {
    logger.log('Coin selection action triggered');
    
    // Extract coin ID from callback data
    const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
      ? (ctx.callbackQuery as any).data
      : '';
    
    const coinId = callbackData.split('_').pop();
    logger.log(`Selected coin ID: ${coinId}`);
    
    // Find the selected coin in the results
    const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
    const selectedCoin = state?.results?.find(r => r.coin.id === coinId)?.coin;
    
    if (selectedCoin) {
      // Store the selection
      logger.log(`Found selected coin: ${selectedCoin.name}`);
      ctx.wizard.state.parameters.selectedCoin = selectedCoin;
      
      // Notify the user
      await ctx.answerCbQuery(`Selected ${selectedCoin.name} (${selectedCoin.symbol})`);
      
      // Proceed to watchlist selection
      await showWatchlistSelection(ctx, watchlistService);
    } else {
      logger.error(`Coin not found with ID: ${coinId}`);
      await ctx.answerCbQuery('Error: Coin not found');
      
      // Try again with search
      const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
      if (state) {
        await coinSearchComponent.showResults(ctx, state, 'coinsearch');
      } else {
        await promptForCoinSearch(ctx, coinSearchComponent);
      }
    }
  });

  // Pagination for search results
  addToWatchlistWizard.action(/^coinsearch_next_\d+$/, async (ctx) => {
    logger.log('Next page action triggered');
    
    // Get current state
    const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
    
    if (!state) {
      logger.error('Search state is missing');
      await promptForCoinSearch(ctx, coinSearchComponent);
      return;
    }
    
    // Update page number
    state.page += 1;
    
    // Update the state
    ctx.wizard.state.parameters.coinSearchState = state;
    
    // Show updated results
    await coinSearchComponent.showResults(ctx, state, 'coinsearch');
    
    await ctx.answerCbQuery();
  });

  addToWatchlistWizard.action(/^coinsearch_prev_\d+$/, async (ctx) => {
    logger.log('Previous page action triggered');
    
    // Get current state
    const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
    
    if (!state) {
      logger.error('Search state is missing');
      await promptForCoinSearch(ctx, coinSearchComponent);
      return;
    }
    
    // Update page number (ensure it doesn't go below 1)
    state.page = Math.max(1, state.page - 1);
    
    // Update the state
    ctx.wizard.state.parameters.coinSearchState = state;
    
    // Show updated results
    await coinSearchComponent.showResults(ctx, state, 'coinsearch');
    
    await ctx.answerCbQuery();
  });

  // Handle watchlist selection
  addToWatchlistWizard.action(/^select_watchlist_(.+)$/, async (ctx) => {
    try {
      // Extract watchlist ID from callback data
      const match = /^select_watchlist_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const watchlistId = match[1];
        logger.log(`Selected watchlist ID: ${watchlistId}`);
        
        // Get watchlist details
        const watchlist = await watchlistService.getWatchlistById(watchlistId);
        
        // Store watchlist information
        ctx.wizard.state.parameters.selectedWatchlistId = watchlistId;
        ctx.wizard.state.parameters.selectedWatchlistName = watchlist.name;
        
        // Get selected coin
        const selectedCoin = ctx.wizard.state.parameters.selectedCoin;
        
        // Show confirmation dialog
        const confirmMessage = `Are you sure you want to add *${selectedCoin.name}* (${selectedCoin.symbol}) to "${watchlist.name}"?`;
        
        await confirmationComponent.prompt(ctx, {
          message: confirmMessage,
          confirmButtonText: '✅ Add to Watchlist',
          confirmCallbackData: 'add_to_watchlist_confirm',
          parse_mode: 'Markdown'
        });
        
        ctx.wizard.selectStep(3);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling watchlist selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting watchlist');
      ctx.scene.leave();
      await showWatchlistMenu(ctx);
    }
  });

  // Modified confirmation handler registration
registerConfirmationHandler(
    addToWatchlistWizard,
    'add_to_watchlist_confirm',
    async (ctx) => {
      logger.log('Confirmation received for adding to watchlist');
      
      try {
        // Instead of trying to access middleware directly, use the wizard step handling
        
        // First, make sure we have all the required parameters
        const { selectedCoin, selectedWatchlistId, selectedWatchlistName } = ctx.wizard.state.parameters;
        
        if (!selectedCoin || !selectedWatchlistId) {
          throw new Error('Missing required information');
        }
        
        // Get Telegram user ID
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat
        
        // Add coin to watchlist directly in the confirmation handler
        await withLoading(
          ctx,
          async () => {
            // Call service to add coin to watchlist
            const updatedWatchlist = await watchlistService.addToWatchlist(
              telegramId,
              isGroup,
              selectedCoin.id,
              selectedWatchlistId
            );
            
            // Show only a success toast message (no permanent message)
            await showSuccessToast(ctx, `Added ${selectedCoin.name} (${selectedCoin.symbol}) to "${selectedWatchlistName}"!`, 3000);
            
            // Return to watchlist menu
            await showWatchlistMenu(ctx);
            
            // Leave the scene
            await ctx.scene.leave();
          },
          {
            messages: [
              'Adding to watchlist...',
              'Updating your watchlist...',
              'Saving your selection...'
            ],
            emoji: '💾'
          }
        );
      } catch (error) {
        logger.error(`Error in confirmation handler: ${error.message}`);
        await showErrorToast(ctx, 'Failed to add coin to watchlist. Please try again.');
        await ctx.scene.leave();
        await showWatchlistMenu(ctx);
      }
    }
  );

  // Go back button handler
  addToWatchlistWizard.action('go_back', async (ctx) => {
    logger.log('Go back action triggered');
    
    const currentStep = ctx.wizard.cursor;
    
    // If we're in the search results, go back to search prompt
    if (currentStep === 2 && ctx.wizard.state.parameters.coinSearchState) {
      logger.log('Going back to coin search prompt');
      await promptForCoinSearch(ctx, coinSearchComponent);
      return;
    }
    
    // If we're in the watchlist selection, and we came from search, go back to search results
    if (currentStep === 3 && ctx.wizard.state.parameters.coinSearchState?.results?.length > 0) {
      logger.log('Going back to search results');
      const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
      await coinSearchComponent.showResults(ctx, state, 'coinsearch');
      ctx.wizard.selectStep(2);
      return;
    }
    
    // Otherwise, leave the wizard and return to watchlist menu
    logger.log('Leaving Add to Watchlist wizard');
    await ctx.scene.leave();
    await showWatchlistMenu(ctx);
  });

  return addToWatchlistWizard;
};

/**
 * Helper function to prompt user for coin search
 */
async function promptForCoinSearch(ctx: CustomContext, coinSearchComponent: CoinSearchComponent): Promise<void> {
  const searchConfig: CoinSearchConfig = {
    promptText: '🔍 *Search for a cryptocurrency:*\n\nPlease enter the name or symbol of the coin you want to add to your watchlist.',
    fieldName: 'selectedCoin',
    confidenceThreshold: 2.5,
    searchCallbackPrefix: 'coinsearch'
  };
  
  await coinSearchComponent.prompt(ctx, searchConfig);
}

/**
 * Helper function to show watchlist selection
 */
async function showWatchlistSelection(ctx: CustomContext, watchlistService: WatchlistService): Promise<void> {
  logger.log('Showing watchlist selection');
  
  const selectedCoin = ctx.wizard.state.parameters.selectedCoin;
  
  if (!selectedCoin) {
    logger.error('No coin selected');
    await ctx.reply('Error: No coin selected. Please try again.');
    await ctx.scene.leave();
    await showWatchlistMenu(ctx);
    return;
  }
  
  try {
    // Get the telegram ID
    const telegramId = String(ctx.from?.id || '');
    const isGroup = false; // Assume personal chat
    
    // Get user's watchlists
    const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
    
    if (watchlists.length === 0) {
      logger.log('No watchlists found, prompting to create one');
      
      // Show message that user has no watchlists
      await ctx.reply(`You don't have any watchlists yet. Would you like to create one?`);
      
      // Provide buttons to create watchlist or cancel
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Create Watchlist', 'create_watchlist')],
        [createGoBackButton()]
      ]);
      
      await ctx.reply('Choose an option:', {
        reply_markup: keyboard.reply_markup
      });
      
      return;
    }
    
    // Build message with selected coin info
    const messageText = `Selected coin: *${selectedCoin.name}* (${selectedCoin.symbol})\n\nChoose a watchlist to add it to:`;
    
    // Create buttons for each watchlist
    const buttons = watchlists.map(watchlist => {
      return [Markup.button.callback(
        watchlist.name,
        `select_watchlist_${watchlist.id}`
      )];
    });
    
    // Add create new watchlist button
    buttons.push([
      Markup.button.callback('➕ Create New Watchlist', 'create_watchlist')
    ]);
    
    // Add back button
    buttons.push([createGoBackButton()]);
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    await ctx.reply(messageText, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'Markdown' as any
    });
  } catch (error) {
    logger.error(`Error showing watchlist selection: ${error.message}`);
    await ctx.reply('Error loading watchlists. Please try again.');
    await ctx.scene.leave();
    await showWatchlistMenu(ctx);
  }
}