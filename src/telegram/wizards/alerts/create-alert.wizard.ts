// src/telegram/wizards/alerts/create-alert.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { AlertService, AlertType, TimeFrame, Pairing } from '../../services/alert.service';
import { WatchlistService } from '../../services/watchlist.service';
import { CoinSearchComponent, CoinSearchConfig } from '../../components/coin-search.component';
import { CoinSearchService } from '../../services/coin-search.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../menus/sub.menu/alerts.menu';
import { LoadingMessageComponent, withLoading } from '../../components/loading-message.component';
import { TextInputComponent, registerTextInputHandlers } from '../../components/text-input.component';

// Create logger
const logger = new Logger('CreateAlertWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();
const loadingMessageComponent = new LoadingMessageComponent();
const textInputComponent = new TextInputComponent();

// Define a proper type for scene state
interface CreateAlertSceneState {
  isDiscoveryAlert?: boolean;
  coinId?: string;
  watchlistId?: string;
  [key: string]: any;
}

/**
 * CreateAlertWizard - Guides user through creating a new alert
 */
export const createCreateAlertWizard = (
  alertService: AlertService,
  watchlistService: WatchlistService,
  coinSearchService: CoinSearchService
) => {
  // Initialize the coin search component
  const coinSearchComponent = new CoinSearchComponent(coinSearchService);
  
  const createAlertWizard = new Scenes.WizardScene<CustomContext>(
    'create-alert-wizard',
    // Step 1: Ask user to select alert type (watchlist or discovery)
    async (ctx) => {
      logger.log('Step 1: Entering create alert wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        // Check if we have a preset from scene state
        const sceneState = ctx.scene.state as CreateAlertSceneState || {};
        
        // If discovery alert is specified, skip to step 3
        if (sceneState.isDiscoveryAlert === true) {
          logger.log('Discovery alert specified, skipping to discovery alert setup');
          ctx.wizard.state.parameters.isDiscoveryAlert = true;
          return await setupDiscoveryAlert(ctx);
        }
        
        // If a coin ID is provided, skip to selecting a watchlist
        if (sceneState.coinId) {
          logger.log(`Coin ID provided: ${sceneState.coinId}`);
          
          // Load coin details
          await withLoading(
            ctx,
            async () => {
              // Fetch coin details
              const coinDetails = await coinSearchService.getCoinById(sceneState.coinId || '');
              
              if (coinDetails) {
                // Store in wizard state
                ctx.wizard.state.parameters.selectedCoin = coinDetails;
                logger.log(`Coin details loaded: ${coinDetails.name}`);
                
                // Set flag that this is a watchlist alert
                ctx.wizard.state.parameters.isDiscoveryAlert = false;
                
                // Skip to watchlist selection
                if (sceneState.watchlistId) {
                  // Watchlist already specified
                  ctx.wizard.state.parameters.selectedWatchlistId = sceneState.watchlistId;
                  
                  // Load watchlist details
                  const watchlist = await watchlistService.getWatchlistById(sceneState.watchlistId || '');
                  
                  if (watchlist) {
                    ctx.wizard.state.parameters.selectedWatchlistName = watchlist.name;
                    
                    // Skip to alert type selection
                    return await showAlertTypeOptions(ctx);
                  }
                }
                
                // No watchlist specified or not found, show watchlist selection
                return await showWatchlistSelection(ctx, watchlistService);
              } else {
                logger.error(`Coin with ID ${sceneState.coinId} not found`);
                await ctx.reply('Could not find the selected coin.');
                // Continue with regular flow
              }
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
        }
        
        // No presets, ask user to select alert type
        const messageText = '🔔 *Create New Alert*\n\nWhat type of alert would you like to create?';
        
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('📋 Watchlist Alert', 'select_alert_watchlist'),
            Markup.button.callback('🔎 Discovery Alert', 'select_alert_discovery')
          ],
          [createGoBackButton()]
        ]);
        
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
        
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in create alert wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to start Create Alert wizard. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    },
    
    // Step 2: Handle selections and show appropriate next screens
    async (ctx) => {
      // This step is just for handling actions
      return ctx.wizard.next();
    },
    
    // Step 3: Collect alert parameters
    async (ctx) => {
      // This step handles collecting alert parameters
      return ctx.wizard.next();
    },
    
    // Step 4: Confirm alert details
    async (ctx) => {
      // This step handles showing alert confirmation
      return ctx.wizard.next();
    },
    
    // Step 5: Create the alert
    async (ctx) => {
      logger.log('Step 5: Creating the alert');
      
      try {
        const parameters = ctx.wizard.state.parameters;
        
        if (!parameters.alertType || 
            !parameters.threshold || 
            !parameters.timeframe || 
            !parameters.pairing) {
          await showErrorToast(ctx, 'Missing required alert parameters.');
          await ctx.scene.leave();
          await showAlertsMenu(ctx);
          return;
        }
        
        // Get the telegram ID
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat
        
        // Prepare alert creation DTO
        const createAlertDto: any = {
          userId: telegramId, // For mock service, we use telegramId as userId too
          telegramUserId: telegramId,
          alertType: parameters.alertType,
          threshold: parameters.threshold,
          timeframe: parameters.timeframe,
          pairing: parameters.pairing,
          message: parameters.alertMessage || '',
          isDiscoveryAlert: parameters.isDiscoveryAlert
        };
        
        // Add coin identifier for watchlist alerts
        if (!parameters.isDiscoveryAlert && parameters.selectedCoin) {
          createAlertDto.coinIdentifier = parameters.selectedCoin.identifier || parameters.selectedCoin.id;
        }
        
        // Add watchlist ID for watchlist alerts
        if (!parameters.isDiscoveryAlert && parameters.selectedWatchlistId) {
          createAlertDto.watchlistId = parameters.selectedWatchlistId;
        }
        
        // Create the alert with loading indicator
        await withLoading(
          ctx,
          async () => {
            // Create the alert
            const newAlert = await alertService.createAlert(createAlertDto);
            
            // Prepare success message
            let successMessage = '';
            
            if (parameters.isDiscoveryAlert) {
              successMessage = `Discovery Alert created for ${AlertService.getAlertTypeName(parameters.alertType)}!`;
            } else {
              const coinName = parameters.selectedCoin?.name || 'Unknown Coin';
              const watchlistName = parameters.selectedWatchlistName || 'your watchlist';
              successMessage = `Alert created for ${coinName} in ${watchlistName}!`;
            }
            
            await showSuccessToast(ctx, successMessage);
            
            // Show detailed success message
            const detailMessage = parameters.isDiscoveryAlert
              ? `🔔 *Discovery Alert Created*\n\nType: ${AlertService.getAlertTypeName(parameters.alertType)}\nThreshold: ${parameters.threshold}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}\nPairing: ${parameters.pairing}`
              : `🔔 *Watchlist Alert Created*\n\nCoin: ${parameters.selectedCoin?.name}\nType: ${AlertService.getAlertTypeName(parameters.alertType)}\nThreshold: ${parameters.threshold}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}\nWatchlist: ${parameters.selectedWatchlistName}`;
              
            await ctx.reply(detailMessage, { parse_mode: 'Markdown' });
          },
          {
            messages: [
              'Creating your alert...',
              'Setting up alert parameters...',
              'Configuring alert settings...',
              'Almost done...'
            ],
            emoji: '🔔'
          }
        );
        
        // Return to alerts menu
        await showAlertsMenu(ctx);
        
        return ctx.scene.leave();
      } catch (error) {
        logger.error(`Error creating alert: ${error.message}`);
        await showErrorToast(ctx, `Failed to create alert: ${error.message}`);
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
        return;
      }
    }
  );
  
  // Handler for alert type selection
  createAlertWizard.action(/^select_alert_(watchlist|discovery)$/, async (ctx) => {
    try {
      // Extract alert type from callback data
      const match = /^select_alert_(watchlist|discovery)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const alertType = match[1];
        logger.log(`Selected alert type: ${alertType}`);
        
        // Store selected alert type
        ctx.wizard.state.parameters.isDiscoveryAlert = alertType === 'discovery';
        
        if (alertType === 'discovery') {
          // Set up discovery alert
          await setupDiscoveryAlert(ctx);
        } else {
          // For watchlist alert, first prompt for coin search
          await promptForCoinSearch(ctx, coinSearchComponent);
        }
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling alert type selection: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // Handler for coin search text input
  createAlertWizard.on('text', async (ctx) => {
    // Only process if this is in the coin search step
    if (ctx.wizard.cursor !== 2 || ctx.wizard.state.parameters.selectedCoin) {
      // Check if we're awaiting an alert message
      if (ctx.wizard.state.parameters.awaitingAlertMessage) {
        logger.log('Received alert message text');
        
        // Store the alert message
        ctx.wizard.state.parameters.alertMessage = ctx.message.text;
        
        // Clear the awaiting flag
        ctx.wizard.state.parameters.awaitingAlertMessage = false;
        
        // Show confirmation
        await showAlertConfirmation(ctx);
        return;
      }
      
      // Check if we're awaiting a threshold
      if (ctx.wizard.state.parameters.awaitingThreshold) {
        logger.log('Received threshold text');
        
        // Store the threshold temporarily in alertMessage field
        ctx.wizard.state.parameters.alertMessage = ctx.message.text;
        
        // Show submit button again
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Submit', 'threshold_submit')],
          [createGoBackButton()]
        ]);
        
        await ctx.reply(`Received: ${ctx.message.text}\nPress Submit to continue.`, {
          reply_markup: keyboard.reply_markup
        });
        
        return;
      }
      
      return;
    }
    
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
  
  // Handler for coin search result selection
  createAlertWizard.action(/^coinsearch_select_\w+$/, async (ctx) => {
    logger.log('Coin selection action triggered');
    
    try {
      // Extract coin ID from callback data
      const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
        ? (ctx.callbackQuery as any).data
        : '';
      
      const coinId = callbackData.split('_').pop();
      logger.log(`Selected coin ID: ${coinId}`);
      
      // Get the search state
      const state = ctx.wizard.state.parameters.coinSearchState;
      
      if (!state || !state.results) {
        logger.error('Search state is missing');
        await ctx.answerCbQuery('Error: Search data not found');
        return;
      }
      
      // Find the selected coin in the results
      const selectedCoin = state.results.find(r => r.coin.id === coinId)?.coin;
      
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
        
        // Return to coin search
        await promptForCoinSearch(ctx, coinSearchComponent);
      }
    } catch (error) {
      logger.error(`Error handling coin selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting coin');
    }
  });
  
  // Handler for watchlist selection
  createAlertWizard.action(/^select_watchlist_(.+)$/, async (ctx) => {
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
        
        if (!watchlist) {
          await ctx.answerCbQuery('Watchlist not found');
          return;
        }
        
        // Store watchlist information
        ctx.wizard.state.parameters.selectedWatchlistId = watchlistId;
        ctx.wizard.state.parameters.selectedWatchlistName = watchlist.name;
        
        // Proceed to alert type selection
        await showAlertTypeOptions(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling watchlist selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting watchlist');
    }
  });
  
  // Handler for alert type options selection
  createAlertWizard.action(/^alert_type_(.+)$/, async (ctx) => {
    try {
      // Extract alert type from callback data
      const match = /^alert_type_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const selectedAlertType = match[1];
        logger.log(`Selected alert type: ${selectedAlertType}`);
        
        // Store alert type
        ctx.wizard.state.parameters.alertType = selectedAlertType;
        
        // Show threshold input
        await showThresholdInput(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling alert type selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting alert type');
    }
  });
  
  // Handler for timeframe selection
  createAlertWizard.action(/^timeframe_(.+)$/, async (ctx) => {
    try {
      // Extract timeframe from callback data
      const match = /^timeframe_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const selectedTimeframe = match[1];
        logger.log(`Selected timeframe: ${selectedTimeframe}`);
        
        // Store timeframe
        ctx.wizard.state.parameters.timeframe = selectedTimeframe;
        
        // Show pairing options
        await showPairingOptions(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling timeframe selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting timeframe');
    }
  });
  
  // Handler for pairing selection
  createAlertWizard.action(/^pairing_(.+)$/, async (ctx) => {
    try {
      // Extract pairing from callback data
      const match = /^pairing_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const selectedPairing = match[1];
        logger.log(`Selected pairing: ${selectedPairing}`);
        
        // Store pairing
        ctx.wizard.state.parameters.pairing = selectedPairing;
        
        // Show alert message input
        await showAlertMessageInput(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pairing selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting pairing');
    }
  });
  
  // Register text input handler for threshold
  createAlertWizard.action(/^threshold_submit$/, async (ctx) => {
    try {
      logger.log('Threshold submitted');
      
      // Get the threshold from input (stored temporarily in alertMessage field)
      const thresholdStr = ctx.wizard.state.parameters.alertMessage;
      
      if (!thresholdStr) {
        await ctx.answerCbQuery('Please enter a threshold value');
        return;
      }
      
      // Validate threshold
      const threshold = parseFloat(thresholdStr);
      
      if (isNaN(threshold)) {
        await ctx.answerCbQuery('Please enter a valid number');
        return;
      }
      
      // Store threshold
      ctx.wizard.state.parameters.threshold = threshold;
      
      // Clear temporary alertMessage
      delete ctx.wizard.state.parameters.alertMessage;
      
      // Show timeframe options
      await showTimeframeOptions(ctx);
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling threshold submission: ${error.message}`);
      await ctx.answerCbQuery('Error processing threshold');
    }
  });
  
  // Handler for alert message submission
  createAlertWizard.action(/^message_submit$/, async (ctx) => {
    try {
      logger.log('Alert message submitted');
      
      // Show confirmation
      await showAlertConfirmation(ctx);
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling message submission: ${error.message}`);
      await ctx.answerCbQuery('Error processing message');
    }
  });
  
  // Register confirmation handler
  registerConfirmationHandler(
    createAlertWizard,
    'create_alert_confirm',
    async (ctx) => {
      // Move to the step that handles alert creation
      ctx.wizard.selectStep(4);
      
      const currentIndex = ctx.wizard.cursor;
      // Use the middleware directly
      if (currentIndex < createAlertWizard.middleware().length) {
        return createAlertWizard.middleware()[currentIndex](ctx, async () => {});
      }
      
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
      return;
    }
  );
  
  // Go back button handler
  createAlertWizard.action('go_back', async (ctx) => {
    logger.log('Go back action triggered');
  
    const currentStep = ctx.wizard.cursor;
    const parameters = ctx.wizard.state.parameters;
  
    // Reset any awaiting input flags to prevent getting stuck
    parameters.awaitingThreshold = false;
    parameters.awaitingAlertMessage = false;
  
    // Handle navigation based on current step and state
    if (parameters.isDiscoveryAlert) {
      if (parameters.pairing) {
        // Back from message input to pairing selection
        await showPairingOptions(ctx);
        ctx.wizard.selectStep(3); // Ensure step aligns with pairing selection
      } else if (parameters.timeframe) {
        // Back from pairing to timeframe
        await showTimeframeOptions(ctx);
        ctx.wizard.selectStep(2);
      } else if (parameters.threshold) {
        // Back from timeframe to threshold
        await showThresholdInput(ctx);
        ctx.wizard.selectStep(2);
      } else if (parameters.alertType) {
        // Back from threshold to alert type selection
        await setupDiscoveryAlert(ctx);
        ctx.wizard.selectStep(2);
      } else {
        // No parameters set, exit to alerts menu
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    } else {
      // Watchlist alerts
      if (parameters.pairing) {
        await showPairingOptions(ctx);
        ctx.wizard.selectStep(3);
      } else if (parameters.timeframe) {
        await showTimeframeOptions(ctx);
        ctx.wizard.selectStep(2);
      } else if (parameters.threshold) {
        await showThresholdInput(ctx);
        ctx.wizard.selectStep(2);
      } else if (parameters.alertType) {
        await showAlertTypeOptions(ctx);
        ctx.wizard.selectStep(2);
      } else if (parameters.selectedWatchlistId) {
        await showWatchlistSelection(ctx, watchlistService);
        ctx.wizard.selectStep(2);
      } else if (parameters.selectedCoin) {
        await promptForCoinSearch(ctx, coinSearchComponent);
        ctx.wizard.selectStep(2);
      } else {
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    }
  
    await ctx.answerCbQuery();
  });
  
  return createAlertWizard;
};

/**
 * Helper function to prompt for coin search
 */
async function promptForCoinSearch(ctx: CustomContext, coinSearchComponent: CoinSearchComponent): Promise<void> {
  const searchConfig: CoinSearchConfig = {
    promptText: '🔍 *Search for a cryptocurrency:*\n\nPlease enter the name or symbol of the coin you want to set an alert for.',
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
    await showAlertsMenu(ctx);
    return;
  }
  
  try {
    // Get the telegram ID
    const telegramId = String(ctx.from?.id || '');
    const isGroup = false; // Assume personal chat
    
    // Show loading indicator while fetching watchlists
    await withLoading(
      ctx,
      async () => {
        // Get user's watchlists
        const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
        
        if (watchlists.length === 0) {
          logger.log('No watchlists found');
          
          // Show message that user has no watchlists
          await ctx.reply(`You don't have any watchlists yet. Please create a watchlist first.`);
          
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
        const messageText = `Selected coin: *${selectedCoin.name}* (${selectedCoin.symbol})\n\nChoose a watchlist to add the alert to:`;
        
        // Create buttons for each watchlist
        const buttons = watchlists.map(watchlist => {
          return [Markup.button.callback(
            watchlist.name,
            `select_watchlist_${watchlist.id}`
          )];
        });
        
        // Add back button
        buttons.push([createGoBackButton()]);
        
        const keyboard = Markup.inlineKeyboard(buttons);
        
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      },
      {
        messages: [
          'Loading your watchlists...',
          'Fetching watchlist data...',
          'Getting your watchlist information...'
        ],
        emoji: '📋'
      }
    );
  } catch (error) {
    logger.error(`Error showing watchlist selection: ${error.message}`);
    await ctx.reply('Error loading watchlists. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
  }
}

/**
 * Helper function to set up a discovery alert
 */
async function setupDiscoveryAlert(ctx: CustomContext): Promise<void> {
  logger.log('Setting up discovery alert');
  
  // Store that this is a discovery alert
  ctx.wizard.state.parameters.isDiscoveryAlert = true;
  
  // Build the message explaining discovery alerts
  const messageText = `
🔎 *Create Discovery Alert*

Discovery alerts notify you about market-wide opportunities based on technical indicators, without selecting a specific coin.

Select the type of discovery alert you want to create:
`;

  // Create buttons for each alert type
  const buttons = [
    [
      Markup.button.callback('RSI Overbought', `alert_type_${AlertType.RSI_OVERBOUGHT}`),
      Markup.button.callback('RSI Oversold', `alert_type_${AlertType.RSI_OVERSOLD}`)
    ],
    [
      Markup.button.callback('MACD Crossover', `alert_type_${AlertType.MACD_CROSSOVER}`),
      Markup.button.callback('MACD Crossunder', `alert_type_${AlertType.MACD_CROSSUNDER}`)
    ],
    [
      Markup.button.callback('MA Crossover', `alert_type_${AlertType.MOVING_AVERAGE_CROSSOVER}`),
      Markup.button.callback('MA Crossunder', `alert_type_${AlertType.MOVING_AVERAGE_CROSSUNDER}`)
    ],
    [createGoBackButton()]
  ];
  
  const keyboard = Markup.inlineKeyboard(buttons);
  
  await ctx.reply(messageText, {
    reply_markup: keyboard.reply_markup,
    parse_mode: 'Markdown'
  });
}

/**
 * Helper function to show alert type options for watchlist alerts
 */
async function showAlertTypeOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing alert type options');
  
  const selectedCoin = ctx.wizard.state.parameters.selectedCoin;
  const selectedWatchlistName = ctx.wizard.state.parameters.selectedWatchlistName;
  
  if (!selectedCoin || !selectedWatchlistName) {
    logger.error('Missing coin or watchlist data');
    await ctx.reply('Error: Missing required information. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
    return;
  }
  
  // Build the message
  const messageText = `
📋 *Create Alert for ${selectedCoin.name}*
Watchlist: ${selectedWatchlistName}

Select the type of alert you want to create:
`;

  // Create buttons for each alert type
  const buttons = [
    [
      Markup.button.callback('Price Above', `alert_type_${AlertType.PRICE_UP}`),
      Markup.button.callback('Price Below', `alert_type_${AlertType.PRICE_DOWN}`)
    ],
    [
      Markup.button.callback('Price Up %', `alert_type_${AlertType.PRICE_PERCENTAGE_UP}`),
      Markup.button.callback('Price Down %', `alert_type_${AlertType.PRICE_PERCENTAGE_DOWN}`)
    ],
    [
      Markup.button.callback('Volume Above', `alert_type_${AlertType.VOLUME_UP}`),
      Markup.button.callback('Volume Below', `alert_type_${AlertType.VOLUME_DOWN}`)
    ],
    [createGoBackButton()]
  ];
  
  const keyboard = Markup.inlineKeyboard(buttons);
  
  await ctx.reply(messageText, {
    reply_markup: keyboard.reply_markup,
    parse_mode: 'Markdown'
  });
}

/**
 * Helper function to show threshold input
 */
async function showThresholdInput(ctx: CustomContext): Promise<void> {
  logger.log('Showing threshold input');
  
  const parameters = ctx.wizard.state.parameters;
  const alertTypeName = AlertService.getAlertTypeName(parameters.alertType);
  
  let promptText = '';
  let placeholderText = '';
  
  // Customize prompt based on alert type
  if (parameters.isDiscoveryAlert) {
    if (parameters.alertType.includes('RSI')) {
      promptText = `*Enter RSI Threshold*\n\nEnter a value between 0-100:\n• RSI Overbought: typically 70-80\n• RSI Oversold: typically 20-30`;
      placeholderText = parameters.alertType === AlertType.RSI_OVERBOUGHT ? '70' : '30';
    } else if (parameters.alertType.includes('MACD')) {
      promptText = `*Enter MACD Threshold*\n\nEnter a sensitivity value (typically between 0.1-2):`;
      placeholderText = '0.5';
    } else {
      promptText = `*Enter Moving Average Threshold*\n\nEnter a threshold value:`;
      placeholderText = '0.2';
    }
  } else {
    if (parameters.alertType.includes('PRICE_UP') || parameters.alertType.includes('PRICE_DOWN')) {
      promptText = `*Enter ${alertTypeName} Threshold*\n\nEnter the price value:`;
      placeholderText = parameters.alertType.includes('PERCENTAGE') ? '5' : '1000';
    } else {
      promptText = `*Enter ${alertTypeName} Threshold*\n\nEnter the volume value:`;
      placeholderText = '1000000';
    }
  }
  
  // Add instruction for text input
  promptText += `\n\nType your value and then press the Submit button.`;
  
  // Create custom keyboard with submit button
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Submit', 'threshold_submit')],
    [createGoBackButton()]
  ]);
  
  await ctx.reply(promptText, {
    reply_markup: keyboard.reply_markup,
    parse_mode: 'Markdown'
  });
  
  // Set up text input handler for the threshold
  ctx.wizard.state.parameters.awaitingThreshold = true;
}

/**
 * Helper function to show timeframe options
 */
async function showTimeframeOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing timeframe options');
  
  const parameters = ctx.wizard.state.parameters;
  
  // Build the message
  let messageText = parameters.isDiscoveryAlert
    ? `*Select Timeframe for ${AlertService.getAlertTypeName(parameters.alertType)}*\n\nThreshold: ${parameters.threshold}`
    : `*Select Timeframe for ${parameters.selectedCoin.name}*\n\nAlert Type: ${AlertService.getAlertTypeName(parameters.alertType)}\nThreshold: ${parameters.threshold}`;
    
  // Create buttons for each timeframe
  const buttons = [
    [
      
      Markup.button.callback('1h', `timeframe_${TimeFrame.H1}`),
      Markup.button.callback('4h', `timeframe_${TimeFrame.H4}`),
      Markup.button.callback('6h', `timeframe_${TimeFrame.H6}`)
    ],
    [
      Markup.button.callback('12h', `timeframe_${TimeFrame.H12}`),
      Markup.button.callback('1d', `timeframe_${TimeFrame.D1}`),
      Markup.button.callback('1w', `timeframe_${TimeFrame.W1}`)
    ],
    [createGoBackButton()]
  ];
  
  const keyboard = Markup.inlineKeyboard(buttons);
  
  await ctx.reply(messageText, {
    reply_markup: keyboard.reply_markup,
    parse_mode: 'Markdown'
  });
}

/**
 * Helper function to show pairing options
 */
async function showPairingOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing pairing options');
  
  const parameters = ctx.wizard.state.parameters;
  
  // Build the message
  let messageText = parameters.isDiscoveryAlert
    ? `*Select Pairing for ${AlertService.getAlertTypeName(parameters.alertType)}*\n\nThreshold: ${parameters.threshold}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}`
    : `*Select Pairing for ${parameters.selectedCoin.name}*\n\nAlert Type: ${AlertService.getAlertTypeName(parameters.alertType)}\nThreshold: ${parameters.threshold}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}`;
    
  // Create buttons for each pairing
  const buttons = [
    [
      Markup.button.callback('USD', `pairing_${Pairing.USD}`),
      Markup.button.callback('BTC', `pairing_${Pairing.BTC}`),
      Markup.button.callback('ETH', `pairing_${Pairing.ETH}`)
    ],
    [createGoBackButton()]
  ];
  
  const keyboard = Markup.inlineKeyboard(buttons);
  
  await ctx.reply(messageText, {
    reply_markup: keyboard.reply_markup,
    parse_mode: 'Markdown'
  });
}

/**
 * Helper function to show alert message input
 */
async function showAlertMessageInput(ctx: CustomContext): Promise<void> {
  logger.log('Showing alert message input');
  
  const parameters = ctx.wizard.state.parameters;
  
  // Build the message
  let messageText = parameters.isDiscoveryAlert
    ? `*Enter Alert Message (Optional)*\n\nType: ${AlertService.getAlertTypeName(parameters.alertType)}\nThreshold: ${parameters.threshold}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}\nPairing: ${parameters.pairing}\n\nYou can enter a custom message that will be sent when the alert triggers, or press Skip to use the default message.`
    : `*Enter Alert Message (Optional)*\n\nCoin: ${parameters.selectedCoin.name}\nType: ${AlertService.getAlertTypeName(parameters.alertType)}\nThreshold: ${parameters.threshold}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}\nPairing: ${parameters.pairing}\n\nYou can enter a custom message that will be sent when the alert triggers, or press Skip to use the default message.`;
    
  // Create keyboard with skip and back buttons
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Skip', 'message_submit')],
    [createGoBackButton()]
  ]);
  
  await ctx.reply(messageText, {
    reply_markup: keyboard.reply_markup,
    parse_mode: 'Markdown'
  });
  
  // Set up handler for alert message text
  ctx.wizard.state.parameters.awaitingAlertMessage = true;
  

}

/**
 * Helper function to show alert confirmation
 */
async function showAlertConfirmation(ctx: CustomContext): Promise<void> {
  logger.log('Showing alert confirmation');
  
  const parameters = ctx.wizard.state.parameters;
  
  // Build the confirmation message
  let messageText = '';
  
  if (parameters.isDiscoveryAlert) {
    messageText = `
🔔 *Confirm Discovery Alert*

Type: ${AlertService.getAlertTypeName(parameters.alertType)}
Threshold: ${parameters.threshold}
Timeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}
Pairing: ${parameters.pairing}
${parameters.alertMessage ? `Message: "${parameters.alertMessage}"` : ''}

Are you sure you want to create this alert?
`;
  } else {
    messageText = `
🔔 *Confirm Alert*

Coin: ${parameters.selectedCoin.name} (${parameters.selectedCoin.symbol})
Watchlist: ${parameters.selectedWatchlistName}
Type: ${AlertService.getAlertTypeName(parameters.alertType)}
Threshold: ${parameters.threshold}
Timeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}
Pairing: ${parameters.pairing}
${parameters.alertMessage ? `Message: "${parameters.alertMessage}"` : ''}

Are you sure you want to create this alert?
`;
  }
  
  // Show confirmation dialog
  await confirmationComponent.prompt(ctx, {
    message: messageText,
    confirmButtonText: '✅ Create Alert',
    confirmCallbackData: 'create_alert_confirm',
    parse_mode: 'Markdown'
  });
}