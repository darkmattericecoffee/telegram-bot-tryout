// src/telegram/wizards/alerts/create-alert.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext, WizardState } from 'src/telegram/interfaces/custom-context.interface';
import { pickerComponent } from 'src/telegram/components/picker.component/picker.component';
import { optionsComponent } from 'src/telegram/components/options.component/options.component';
import { responseComponent } from 'src/telegram/components/response.component/response.component';
import { ConfirmationComponent, registerConfirmationHandler } from 'src/telegram/components/confirmation.component';
import { CoinSearchComponent, CoinSearchConfig, CoinSearchState } from 'src/telegram/components/coin-search.component';
import { CoinSearchService } from 'src/telegram/services/coin-search.service';
import { MultiPickerComponent, MultiPickerCallbackHandler, MultiPickerState } from 'src/telegram/components/multi-picker.component';
import { PairTimePickerComponent, PairTimePickerComponentCallbackHandler, PickerState } from 'src/telegram/components/pair-time-picker.component';
import { OptionsService, OptionsType } from 'src/telegram/services/options.service';
import { AlertService, AlertType, AlertNotificationType } from 'src/telegram/services/alert.service';
import { showAlertsMenu } from 'src/telegram/menus/sub.menu/alerts.menu';
import { WatchlistService } from 'src/telegram/services/watchlist.service';
import { escapeMarkdown } from 'src/telegram/helpers/escape-markdown';
// Create logger for wizard
const logger = new Logger('CreateAlertWizard');

// Initialize components and services
const confirmationComponent = new ConfirmationComponent();
const coinSearchComponent = new CoinSearchComponent(new CoinSearchService());
const multiPicker = new MultiPickerComponent();
const multiPickerHandler = new MultiPickerCallbackHandler();
const combinedPicker = new PairTimePickerComponent();
const combinedPickerHandler = new PairTimePickerComponentCallbackHandler();
const optionsService = new OptionsService();

// Step 1: Alert Type Selection (Watchlist or Specific Coin)
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Entering step 1: Alert type selection');

  // Ensure services are available
  const alertService = (ctx as any).alertService as AlertService;
  const watchlistService = (ctx as any).watchlistService as WatchlistService;

  if (!alertService || !watchlistService) {
    logger.error('Services not properly injected into context');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }

  // Get alert limits
  const limits = alertService.getAlertsLimits();
  
  const pickerConfig = {
    text: '🔔 *Create New Alert*\n\nWould you like to set up an alert for a specific coin or an entire watchlist?',
    options: [
      { label: '💰 Specific Coin', action: 'alert_type_coin' },
      { label: '📋 Watchlist', action: 'alert_type_watchlist' },
    ],
  };

  await pickerComponent(ctx, pickerConfig);
}

// Step 2: Skipping directly to Coin Search or Watchlist Selection step
// We'll remove the Alert Name step and generate a default name later

// Step 3a: Coin Search Component - If user chose specific coin
async function step3Coin(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log('Entering step 3: Coin search prompt');
  
  const searchConfig: CoinSearchConfig = {
    promptText: '🔍 *Search for a cryptocurrency:*\n\nPlease enter the name or symbol of the coin you want to track.',
    fieldName: 'selectedCoin',
    confidenceThreshold: 2.5,
    searchCallbackPrefix: 'alertcoinsearch'
  };
  
  await coinSearchComponent.prompt(ctx, searchConfig);
}

// Step 3b: Show coin search results
async function step3CoinResults(ctx: CustomContext) {
  logger.log('Entering step 3b: Showing coin search results');
  
  // Get the current search state
  const searchState = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!searchState) {
    logger.error('Search state is missing, returning to search prompt');
    return step3Coin(ctx);
  }
  
  // Show the search results
  await coinSearchComponent.showResults(ctx, searchState, 'alertcoinsearch');
}

// Step 3c: Watchlist Selection - If user chose watchlist
async function step3Watchlist(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log('Entering step 3: Watchlist selection');
  
  // Extract watchlist service from context
  const watchlistService = (ctx as any).watchlistService as WatchlistService;
  
  if (!watchlistService) {
    logger.error('Watchlist service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  try {
    // Get user's watchlists using the correct method signature
    const telegramId = ctx.from?.id.toString() || 'unknown';
    const isGroup = false; // Since this is for a user's watchlists
    const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
    
    if (!watchlists || watchlists.length === 0) {
      // No watchlists found, prompt to create one first
      await ctx.reply('You don\'t have any watchlists yet. Please create a watchlist first.');
      await ctx.scene.leave();
      return showAlertsMenu(ctx);
    }
    
    // Convert watchlists to options
    const options = watchlists.map(watchlist => ({
      label: `${watchlist.name} (${watchlist.coins.length} coins)`,
      action: `select_watchlist_${watchlist.id}`
    }));
    
    const pickerConfig = {
      text: '📋 *Select a Watchlist*\n\nChoose a watchlist to set up alerts for:',
      options
    };
    
    await pickerComponent(ctx, pickerConfig);
  } catch (error) {
    logger.error(`Error fetching watchlists: ${error.message}`);
    await ctx.reply('An error occurred while fetching your watchlists. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
}

// Step 4: Notification Type Selection
async function step4(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 4;
  logger.log('Entering step 4: Notification type selection');
  
  // Notification type selection with shorter button text to avoid truncation
  const pickerConfig = {
    text: '📈 *Alert Type Selection*\n\nHow would you like to be notified?',
    options: [
      { label: '🌟 Horizon Score', action: 'notification_type_horizon' },
      { label: '📊 Indicators', action: 'notification_type_indicators' },
    ],
  };

  await pickerComponent(ctx, pickerConfig);
}

// Step 5: Indicator Selection (Only if Individual Indicators selected)
async function step5Indicators(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 5;
  logger.log('Entering step 5: Indicators multi-picker');
  
  // Initialize multi-picker state if not exists
  if (!ctx.wizard.state.parameters.multiPickerState) {
    ctx.wizard.state.parameters.multiPickerState = {
      selectedOptions: [],
      type: OptionsType.INDICATORS
    };
  }
  
  try {
    // Fetch available indicators from the service
    const options = await optionsService.getOptions(OptionsType.INDICATORS);
    
    // Store options in wizard state for later use in callbacks
    ctx.wizard.state.parameters.availableOptions = options;
    ctx.wizard.state.parameters.optionsLimit = 3; // Set maximum selection limit
    
    // Show the multi-picker with current selection
    const messageText = '📊 *Select Indicators*\n\nChoose up to 3 indicators for your alert:';
    const keyboard = multiPicker.render(
      'alertmultipicker', 
      ctx.wizard.state.parameters.multiPickerState,
      options,
      ctx.wizard.state.parameters.optionsLimit
    );
    
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
    logger.error(`Error fetching options: ${error.message}`);
    await ctx.reply('An error occurred. Please try again.');
    // Skip to pairing selection as fallback
    return step6(ctx);
  }
}

// Step 6: Pair and Timeframe Selection
async function step6(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 6;
  logger.log('Entering step 6: Pair/timeframe picker');
  
  // Set or initialize the picker state
  if (!ctx.wizard.state.parameters.pickerState) {
    ctx.wizard.state.parameters.pickerState = {
      selectedPairing: 'USD',
      selectedTimeframe: '1D'
    };
  }
  
  // Show the combined picker with current selection
  const messageText = '⏱️ *Select Currency Pair and Timeframe*\n\nChoose the trading pair and time interval for your alert:';
  const keyboard = combinedPicker.render('alertpicker', ctx.wizard.state.parameters.pickerState);
  
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

// Step 7: Confirmation
async function step7(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 7;
  logger.log('Entering step 7: Confirmation');
  
  // Extract details for the confirmation message
  const { 
    alertType, 
    pickerState,
    multiPickerState,
    notificationType
  } = ctx.wizard.state.parameters;
  
  // Generate default alert name based on selected coin/watchlist and alert type
  let alertName = '';
  if (alertType === AlertType.WATCHLIST) {
    const watchlist = ctx.wizard.state.parameters.selectedWatchlist;
    alertName = `${watchlist.name} Alert`;
  } else {
    const coin = ctx.wizard.state.parameters.selectedCoin;
    alertName = `${coin.name} (${coin.symbol}) Alert`;
  }
  
  // Store the auto-generated name
  ctx.wizard.state.parameters.alertName = alertName;
  
  const pair = pickerState?.selectedPairing || 'USD';
  const timeframe = pickerState?.selectedTimeframe || '1D';
  
  // Alert target information
  let targetInfo = '';
  if (alertType === AlertType.WATCHLIST) {
    const watchlist = ctx.wizard.state.parameters.selectedWatchlist;
    targetInfo = `Watchlist: ${watchlist.name}`;
  } else {
    const coin = ctx.wizard.state.parameters.selectedCoin;
    targetInfo = `Coin: ${coin.name} (${coin.symbol})`;
  }
  
  // Notification type and indicators - with consistent short labels
  let notificationInfo = '';
  if (notificationType === AlertNotificationType.HORIZON_SCORE) {
    notificationInfo = 'Notification: Horizon Score';
  } else {
    const indicators = multiPickerState?.selectedOptions || [];
    notificationInfo = `Notification: Indicators\nIndicators: ${indicators.length > 0 ? indicators.join(', ') : 'None'}`;
  }
  
  // Build a summary message for confirmation
  const confirmationMessage = `
*Please confirm your alert settings:*

• Alert Name: ${escapeMarkdown(alertName)}
• ${escapeMarkdown(targetInfo)}
• ${escapeMarkdown(notificationInfo)}
• Pair: ${escapeMarkdown(pair)}
• Timeframe: ${escapeMarkdown(timeframe)}

Are you sure you want to create this alert?
`;
  
  await confirmationComponent.prompt(ctx, {
    message: confirmationMessage,
    confirmButtonText: '✅ Create Alert',
    cancelButtonText: '← Go Back',
    confirmCallbackData: 'create_alert_confirm',
    parse_mode: 'Markdown'
  });
}

// Final Step: Create Alert and Show Response
async function finalStep(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 8;
  logger.log('Entering final step: Creating alert');
  
  // Extract alert service from context
  const alertService = (ctx as any).alertService as AlertService;
  
  if (!alertService) {
    logger.error('Alert service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  // Extract all parameters needed for alert creation
  const { 
    alertType, 
    alertName,
    notificationType,
    pickerState,
    multiPickerState
  } = ctx.wizard.state.parameters;
  
  // Get user ID
  const userId = ctx.from?.id.toString() || 'unknown';
  
  // Set target ID and name based on alert type
  let targetId = '';
  let targetName = '';
  
  if (alertType === AlertType.WATCHLIST) {
    const watchlist = ctx.wizard.state.parameters.selectedWatchlist;
    targetId = watchlist.id;
    targetName = watchlist.name;
  } else {
    const coin = ctx.wizard.state.parameters.selectedCoin;
    targetId = coin.id;
    targetName = `${coin.name} (${coin.symbol})`;
  }
  
  try {
    console.log("About to create alert");
    const newAlert = await alertService.createAlert({
      userId,
      name: alertName,
      type: alertType,
      targetId,
      targetName,
      notificationType,
      indicators: notificationType === AlertNotificationType.INDIVIDUAL_INDICATORS 
        ? multiPickerState?.selectedOptions || [] 
        : undefined,
      pairing: pickerState?.selectedPairing || 'USD',
      timeframe: pickerState?.selectedTimeframe || '1D',
      active: true
    });
    
    console.log("Alert created successfully:", newAlert);
    // Show success message
    const responseText = `
    ✅ *Alert Successfully Created!*
    
    Your alert "${escapeMarkdown(newAlert.name)}" has been set up and is now active. You will receive notifications based on your selected criteria.
    
    *Alert Details:*
    - ID: ${newAlert.id}
    - Target: ${escapeMarkdown(newAlert.targetName)}
    - Timeframe: ${newAlert.timeframe}
    - Created: ${newAlert.createdAt.toLocaleString()}
    `;

// Send without markdown parsing to avoid issues
await ctx.reply(responseText);
    
    // Return to alerts menu
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
    
  } catch (error) {
    logger.error(`Error creating alert: ${error.message}`);
    await ctx.reply('An error occurred while creating your alert. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
}

// Create the wizard scene
export const createAlertWizard = new Scenes.WizardScene<CustomContext>(
  'create-alert-wizard',
  step1
);

// Handle all multi-picker callbacks for indicators
createAlertWizard.action(/^alertmultipicker_.+$/, async (ctx) => {
  // Extract the data from the callback query
  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data 
    : undefined;
  if (!data) return;
  
  // Set up the current state for the handler
  const currentState: MultiPickerState = ctx.wizard.state.parameters.multiPickerState || {
    selectedOptions: [],
    type: OptionsType.INDICATORS
  };
  
  // Get available options and limit from wizard state
  const options = ctx.wizard.state.parameters.availableOptions || [];
  const limit = ctx.wizard.state.parameters.optionsLimit || 3;
  
  // Process the callback with the handler
  const result = await multiPickerHandler.handleCallback(
    ctx, 
    data.replace('alertmultipicker', 'multipicker'), // Convert to standard format for handler
    currentState,
    options,
    limit
  );
  
  // Update the state in the wizard
  ctx.wizard.state.parameters.multiPickerState = result.state;
  
  // If the user clicked "Choose", proceed to the next step
  if (result.proceed) {
    return step6(ctx);
  }
  
  // Only redraw if necessary (e.g., don't redraw when limit is reached)
  if (result.redraw !== false) {
    return step5Indicators(ctx);
  }
});

// Handle all pair-time picker callbacks
createAlertWizard.action(/^alertpicker_.+$/, async (ctx) => {
  // Extract the data from the callback query
  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data 
    : undefined;
  if (!data) return;
  
  // Set up the current state for the handler
  const currentState: PickerState = ctx.wizard.state.parameters.pickerState || {
    selectedPairing: 'USD',
    selectedTimeframe: '1D'
  };
  
  // Process the callback with the handler
  const result = await combinedPickerHandler.handleCallback(
    ctx, 
    data.replace('alertpicker', 'cmbpicker'), // Convert to standard format for handler
    currentState
  );
  
  // Update the state in the wizard
  ctx.wizard.state.parameters.pickerState = result.state;
  
  // If the user clicked "Choose", proceed to the next step
  if (result.proceed) {
    return step7(ctx);
  }
  
  // Otherwise, just redraw the same step with the updated selection
  return step6(ctx);
});

// Register confirmation handler
registerConfirmationHandler(createAlertWizard, 'create_alert_confirm', async (ctx) => {
  (ctx.wizard.state as WizardState).step = 8;
  logger.log('Entering final step: Creating alert');
  
  // Extract alert service from context
  const alertService = (ctx as any).alertService as AlertService;
  
  if (!alertService) {
    logger.error('Alert service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  // Extract all parameters needed for alert creation
  const { 
    alertType, 
    alertName,
    notificationType,
    pickerState,
    multiPickerState
  } = ctx.wizard.state.parameters;
  
  // Get user ID
  const userId = ctx.from?.id.toString() || 'unknown';
  
  // Set target ID and name based on alert type
  let targetId = '';
  let targetName = '';
  
  if (alertType === AlertType.WATCHLIST) {
    const watchlist = ctx.wizard.state.parameters.selectedWatchlist;
    targetId = watchlist.id;
    targetName = watchlist.name;
  } else {
    const coin = ctx.wizard.state.parameters.selectedCoin;
    targetId = coin.id;
    targetName = `${coin.name} (${coin.symbol})`;
  }
  
  try {
    logger.log(`Creating alert with service: ${!!alertService}`);
    const newAlert = await alertService.createAlert({
      userId,
      name: alertName,
      type: alertType,
      targetId,
      targetName,
      notificationType,
      indicators: notificationType === AlertNotificationType.INDIVIDUAL_INDICATORS 
        ? multiPickerState?.selectedOptions || [] 
        : undefined,
      pairing: pickerState?.selectedPairing || 'USD',
      timeframe: pickerState?.selectedTimeframe || '1D',
      active: true
    });
    
    // Show success message
    const responseText = `
✅ Alert Successfully Created!

Your alert "${escapeMarkdown(newAlert.name)}" has been set up and is now active. You will receive notifications based on your selected criteria.

Alert Details:
- ID: ${newAlert.id}
- Target: ${escapeMarkdown(newAlert.targetName)}
- Timeframe: ${newAlert.timeframe}
- Created: ${newAlert.createdAt.toLocaleString()}
    `;
    await ctx.reply(responseText); // Send as plain text

    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  } catch (error) {
    logger.error(`Error creating alert: ${error.message}`);
    await ctx.reply('An error occurred while creating your alert. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
});

// Add this to the createAlertWizard wizard to ensure services are available in all steps
createAlertWizard.use((ctx, next) => {
  // Check if services are available in the context
  const alertService = (ctx as any).alertService;
  const watchlistService = (ctx as any).watchlistService;
  
  if (!alertService) {
    logger.warn('Alert service missing in wizard middleware');
    
    // Try to restore from session
    if ((ctx.session as any).alertService) {
      logger.log('Restoring alertService from session in wizard middleware');
      (ctx as any).alertService = (ctx.session as any).alertService;
    }
  }
  
  if (!watchlistService) {
    logger.warn('Watchlist service missing in wizard middleware');
    
    // Try to restore from session
    if ((ctx.session as any).watchlistService) {
      logger.log('Restoring watchlistService from session in wizard middleware');
      (ctx as any).watchlistService = (ctx.session as any).watchlistService;
    }
  }
  
  return next();
});

// Handle go back action for navigation
createAlertWizard.action('go_back', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  if (wizardState.step && wizardState.step > 1) {
    // Determine which step to go back to
    let previousStep = wizardState.step - 1;
    wizardState.step = previousStep;
    
    logger.log(`Going back to step ${previousStep}`);
    
    switch (previousStep) {
      case 1:
        return step1(ctx);
      case 3:
        // Check if we're in the watchlist flow or coin flow
        if (wizardState.parameters.alertType === AlertType.WATCHLIST) {
          return step3Watchlist(ctx);
        } else {
          return step3Coin(ctx);
        }
      case 4:
        return step4(ctx);
      case 5:
        // If we're coming from step 6 and notification type is indicators
        if (wizardState.parameters.notificationType === AlertNotificationType.INDIVIDUAL_INDICATORS) {
          return step5Indicators(ctx);
        } else {
          // Otherwise go back to notification type selection
          return step4(ctx);
        }
      case 6:
        return step6(ctx);
      default:
        return step1(ctx);
    }
  } else {
    // If at first step, leave the scene and go back to menu
    await ctx.answerCbQuery('Returning to menu');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
});

// Alert type selection handlers
createAlertWizard.action('alert_type_coin', async (ctx) => {
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    alertType: AlertType.DISCOVERY
  };
  await ctx.answerCbQuery('Selected: Specific Coin');
  return step3Coin(ctx); // Skip name input, go directly to coin search
});

createAlertWizard.action('alert_type_watchlist', async (ctx) => {
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    alertType: AlertType.WATCHLIST
  };
  await ctx.answerCbQuery('Selected: Watchlist');
  return step3Watchlist(ctx); // Skip name input, go directly to watchlist selection
});

// Text input handler for coin search
createAlertWizard.on('text', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  const step = wizardState.step;
  
  // Handle coin search input (step 3)
  if (step === 3 && wizardState.parameters.alertType !== AlertType.WATCHLIST) {
    logger.log('Processing text input for coin search');
    
    try {
      // Get the search query
      const query = ctx.message.text;
      logger.log(`Search query: "${query}"`);
      
      // Process the search
      const searchConfig = {
        promptText: '',  // Not used here
        fieldName: 'selectedCoin',
        confidenceThreshold: 2.5
      };
      
      const state = await coinSearchComponent.processSearch(ctx, query, searchConfig);
      
      // Store the search state
      wizardState.parameters = {
        ...wizardState.parameters,
        coinSearchState: state
      };
      
      // If we have a high confidence match, store it and proceed
      if (state.selectedCoin) {
        logger.log(`High confidence match found: ${state.selectedCoin.name}`);
        wizardState.parameters.selectedCoin = state.selectedCoin;
        return step4(ctx);
      }
      
      // Otherwise, show results for user to choose
      logger.log('No high confidence match, showing results');
      return step3CoinResults(ctx);
    } catch (error) {
      logger.error(`Error processing search: ${error.message}`);
      await ctx.reply('An error occurred while searching. Please try again.');
      return step3Coin(ctx);
    }
  }
});

// Watchlist selection handlers
createAlertWizard.action(/^select_watchlist_(.+)$/, async (ctx) => {
  // Extract the watchlist ID from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery
    ? (ctx.callbackQuery as any).data
    : '';
  const watchlistId = callbackData.split('_').pop();
  logger.log(`Selected watchlist ID: ${watchlistId}`);
  
  // Get watchlist service
  const watchlistService = (ctx as any).watchlistService as WatchlistService;
  
  if (!watchlistService) {
    logger.error('Watchlist service not properly injected');
    await ctx.answerCbQuery('Service error. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  try {
    // Get the selected watchlist using the correct method
    const watchlist = await watchlistService.getWatchlistById(watchlistId);
    
    if (!watchlist) {
      logger.error(`Watchlist not found with ID: ${watchlistId}`);
      await ctx.answerCbQuery('Error: Watchlist not found');
      return step3Watchlist(ctx);
    }
    
    // Store the selected watchlist
    ctx.wizard.state.parameters.selectedWatchlist = watchlist;
    await ctx.answerCbQuery(`Selected watchlist: ${watchlist.name}`);
    
    // Proceed to notification type selection
    return step4(ctx);
  } catch (error) {
    logger.error(`Error getting watchlist: ${error.message}`);
    await ctx.answerCbQuery('Error retrieving watchlist');
    return step3Watchlist(ctx);
  }
});

// Coin search result selection
createAlertWizard.action(/^alertcoinsearch_select_\w+$/, async (ctx) => {
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
    
    // Proceed to notification type selection
    return step4(ctx);
  }
  
  logger.error(`Coin not found with ID: ${coinId}`);
  await ctx.answerCbQuery('Error: Coin not found');
  return step3CoinResults(ctx);
});

// Coin search pagination handlers
createAlertWizard.action(/^alertcoinsearch_next_\d+$/, async (ctx) => {
  logger.log('Next page action triggered');
  
  // Get current state
  const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!state) {
    logger.error('Search state is missing');
    return step3Coin(ctx);
  }
  
  // Update page number
  state.page += 1;
  
  // Update the state
  ctx.wizard.state.parameters.coinSearchState = state;
  
  // Show updated results
  await coinSearchComponent.showResults(ctx, state, 'alertcoinsearch');
  
  await ctx.answerCbQuery();
});

createAlertWizard.action(/^alertcoinsearch_prev_\d+$/, async (ctx) => {
  logger.log('Previous page action triggered');
  
  // Get current state
  const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!state) {
    logger.error('Search state is missing');
    return step3Coin(ctx);
  }
  
  // Update page number (ensure it doesn't go below 1)
  state.page = Math.max(1, state.page - 1);
  
  // Update the state
  ctx.wizard.state.parameters.coinSearchState = state;
  
  // Show updated results
  await coinSearchComponent.showResults(ctx, state, 'alertcoinsearch');
  
  await ctx.answerCbQuery();
});

// Notification type selection handlers
createAlertWizard.action('notification_type_horizon', async (ctx) => {
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    notificationType: AlertNotificationType.HORIZON_SCORE
  };
  await ctx.answerCbQuery('Selected: Horizon Score');
  
  // Skip indicator selection and go directly to pair selection
  return step6(ctx);
});

createAlertWizard.action('notification_type_indicators', async (ctx) => {
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    notificationType: AlertNotificationType.INDIVIDUAL_INDICATORS
  };
  await ctx.answerCbQuery('Selected: Indicators');
  
  // Go to indicator selection step
  return step5Indicators(ctx);
});