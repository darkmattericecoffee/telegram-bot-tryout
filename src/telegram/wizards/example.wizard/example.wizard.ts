import { Scenes } from 'telegraf';
import { CustomContext, WizardState } from 'src/telegram/interfaces/custom-context.interface';
import { pickerComponent } from 'src/telegram/components/picker.component/picker.component';
import { optionsComponent } from 'src/telegram/components/options.component/options.component';
import { responseComponent } from 'src/telegram/components/response.component/response.component';
import { showSubMenu } from 'src/telegram/menus/submenus/sub.menu';
import { PairTimePickerComponent, PairTimePickerComponentCallbackHandler, PickerState } from 'src/telegram/components/pair-time-picker.component';
import { MultiPickerComponent, MultiPickerCallbackHandler, MultiPickerState } from 'src/telegram/components/multi-picker.component';
import { OptionsService, OptionsType } from 'src/telegram/services/options.service';
import { Logger } from '@nestjs/common';
import { TextInputComponent, TextInputConfig, registerTextInputHandlers } from 'src/telegram/components/text-input.component';
import { ConfirmationComponent, registerConfirmationHandler } from 'src/telegram/components/confirmation.component';
import { CoinSearchComponent, CoinSearchConfig, CoinSearchState } from '../../components/coin-search.component'
import { CoinSearchService } from 'src/telegram/services/coin-search.service';

// Create logger for wizard
const logger = new Logger('ExampleWizard');

// Initialize components and services
const combinedPicker = new PairTimePickerComponent();
const combinedPickerHandler = new PairTimePickerComponentCallbackHandler();
const multiPicker = new MultiPickerComponent();
const multiPickerHandler = new MultiPickerCallbackHandler();
const optionsService = new OptionsService();
const textInputComponent = new TextInputComponent();
const confirmationComponent = new ConfirmationComponent();
const coinSearchService = new CoinSearchService();
const coinSearchComponent = new CoinSearchComponent(coinSearchService);

// Step 1: Picker Component
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Entering step 1: Initial options');

  const pickerConfig = {
    text: 'Please pick an option:',
    options: [
      { label: 'Option 1', action: 'picker_option_1' },
      { label: 'Option 2', action: 'picker_option_2' },
    ],
  };

  await pickerComponent(ctx, pickerConfig);
}

// Step 2: Text Input Component - Ask for alert name
async function step2(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Entering step 2: Alert name input');
  
  const textInputConfig: TextInputConfig = {
    question: '📝 *Please provide a name for this alert:*\n\nType your response below.',
    fieldName: 'alertName',
    showSkipButton: true,
    skipButtonText: 'Use default name'
  };
  
  await textInputComponent.prompt(ctx, textInputConfig);
}

// Step 3: Coin Search Component - Search screen
async function step3(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log('Entering step 3: Coin search prompt');
  
  const searchConfig: CoinSearchConfig = {
    promptText: '🔍 *Search for a cryptocurrency:*\n\nPlease enter the name or symbol of the coin you want to track.',
    fieldName: 'selectedCoin',
    confidenceThreshold: 2.5,
    searchCallbackPrefix: 'coinsearch'
  };
  
  await coinSearchComponent.prompt(ctx, searchConfig);
}

// Step 3b: Show search results when needed
async function step3b(ctx: CustomContext) {
  logger.log('Entering step 3b: Showing search results');
  
  // Get the current search state
  const searchState = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!searchState) {
    logger.error('Search state is missing, returning to search prompt');
    return step3(ctx);
  }
  
  // Show the search results
  await coinSearchComponent.showResults(ctx, searchState, 'coinsearch');
}

// Step 4: Combined Pair and Timeframe Picker Component
async function step4(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 4;
  logger.log('Entering step 4: Pair/timeframe picker');
  
  // Set or initialize the picker state
  if (!ctx.wizard.state.parameters.pickerState) {
    ctx.wizard.state.parameters.pickerState = {
      selectedPairing: 'USD',
      selectedTimeframe: '1D'
    };
  }
  
  // Show the combined picker with current selection
  const messageText = 'Please select currency pair and timeframe:';
  const keyboard = combinedPicker.render('cmbpicker', ctx.wizard.state.parameters.pickerState);
  
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
      });
    }
  } else {
    await ctx.reply(messageText, {
      reply_markup: keyboard.reply_markup,
    });
  }
}

// Step 5: Multi-Picker Component for Indicators
async function step5(ctx: CustomContext) {
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
    const messageText = 'Select up to 3 indicators for your alert:';
    const keyboard = multiPicker.render(
      'multipicker', 
      ctx.wizard.state.parameters.multiPickerState,
      options,
      ctx.wizard.state.parameters.optionsLimit
    );
    
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(messageText, {
          reply_markup: keyboard.reply_markup,
        });
      } catch (error) {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
        });
      }
    } else {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
      });
    }
  } catch (error) {
    logger.error(`Error fetching options: ${error.message}`);
    await ctx.reply('An error occurred. Please try again.');
    // Fall back to options selection if indicators can't be loaded
    return step6(ctx);
  }
}

// Step 6: Options Component
async function step6(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 6;
  logger.log('Entering step 6: Route selection');

  const optionsConfig = {
    text: 'Choose an action:',
    buttons: [
      { label: 'Route A', action: 'route_a' },
      { label: 'Route B', action: 'route_b' },
    ],
  };

  await optionsComponent(ctx, optionsConfig);
}

// Step 7: Confirmation Component
async function step7(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 7;
  logger.log('Entering step 7: Confirmation');
  
  // Extract details for the confirmation message
  const { 
    picker, 
    alertName = 'Default Alert Name', 
    pickerState,
    multiPickerState
  } = ctx.wizard.state.parameters;
  
  const pair = pickerState?.selectedPairing || 'USD';
  const timeframe = pickerState?.selectedTimeframe || '1D';
  const indicators = multiPickerState?.selectedOptions || [];
  const route = ctx.wizard.state.parameters.route || 'Not selected';
  
  // Get selected coin information
  const selectedCoin = ctx.wizard.state.parameters.selectedCoin;
  const coinInfo = selectedCoin 
    ? `${selectedCoin.name} (${selectedCoin.symbol})`
    : 'No coin selected';
  
  // Build a summary message for confirmation
  const confirmationMessage = `
*Please confirm your alert settings:*

• Option: ${picker}
• Alert Name: ${alertName}
• Coin: ${coinInfo}
• Pair: ${pair}
• Timeframe: ${timeframe}
• Indicators: ${indicators.length > 0 ? indicators.join(', ') : 'None'}
• Route: ${route}

Are you sure you want to create this alert?
  `;
  
  await confirmationComponent.prompt(ctx, {
    message: confirmationMessage,
    confirmButtonText: '✅ Create Alert',
    cancelButtonText: '← Go Back',
    confirmCallbackData: 'create_alert_confirm'
  });
}

// Step 8: Response Component (Final)
async function step8(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 8;
  logger.log('Entering step 8: Final response');

  // Extract only the values we need and create a clean parameter object
  const { 
    picker, 
    alertName, 
    route, 
    pickerState, 
    selectedCoin,
    multiPickerState
  } = ctx.wizard.state.parameters;
  
  const parameters = {
    picker,
    alertName: alertName || 'Default Alert Name',
    coin: selectedCoin ? {
      id: selectedCoin.id,
      name: selectedCoin.name,
      symbol: selectedCoin.symbol
    } : null,
    route,
    pair: pickerState?.selectedPairing,
    timeframe: pickerState?.selectedTimeframe,
    indicators: multiPickerState?.selectedOptions || []
  };
  
  const responseConfig = {
    text: '✅ Alert created successfully! Here are the final parameters:',
    parameters: parameters,
  };

  await responseComponent(ctx, responseConfig);
  await ctx.scene.leave();
}

// Create the wizard scene
export const exampleWizard = new Scenes.WizardScene<CustomContext>(
  'example-wizard',
  step1
);

// Handler for text input - handles both alert name and coin search input
exampleWizard.on('text', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  const step = wizardState.step;
  
  logger.log(`Received text input in step ${step}`);
  
  // Handle alert name input (step 2)
  if (step === 2) {
    logger.log('Processing alert name input');
    
    // Get the alert name from the message
    const alertName = ctx.message.text;
    
    // Store it in the wizard state
    wizardState.parameters = {
      ...wizardState.parameters,
      alertName
    };
    
    logger.log(`Alert name set to: "${alertName}"`);
    
    // Proceed to next step
    return step3(ctx);
  }
  
  // Handle coin search input (step 3)
  if (step === 3) {
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
      return step3b(ctx);
    } catch (error) {
      logger.error(`Error processing search: ${error.message}`);
      await ctx.reply('An error occurred while searching. Please try again.');
      return step3(ctx);
    }
  }
});

// Register the confirmation handler for step 7
registerConfirmationHandler(exampleWizard, 'create_alert_confirm', step8);

// Handler for skipping text input
exampleWizard.action('textinput_skip', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  
  // Only process if we're in step 2 (alert name input)
  if (wizardState.step !== 2) return;
  
  logger.log('Alert name input skipped');
  
  // Set default or empty value for alert name
  wizardState.parameters = {
    ...wizardState.parameters,
    alertName: ''
  };
  
  await ctx.answerCbQuery('Using default name');
  
  // Proceed to next step
  return step3(ctx);
});

// Picker callbacks in step 1
exampleWizard.action('picker_option_1', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, picker: 'Option 1' };
  await ctx.toast('Selected Option 1');
  return step2(ctx);
});

exampleWizard.action('picker_option_2', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, picker: 'Option 2' };
  await ctx.toast('Selected Option 2');
  return step2(ctx);
});

// Handle all combined picker callbacks
exampleWizard.action(/^cmbpicker_.+$/, async (ctx) => {
  // Extract the data from the callback query
  // Use type assertion to access the data property
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
  const result = await combinedPickerHandler.handleCallback(ctx, data, currentState);
  
  // Update the state in the wizard
  ctx.wizard.state.parameters.pickerState = result.state;
  
  // If the user clicked "Choose", proceed to the next step
  if (result.proceed) {
    return step5(ctx);
  }
  
  // Otherwise, just redraw the same step with the updated selection
  return step4(ctx);
});

// Handle all multi-picker callbacks
exampleWizard.action(/^multipicker_.+$/, async (ctx) => {
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
    data, 
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
    return step5(ctx);
  }
});

// Coin search result selection
exampleWizard.action(/^coinsearch_select_\w+$/, async (ctx) => {
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
    
    // Proceed to next step
    return step4(ctx);
  }
  
  logger.error(`Coin not found with ID: ${coinId}`);
  await ctx.answerCbQuery('Error: Coin not found');
  return step3b(ctx);
});

// Pagination for search results
exampleWizard.action(/^coinsearch_next_\d+$/, async (ctx) => {
  logger.log('Next page action triggered');
  
  // Get current state
  const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!state) {
    logger.error('Search state is missing');
    return step3(ctx);
  }
  
  // Update page number
  state.page += 1;
  
  // Update the state
  ctx.wizard.state.parameters.coinSearchState = state;
  
  // Show updated results
  await coinSearchComponent.showResults(ctx, state, 'coinsearch');
  
  await ctx.answerCbQuery();
});

exampleWizard.action(/^coinsearch_prev_\d+$/, async (ctx) => {
  logger.log('Previous page action triggered');
  
  // Get current state
  const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!state) {
    logger.error('Search state is missing');
    return step3(ctx);
  }
  
  // Update page number (ensure it doesn't go below 1)
  state.page = Math.max(1, state.page - 1);
  
  // Update the state
  ctx.wizard.state.parameters.coinSearchState = state;
  
  // Show updated results
  await coinSearchComponent.showResults(ctx, state, 'coinsearch');
  
  await ctx.answerCbQuery();
});

// Option callbacks in step 6
exampleWizard.action('route_a', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, route: 'Route A' };
  await ctx.toast('Route A chosen');
  return step7(ctx);
});

exampleWizard.action('route_b', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, route: 'Route B' };
  await ctx.toast('Route B chosen');
  return step7(ctx);
});

// "Go Back" action
exampleWizard.action('go_back', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  if (wizardState.step && wizardState.step > 1) {
    wizardState.step = wizardState.step - 1;
    if (wizardState.step === 1) {
      return step1(ctx);
    } else if (wizardState.step === 2) {
      return step2(ctx);
    } else if (wizardState.step === 3) {
      return step3(ctx);
    } else if (wizardState.step === 4) {
      return step4(ctx);
    } else if (wizardState.step === 5) {
      return step5(ctx);
    } else if (wizardState.step === 6) {
      return step6(ctx);
    } else if (wizardState.step === 7) {
      return step7(ctx);
    }
  } else {
    await ctx.scene.leave();
    return showSubMenu(ctx);
  }
});