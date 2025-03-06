import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../../components/feedback.component';
import { AlertService, AlertType, TimeFrame, Pairing } from '../../../services/alert.service';
import { LoadingMessageComponent, withLoading } from '../../../components/loading-message.component';
import { CoinSearchComponent, CoinSearchConfig } from '../../../components/coin-search.component';
import { CoinSearchService } from '../../../services/coin-search.service';
import { createGoBackButton } from '../../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../../menus/sub.menu/alerts.menu';
import { OptionsService, OptionsType } from '../../../services/options.service';
import { PairTimePickerComponent, PairTimePickerComponentCallbackHandler, PickerState } from '../../../components/pair-time-picker.component';
import { MultiPickerComponent, MultiPickerCallbackHandler, MultiPickerState } from '../../../components/multi-picker.component';

// Create logger
const logger = new Logger('DiscoveryAlertWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();
const loadingMessageComponent = new LoadingMessageComponent();
const optionsService = new OptionsService();
const pairTimePicker = new PairTimePickerComponent();
const pairTimePickerHandler = new PairTimePickerComponentCallbackHandler();
const multiPicker = new MultiPickerComponent();
const multiPickerHandler = new MultiPickerCallbackHandler();

/**
 * DiscoveryAlertWizard - Guides user through creating a new discovery alert.
 *
 * New flow:
 * Step 0: Coin Search
 * Step 1: Alert Type Selection
 * Step 2: Indicator Selection
 * Step 3: Transition Type Selection (only for Market Transition alerts)
 * Step 4: Pair & Timeframe Selection
 * Step 5: Confirmation
 * Step 6: Alert Creation
 */
export const createDiscoveryAlertWizard = (
  alertService: AlertService,
  coinSearchService: CoinSearchService
) => {
  // Initialize the coin search component
  const coinSearchComponent = new CoinSearchComponent(coinSearchService);
  
  const discoveryAlertWizard = new Scenes.WizardScene<CustomContext>(
    'discovery-alert-wizard',
    // Step 0: Coin search
    async (ctx) => {
      logger.log('Step 0: Starting discovery alert wizard - coin search');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        // Show coin search prompt
        await promptForCoinSearch(ctx, coinSearchComponent);
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in discovery alert wizard (coin search): ${error.message}`);
        await showErrorToast(ctx, 'Failed to start Discovery Alert wizard. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    },
    
    // Step 1: Alert type selection (handled via callback)
    async (ctx) => {
      return ctx.wizard.next();
    },
    
    // Step 2: Indicator selection (handled via callback)
    async (ctx) => {
      return ctx.wizard.next();
    },
    
    // Step 3: Transition type selection (only for MARKET_TRANSITION alerts, handled via callback)
    async (ctx) => {
      if (ctx.wizard.state.parameters.alertType === AlertType.MARKET_TRANSITION) {
        return ctx.wizard.next();
      } else {
        // If not a market transition alert, skip to next step.
        return ctx.wizard.next();
      }
    },
    
    // Step 4: Pair & Timeframe selection (handled via callback)
    async (ctx) => {
      return ctx.wizard.next();
    },
    
    // Step 5: Confirmation (handled via confirmation component)
    async (ctx) => {
      return ctx.wizard.next();
    },
    
    // Step 6: Alert creation
    async (ctx) => {
      logger.log('Step 6: Creating the discovery alert');
      
      try {
        const parameters = ctx.wizard.state.parameters;
        
        if (!parameters.selectedCoin || 
            !parameters.alertType || 
            !parameters.pickerState) {
          await showErrorToast(ctx, 'Missing required alert parameters.');
          await ctx.scene.leave();
          await showAlertsMenu(ctx);
          return;
        }
        
        // Get the telegram ID
        const telegramId = String(ctx.from?.id || '');
        
        // Map timeframe and pairing
        const timeframe = mapTimeframeToAlertFormat(parameters.pickerState.selectedTimeframe);
        const pairing = mapPairingToAlertFormat(parameters.pickerState.selectedPairing);
        
        // Prepare alert creation DTO
        const createAlertDto: any = {
          userId: telegramId,
          telegramUserId: telegramId,
          coinIdentifier: parameters.selectedCoin.identifier || parameters.selectedCoin.id,
          alertType: parameters.alertType,
          timeframe: timeframe,
          pairing: pairing,
          isDiscoveryAlert: true
        };
        
        // Add transition types if applicable
        if (parameters.alertType === AlertType.MARKET_TRANSITION && parameters.transitionTypes) {
          createAlertDto.transitionTypes = parameters.transitionTypes;
        }
        
        // Add indicators if selected
        if (parameters.selectedIndicators && parameters.selectedIndicators.length > 0) {
          createAlertDto.indicators = parameters.selectedIndicators;
        }
        
        // Create the alert with a loading indicator
        await withLoading(
          ctx,
          async () => {
            const newAlert = await alertService.createAlert(createAlertDto);
            const successMessage = `Discovery Alert created for ${parameters.selectedCoin.name}!`;
            
            await showSuccessToast(ctx, successMessage);
            
            let detailMessage = `🔔 *Discovery Alert Created*\n\nCoin: ${parameters.selectedCoin.name} (${parameters.selectedCoin.symbol})\nType: ${getAlertTypeName(parameters.alertType)}\nTimeframe: ${parameters.pickerState.selectedTimeframe}\nPairing: ${parameters.pickerState.selectedPairing}`;
            
            if (parameters.alertType === AlertType.MARKET_TRANSITION && parameters.transitionTypes) {
              detailMessage += `\nTransition Types: ${parameters.transitionTypes.join(', ')}`;
            }
            
            if (parameters.selectedIndicators && parameters.selectedIndicators.length > 0) {
              detailMessage += `\nIndicators: ${parameters.selectedIndicators.join(', ')}`;
            }
              
            await ctx.reply(detailMessage, { parse_mode: 'Markdown' });
          },
          {
            messages: [
              'Creating your discovery alert...',
              'Setting up alert parameters...',
              'Configuring alert settings...',
              'Almost done...'
            ],
            emoji: '🔎'
          }
        );
        
        // Return to alerts menu and exit wizard
        await showAlertsMenu(ctx);
        return ctx.scene.leave();
      } catch (error) {
        logger.error(`Error creating discovery alert: ${error.message}`);
        await showErrorToast(ctx, `Failed to create alert: ${error.message}`);
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
        return;
      }
    }
  );
  
  // --- Coin Search Handlers (Step 0) ---
  discoveryAlertWizard.on('text', async (ctx) => {
    if (ctx.wizard.cursor !== 0 || ctx.wizard.state.parameters.selectedCoin) {
      return;
    }
    
    logger.log('Processing text input for coin search');
    
    try {
      const query = ctx.message.text;
      logger.log(`Search query: "${query}"`);
      
      await withLoading(
        ctx,
        async () => {
          const searchConfig: CoinSearchConfig = {
            promptText: '',
            fieldName: 'selectedCoin',
            confidenceThreshold: 2.5,
            searchCallbackPrefix: 'coinsearch'
          };
          
          const state = await coinSearchComponent.processSearch(ctx, query, searchConfig);
          ctx.wizard.state.parameters.coinSearchState = state;
          
          if (state.selectedCoin) {
            logger.log(`High confidence match found: ${state.selectedCoin.name}`);
            ctx.wizard.state.parameters.selectedCoin = state.selectedCoin;
            await showAlertTypeOptions(ctx);
          } else {
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
  
  discoveryAlertWizard.action(/^coinsearch_select_\w+$/, async (ctx) => {
    logger.log('Coin selection action triggered');
    
    try {
      const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
        ? (ctx.callbackQuery as any).data
        : '';
      
      const coinId = callbackData.split('_').pop();
      logger.log(`Selected coin ID: ${coinId}`);
      
      const state = ctx.wizard.state.parameters.coinSearchState;
      
      if (!state || !state.results) {
        logger.error('Search state is missing');
        await ctx.answerCbQuery('Error: Search data not found');
        return;
      }
      
      const selectedCoin = state.results.find(r => r.coin.id === coinId)?.coin;
      
      if (selectedCoin) {
        logger.log(`Found selected coin: ${selectedCoin.name}`);
        ctx.wizard.state.parameters.selectedCoin = selectedCoin;
        await ctx.answerCbQuery(`Selected ${selectedCoin.name} (${selectedCoin.symbol})`);
        await showAlertTypeOptions(ctx);
      } else {
        logger.error(`Coin not found with ID: ${coinId}`);
        await ctx.answerCbQuery('Error: Coin not found');
        await promptForCoinSearch(ctx, coinSearchComponent);
      }
    } catch (error) {
      logger.error(`Error handling coin selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting coin');
    }
  });
  
  // --- Alert Type Selection (Step 1) ---
  discoveryAlertWizard.action(/^alert_type_(market_transition|level_break)$/, async (ctx) => {
    try {
      const match = /^alert_type_(market_transition|level_break)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const alertType = match[1] === 'market_transition' ? 
          AlertType.MARKET_TRANSITION : 
          AlertType.LEVEL_BREAK;
        
        logger.log(`Selected alert type: ${alertType}`);
        ctx.wizard.state.parameters.alertType = alertType;
        
        // Proceed to indicator selection (Step 2)
        await showIndicatorOptions(ctx);
        ctx.wizard.selectStep(2);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling alert type selection: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // --- Indicator Selection (Step 2) ---
  discoveryAlertWizard.action(/^indicator_picker_.+$/, async (ctx) => {
    try {
      const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
        ? (ctx.callbackQuery as any).data 
        : '';
      
      const currentState: MultiPickerState = ctx.wizard.state.parameters.indicatorState || { 
        selectedOptions: [],
        type: OptionsType.INDICATORS
      };
      
      const options = ctx.wizard.state.parameters.indicatorOptions || [];
      
      const result = await multiPickerHandler.handleCallback(
        ctx,
        callbackData,
        currentState,
        options,
        3
      );
      
      ctx.wizard.state.parameters.indicatorState = result.state;
      
      if (result.proceed) {
        ctx.wizard.state.parameters.selectedIndicators = result.state.selectedOptions;
        // If alert type is MARKET_TRANSITION, proceed to transition type selection (Step 3)
        if (ctx.wizard.state.parameters.alertType === AlertType.MARKET_TRANSITION) {
          await showTransitionTypeOptions(ctx);
          ctx.wizard.selectStep(3);
        } else {
          // Otherwise, move directly to pair & timeframe selection (Step 4)
          await showPairTimePickerOptions(ctx);
          ctx.wizard.selectStep(4);
        }
      } else if (result.redraw !== false) {
        await showIndicatorOptions(ctx, false);
      }
    } catch (error) {
      logger.error(`Error handling indicator selection: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // --- Transition Type Selection (Step 3, for MARKET_TRANSITION only) ---
  discoveryAlertWizard.action(/^multipicker_.+$/, async (ctx) => {
    try {
      const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
        ? (ctx.callbackQuery as any).data 
        : '';
      
      if (callbackData.startsWith('multipicker_')) {
        const currentState: MultiPickerState = ctx.wizard.state.parameters.transitionState || { 
          selectedOptions: [],
          type: OptionsType.MARKET_TRANSITIONS
        };
        
        const options = ctx.wizard.state.parameters.transitionOptions || [];
        
        const result = await multiPickerHandler.handleCallback(
          ctx,
          callbackData,
          currentState,
          options,
          3
        );
        
        ctx.wizard.state.parameters.transitionState = result.state;
        
        if (result.proceed) {
          ctx.wizard.state.parameters.transitionTypes = result.state.selectedOptions;
          await showPairTimePickerOptions(ctx);
          ctx.wizard.selectStep(4);
        } else if (result.redraw !== false) {
          await showTransitionTypeOptions(ctx, false);
        }
      }
    } catch (error) {
      logger.error(`Error handling transition type selection: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // --- Pair & Timeframe Selection (Step 4) ---
  discoveryAlertWizard.action(/^cmbpicker_.+$/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && 'data' in ctx.callbackQuery 
        ? (ctx.callbackQuery as any).data 
        : '';
      
      const currentState = ctx.wizard.state.parameters.pickerState || {
        selectedPairing: 'USD',
        selectedTimeframe: '1D'
      };
      
      const result = await pairTimePickerHandler.handleCallback(ctx, data, currentState);
      
      ctx.wizard.state.parameters.pickerState = result.state;
      
      if (result.proceed) {
        await showAlertConfirmation(ctx);
        ctx.wizard.selectStep(5);
      } else {
        await showPairTimePickerOptions(ctx);
      }
    } catch (error) {
      logger.error(`Error handling pair-time picker callback: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // --- Confirmation (Step 5) ---
  registerConfirmationHandler(
    discoveryAlertWizard,
    'create_discovery_alert_confirm',
    async (ctx) => {
      ctx.wizard.selectStep(5);
      
      const currentIndex = ctx.wizard.cursor;
      if (currentIndex < discoveryAlertWizard.middleware().length) {
        return discoveryAlertWizard.middleware()[currentIndex](ctx, async () => {});
      }
      
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
      return;
    }
  );
  
  // --- Go Back Button Handler ---
  discoveryAlertWizard.action('go_back', async (ctx) => {
    logger.log('Go back action triggered');
    
    const currentStep = ctx.wizard.cursor;
    const parameters = ctx.wizard.state.parameters;
  
    switch (currentStep) {
      case 0:
        logger.log('Exiting wizard from coin search step');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
        break;
      case 1:
        logger.log('Going back to coin search from alert type selection');
        delete parameters.selectedCoin;
        delete parameters.coinSearchState;
        await promptForCoinSearch(ctx, coinSearchComponent);
        ctx.wizard.selectStep(0);
        break;
      case 2:
        logger.log('Going back to alert type selection from indicator selection');
        delete parameters.indicatorState;
        await showAlertTypeOptions(ctx);
        ctx.wizard.selectStep(1);
        break;
      case 3:
        logger.log('Going back to indicator selection from transition type selection');
        delete parameters.transitionState;
        await showIndicatorOptions(ctx, false);
        ctx.wizard.selectStep(2);
        break;
      case 4:
        logger.log('Going back from pair/time picker');
        delete parameters.pickerState;
        if (parameters.alertType === AlertType.MARKET_TRANSITION) {
          await showTransitionTypeOptions(ctx, false);
          ctx.wizard.selectStep(3);
        } else {
          await showIndicatorOptions(ctx, false);
          ctx.wizard.selectStep(2);
        }
        break;
      case 5:
        logger.log('Going back to pair/time picker from confirmation');
        await showPairTimePickerOptions(ctx);
        ctx.wizard.selectStep(4);
        break;
      default:
        logger.log('No valid step to go back, exiting wizard');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
    }
    
    await ctx.answerCbQuery();
  });
  
  return discoveryAlertWizard;
};

/**
 * Helper: Prompt for coin search.
 */
async function promptForCoinSearch(ctx: CustomContext, coinSearchComponent: CoinSearchComponent): Promise<void> {
  const searchConfig: CoinSearchConfig = {
    promptText: '🔍 *Search for a cryptocurrency:*\n\nPlease enter the name or symbol of the coin you want to set a discovery alert for.',
    fieldName: 'selectedCoin',
    confidenceThreshold: 2.5,
    searchCallbackPrefix: 'coinsearch'
  };
  
  await coinSearchComponent.prompt(ctx, searchConfig);
}

/**
 * Helper: Show alert type options.
 */
async function showAlertTypeOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing alert type options');
  
  const selectedCoin = ctx.wizard.state.parameters.selectedCoin;
  
  if (!selectedCoin) {
    logger.error('No coin selected');
    await ctx.reply('Error: No coin selected. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
    return;
  }
  
  const messageText = `
🔎 *Create Discovery Alert for ${selectedCoin.name} (${selectedCoin.symbol})*

Select the type of discovery alert you want to create:
`;

  const buttons = [
    [
      Markup.button.callback('🔄 Market Transition', 'alert_type_market_transition')
    ],
    [
      Markup.button.callback('📊 Level Break', 'alert_type_level_break')
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
 * Helper: Show transition type options using the multi-picker.
 * Filters options to only "Bullish to Bearish" or "Bearish to Bullish".
 */
async function showTransitionTypeOptions(ctx: CustomContext, shouldLoad: boolean = true): Promise<void> {
  logger.log('Showing transition type options');
  
  const parameters = ctx.wizard.state.parameters;
  
  if (!parameters.selectedCoin || !parameters.alertType) {
    logger.error('Missing coin or alert type');
    await ctx.reply('Error: Missing required information. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
    return;
  }
  
  try {
    const messageText = `
*Select Market Transition Types for ${parameters.selectedCoin.name}*

Choose up to 3 market transitions you want to monitor:
`;
    
    const currentState: MultiPickerState = parameters.transitionState || { 
      selectedOptions: [],
      type: OptionsType.MARKET_TRANSITIONS
    };
    
    let options = parameters.transitionOptions || [];
    
    if (shouldLoad && options.length === 0) {
      options = await withLoading(
        ctx,
        async () => {
          const allOptions = await optionsService.getOptions(OptionsType.MARKET_TRANSITIONS);
          return allOptions.filter(
            (option) =>
              (option as any).name === 'Bullish to Bearish' ||
            (option as any).name === 'Bearish to Bullish'
          );
        },
        {
          messages: ['Loading available transition types...'],
          emoji: '🔄'
        }
      );
      
      parameters.transitionOptions = options;
    }
    
    const keyboard = multiPicker.render('multipicker', currentState, options, 3);
    
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      }
    } else {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    logger.error(`Error showing transition options: ${error.message}`);
    await ctx.reply('Error loading transition options. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
  }
}

/**
 * Helper: Show indicator options using the multi-picker.
 */
async function showIndicatorOptions(ctx: CustomContext, shouldLoad: boolean = true): Promise<void> {
  logger.log('Showing indicator options');
  
  const parameters = ctx.wizard.state.parameters;
  
  if (!parameters.selectedCoin) {
    logger.error('Missing coin information');
    await ctx.reply('Error: Missing required information. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
    return;
  }
  
  try {
    const messageText = `
*Select Indicators for ${parameters.selectedCoin.name}*

Choose up to 3 indicators you want to monitor:
`;
    
    const currentState: MultiPickerState = parameters.indicatorState || { 
      selectedOptions: [],
      type: OptionsType.INDICATORS
    };
    
    let options = parameters.indicatorOptions || [];
    
    if (shouldLoad && options.length === 0) {
      options = await withLoading(
        ctx,
        async () => {
          return await optionsService.getOptions(OptionsType.INDICATORS);
        },
        {
          messages: ['Loading available indicators...'],
          emoji: '📊'
        }
      );
      
      parameters.indicatorOptions = options;
    }
    
    const keyboard = multiPicker.render('indicator_picker', currentState, options, 3);
    
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      }
    } else {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    logger.error(`Error showing indicator options: ${error.message}`);
    await ctx.reply('Error loading indicator options. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
  }
}

/**
 * Helper: Show pair and timeframe picker options.
 */
async function showPairTimePickerOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing pair and timeframe picker options');
  
  const parameters = ctx.wizard.state.parameters;
  
  if (!parameters.selectedCoin || !parameters.alertType) {
    logger.error('Missing coin or alert type');
    await ctx.reply('Error: Missing required information. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
    return;
  }
  
  const messageText = `
*Select Pairing and Timeframe for ${parameters.selectedCoin.name}*

Alert Type: ${getAlertTypeName(parameters.alertType)}
${parameters.transitionTypes ? `Transition Types: ${parameters.transitionTypes.join(', ')}\n` : ''}
Choose the currency pair and timeframe for your alert:
`;
  
  const pickerState = parameters.pickerState || {
    selectedPairing: 'USD',
    selectedTimeframe: '1D'
  };
  
  const keyboard = pairTimePicker.render('cmbpicker', pickerState);
  
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
  } else {
    await ctx.reply(messageText, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Helper: Show alert confirmation.
 */
async function showAlertConfirmation(ctx: CustomContext): Promise<void> {
  logger.log('Showing alert confirmation');
  
  const parameters = ctx.wizard.state.parameters;
  
  if (!parameters.selectedCoin || 
      !parameters.alertType || 
      !parameters.pickerState) {
    logger.error('Missing required parameters for confirmation');
    await ctx.reply('Error: Missing required information. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
    return;
  }
  
  let messageText = `
🔔 *Confirm Discovery Alert*

Coin: ${parameters.selectedCoin.name} (${parameters.selectedCoin.symbol})
Type: ${getAlertTypeName(parameters.alertType)}
`;
  
  if (parameters.alertType === AlertType.MARKET_TRANSITION && parameters.transitionTypes) {
    messageText += `Transition Types: ${parameters.transitionTypes.join(', ')}\n`;
  }
  
  messageText += `
Timeframe: ${parameters.pickerState.selectedTimeframe}
Pairing: ${parameters.pickerState.selectedPairing}

Are you sure you want to create this alert?
`;
  
  await confirmationComponent.prompt(ctx, {
    message: messageText,
    confirmButtonText: '✅ Create Alert',
    confirmCallbackData: 'create_discovery_alert_confirm',
    parse_mode: 'Markdown'
  });
}

/**
 * Helper: Convert alert type to a readable name.
 */
function getAlertTypeName(alertType: string): string {
  switch (alertType) {
    case AlertType.MARKET_TRANSITION:
      return 'Market Transition';
    case AlertType.LEVEL_BREAK:
      return 'Level Break';
    default:
      return alertType;
  }
}

/**
 * Helper: Map timeframe from picker to AlertService format.
 */
function mapTimeframeToAlertFormat(pickerTimeframe: string | null): TimeFrame {
  switch (pickerTimeframe) {
    case '6h':
      return TimeFrame.H6;
    case '12h':
      return TimeFrame.H12;
    case '1D':
      return TimeFrame.D1;
    case '1W':
      return TimeFrame.W1;
    case '1M':
      return TimeFrame.M1;
    default:
      return TimeFrame.D1;
  }
}

/**
 * Helper: Map pairing from picker to AlertService format.
 */
function mapPairingToAlertFormat(pickerPairing: string | null): Pairing {
  switch (pickerPairing) {
    case 'USD':
      return Pairing.USD;
    case 'BTC':
      return Pairing.BTC;
    case 'ETH':
      return Pairing.ETH;
    case 'ALL':
      return Pairing.ALL;
    default:
      return Pairing.USD;
  }
}