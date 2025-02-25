import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext, WizardState } from '../interfaces/custom-context.interface';
import { CoinSearchComponent, CoinSearchConfig, CoinSearchState,  } from '../components/coin-search.component';
import { PairTimePickerComponent, PickerState, PairTimePickerComponentCallbackHandler } from '../components/pair-time-picker.component';
import { ChartImageService } from '../services/chart-image.service';
import { getReplyWithChart } from '../components/reply-with-image-caption.component';
import { CoinSearchService } from '../services/coin-search.service';
// Create logger for wizard
const logger = new Logger('ChartingWizard');

// Initialize components
const coinSearchService = new CoinSearchService();
const coinSearchComponent = new CoinSearchComponent(coinSearchService);
const pairTimePicker = new PairTimePickerComponent();
const pairTimePickerHandler = new PairTimePickerComponentCallbackHandler();
const chartImageService = new ChartImageService();

// Step 1: Coin Search Component - Search screen
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Step 1: Prompting for coin search');
  
  const searchConfig: CoinSearchConfig = {
    promptText: 'Enter the coin name or symbol to search:',
    fieldName: 'selectedCoin',
    confidenceThreshold: 2.5,
    searchCallbackPrefix: 'coinsearch'
  };
  
  await coinSearchComponent.prompt(ctx, searchConfig);
}

// Step 2: Show search results when needed
async function step2(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Step 2: Showing search results');
  
  // Get the current search state
  const searchState = ctx.wizard.state.parameters?.coinSearchState as CoinSearchState;
  
  if (!searchState) {
    logger.error('Search state is missing, returning to search prompt');
    return step1(ctx);
  }
  
  // Show the search results
  await coinSearchComponent.showResults(ctx, searchState, 'coinsearch');
}

// Step 3: Pair and Timeframe Picker Component
async function step3(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log('Step 3: Rendering pair/time picker');
  
  // Set or initialize the picker state
  if (!ctx.wizard.state.parameters) {
    ctx.wizard.state.parameters = {};
  }
  
  if (!ctx.wizard.state.parameters.pickerState) {
    ctx.wizard.state.parameters.pickerState = {
      selectedPairing: 'USD',
      selectedTimeframe: '1D'
    };
  }
  
  logger.log(`Step 3: Picker state: ${JSON.stringify(ctx.wizard.state.parameters.pickerState)}`);
  logger.log(`Step 3: Selected coin: ${ctx.wizard.state.parameters?.selectedCoin?.name || 'None'}`);
  
  // Show the combined picker with current selection
  const messageText = 'Select a currency pairing and timeframe:';
  const keyboard = pairTimePicker.render('cmbpicker', ctx.wizard.state.parameters.pickerState);
  
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

// Step 4: Generate chart after selections are made
async function step4(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 4;
  logger.log('Step 4: Generating chart');
  
  const parameters = ctx.wizard.state.parameters;
  const pickerState: PickerState | undefined = ctx.wizard.state.parameters?.pickerState;
  
  logger.log(`Step 4: Parameters: ${JSON.stringify(parameters)}`);
  logger.log(`Step 4: Picker state: ${JSON.stringify(pickerState)}`);
  
  if (!pickerState || !parameters?.selectedCoin) {
    logger.error('Step 4: Missing required parameters');
    await ctx.reply('Missing parameters. Exiting wizard.');
    return ctx.scene.leave();
  }
  
  // Ensure selectedPairing is a string (fallback if null)
  const selectedPairing: string = pickerState.selectedPairing ?? 'USD';
  const selectedTimeframe: string = pickerState.selectedTimeframe ?? '1D';
  const selectedCoin = parameters.selectedCoin;

  logger.log(`Step 4: Generating chart for ${selectedCoin.name} / ${selectedPairing} / ${selectedTimeframe}`);
  
  const caption = `Chart for ${selectedCoin.name} (${selectedCoin.symbol})\nPairing: ${selectedPairing}\nTimeframe: ${selectedTimeframe}`;

  try {
    const imageBuffer = await chartImageService.generateMockChart(selectedCoin.name, selectedPairing, selectedTimeframe);
    await getReplyWithChart(ctx, imageBuffer, caption);
    logger.log('Step 4: Chart generated and sent successfully');
  } catch (error) {
    logger.error(`Step 4: Error generating chart: ${error.message}`);
    await ctx.reply('An error occurred while generating the chart. Please try again.');
  }
  
  logger.log('Step 4: Leaving wizard scene');
  return ctx.scene.leave();
}

// Create the charting wizard with clear step functions
export const ChartingWizard = new Scenes.WizardScene<CustomContext>(
  'charting-wizard',
  step1
);

// Handle text input for coin search
ChartingWizard.on('text', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  const step = wizardState.step;
  
  logger.log(`Received text input in step ${step}`);
  
  // Handle only step 1 (initial coin search)
  if (step === 1) {
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
      
      if (!wizardState.parameters) {
        wizardState.parameters = {};
      }
      
      const state = await coinSearchComponent.processSearch(ctx, query, searchConfig);
      
      // Store the search state
      wizardState.parameters.coinSearchState = state;
      
      // If we have a high confidence match, store it and proceed
      if (state.selectedCoin) {
        logger.log(`High confidence match found: ${state.selectedCoin.name}`);
        wizardState.parameters.selectedCoin = state.selectedCoin;
        return step3(ctx);
      }
      
      // Otherwise, show results for user to choose
      logger.log('No high confidence match, showing results');
      return step2(ctx);
    } catch (error) {
      logger.error(`Error processing search: ${error.message}`);
      await ctx.reply('An error occurred while searching. Please try again.');
      return step1(ctx);
    }
  }
});

// Coin search result selection
ChartingWizard.action(/^coinsearch_select_\w+$/, async (ctx) => {
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
    return step3(ctx);
  }
  
  logger.error(`Coin not found with ID: ${coinId}`);
  await ctx.answerCbQuery('Error: Coin not found');
  return step2(ctx);
});

// Pagination for search results
ChartingWizard.action(/^coinsearch_next_\d+$/, async (ctx) => {
  logger.log('Next page action triggered');
  
  // Get current state
  const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!state) {
    logger.error('Search state is missing');
    return step1(ctx);
  }
  
  // Update page number
  state.page += 1;
  
  // Update the state
  ctx.wizard.state.parameters.coinSearchState = state;
  
  // Show updated results
  await coinSearchComponent.showResults(ctx, state, 'coinsearch');
  
  await ctx.answerCbQuery();
});

ChartingWizard.action(/^coinsearch_prev_\d+$/, async (ctx) => {
  logger.log('Previous page action triggered');
  
  // Get current state
  const state = ctx.wizard.state.parameters.coinSearchState as CoinSearchState;
  
  if (!state) {
    logger.error('Search state is missing');
    return step1(ctx);
  }
  
  // Update page number (ensure it doesn't go below 1)
  state.page = Math.max(1, state.page - 1);
  
  // Update the state
  ctx.wizard.state.parameters.coinSearchState = state;
  
  // Show updated results
  await coinSearchComponent.showResults(ctx, state, 'coinsearch');
  
  await ctx.answerCbQuery();
});

// Handle all pair/time picker callbacks
ChartingWizard.action(/^cmbpicker_.+$/, async (ctx) => {
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
  const result = await pairTimePickerHandler.handleCallback(ctx, data, currentState);
  
  // Update the state in the wizard
  ctx.wizard.state.parameters.pickerState = result.state;
  
  // If the user clicked "Choose", proceed to the next step
  if (result.proceed) {
    return step4(ctx);
  }
  
  // Otherwise, just redraw the same step with the updated selection
  return step3(ctx);
});

// Go Back button handler
ChartingWizard.action('go_back', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  if (wizardState.step && wizardState.step > 1) {
    wizardState.step = wizardState.step - 1;
    if (wizardState.step === 1) {
      return step1(ctx);
    } else if (wizardState.step === 2) {
      return step2(ctx);
    } else if (wizardState.step === 3) {
      return step3(ctx);
    }
  } else {
    await ctx.scene.leave();
    // Optional: Return to main menu or other scene
    // return showMainMenu(ctx);
  }
});