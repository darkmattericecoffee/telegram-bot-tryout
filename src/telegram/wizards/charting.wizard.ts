// src/telegram/wizards/charting.wizard.ts
import { Scenes } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
import { CoinSearchComponent, CoinSearchConfig, CoinSearchState } from '../components/coin-search.component';
import { PairTimePickerComponent, PickerState, PairTimePickerComponentCallbackHandler } from '../components/pair-time-picker.component';
import { ChartImageService } from '../services/chart-image.service';
import { getReplyWithChart } from '../components/reply-with-image-caption.component';
import { Logger } from '@nestjs/common';

const logger = new Logger('ChartingWizard');
const picker = new PairTimePickerComponent();
const pickerHandler = new PairTimePickerComponentCallbackHandler();

// Assuming CoinSearchService is available from DI or a local import
import { CoinSearchService } from '../services/coin-search.service';

export const ChartingWizard = new Scenes.WizardScene<CustomContext>(
  'charting-wizard',
  async (ctx) => {
    // Step 1: Prompt for coin search query
    logger.log('Step 1: Prompting for coin search');
    const coinSearchComponent = new CoinSearchComponent(new CoinSearchService());
    const coinSearchConfig: CoinSearchConfig = {
      promptText: 'Enter the coin name or symbol to search:',
      fieldName: 'selectedCoin',
    };
    await coinSearchComponent.prompt(ctx, coinSearchConfig);
    return ctx.wizard.next();
  },
  async (ctx) => {
    // Step 2: Process coin search query from text message
    logger.log('Step 2: Processing text input');
    if (!ctx.message || !('text' in ctx.message)) {
      logger.log('Step 2: No text message found');
      return;
    }
    const coinSearchComponent = new CoinSearchComponent(new CoinSearchService());
    const coinSearchConfig: CoinSearchConfig = {
      promptText: 'Enter the coin name or symbol to search:',
      fieldName: 'selectedCoin',
    };
    const searchState: CoinSearchState = await coinSearchComponent.processSearch(ctx, ctx.message.text, coinSearchConfig);
    // Save search state in wizard state
    ctx.wizard.state.coinSearchState = searchState;

    logger.log(`Step 2: Search completed. Has selectedCoin: ${!!searchState.selectedCoin}`);
    
    if (searchState.selectedCoin) {
      // If high confidence, save coin and move on directly to the pair/time picker
      if (!ctx.wizard.state.parameters) {
        ctx.wizard.state.parameters = {};
      }
      ctx.wizard.state.parameters.selectedCoin = searchState.selectedCoin;
      
      logger.log(`Step 2: High confidence match found. Selected coin: ${searchState.selectedCoin.name}`);
      logger.log(`Step 2: Current step: ${ctx.wizard.cursor}`);
      
      // Try directly moving to the pair/time picker step
      try {
        // Send a debug message to confirm where we are
        await ctx.reply(`DEBUG: Moving to pair/time picker with ${searchState.selectedCoin.name}`);
        
        // Initialize picker state preemptively
        ctx.wizard.state.pickerState = { selectedPairing: 'USD', selectedTimeframe: '1D' };
        
        // Try moving to step 3 (index 3, which is the 4th step)
        logger.log('Step 2: Attempting to move to pair/time picker step');
        
        // Clear any pending callback queries to avoid interference
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery();
        }
        
        // Try both methods to ensure one works
        return ctx.wizard.selectStep(3);
      } catch (error) {
        logger.error(`Step 2: Error moving to next step: ${error.message}`);
        await ctx.reply('An error occurred. Please try again.');
        return ctx.scene.leave();
      }
    }
    
    // Otherwise, show the results for user selection.
    logger.log('Step 2: No high confidence match, showing results');
    await coinSearchComponent.showResults(ctx, searchState);
    // Stay on the same step waiting for a callback query
  },
  async (ctx) => {
    // Step 3: Handle coin selection callback
    logger.log('Step 3: Handling coin selection callback');
    
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string' &&
        ctx.callbackQuery.data.startsWith('coinsearch_select_')) {
      logger.log(`Step 3: Processing selection callback: ${ctx.callbackQuery.data}`);
      const selectedCoinId = ctx.callbackQuery.data.replace('coinsearch_select_', '');
      const coinSearchState: CoinSearchState | undefined = ctx.wizard.state.coinSearchState;
      if (coinSearchState) {
        const selected = coinSearchState.results.find(r => r.coin.id === selectedCoinId);
        if (selected) {
          if (!ctx.wizard.state.parameters) {
            ctx.wizard.state.parameters = {};
          }
          ctx.wizard.state.parameters.selectedCoin = selected.coin;
          logger.log(`Step 3: Selected coin from callback: ${selected.coin.name}`);
        }
      }
      await ctx.answerCbQuery();
      logger.log('Step 3: Moving to pair/time picker step');
      return ctx.wizard.next();
    }
    
    // This branch is for when a coin was already selected with high confidence
    // and we're just passing through this step
    else if (ctx.wizard.state.parameters?.selectedCoin) {
      logger.log(`Step 3: Already have selected coin: ${ctx.wizard.state.parameters.selectedCoin.name}`);
      logger.log('Step 3: Moving to pair/time picker step');
      return ctx.wizard.next();
    }
    
    logger.log('Step 3: No callback or selected coin found. Doing nothing.');
    // If not our callback and no selected coin, do nothing.
  },
  async (ctx) => {
    // Step 4: Render the Pair and Timeframe picker.
    logger.log('Step 4: Rendering pair/time picker');
    
    // Set a default state if not already
    if (!ctx.wizard.state.pickerState) {
      ctx.wizard.state.pickerState = { selectedPairing: 'USD', selectedTimeframe: '1D' };
    }
    
    logger.log(`Step 4: Picker state: ${JSON.stringify(ctx.wizard.state.pickerState)}`);
    logger.log(`Step 4: Selected coin: ${ctx.wizard.state.parameters?.selectedCoin?.name || 'None'}`);
    
    const keyboard = picker.render('cmbpicker', ctx.wizard.state.pickerState);
    const promptText = 'Select a currency pairing and timeframe:';
    
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(promptText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
      } else {
        await ctx.reply(promptText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
      }
      logger.log('Step 4: Pair/time picker rendered successfully');
      return ctx.wizard.next();
    } catch (error) {
      logger.error(`Step 4: Error rendering picker: ${error.message}`);
      await ctx.reply('An error occurred with the picker. Please try again.');
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    // Step 5: Process selections from the Pair/Time picker.
    logger.log('Step 5: Processing pair/time picker selections');
    
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string') {
      logger.log(`Step 5: Received callback: ${ctx.callbackQuery.data}`);
      
      // Use the pickerHandler to process the callback:
      const { state, proceed } = await pickerHandler.handleCallback(ctx, ctx.callbackQuery.data, ctx.wizard.state.pickerState!);
      ctx.wizard.state.pickerState = state;
      
      if (proceed) {
        logger.log('Step 5: Proceed flag received, moving to chart generation');
        return ctx.wizard.next();
      } else {
        logger.log('Step 5: Updating picker with new state');
        const keyboard = picker.render('cmbpicker', state);
        await ctx.editMessageText('Select a currency pairing and timeframe:', { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
      }
    } else {
      logger.log('Step 5: No callback data received');
    }
  },
  async (ctx) => {
    // Step 6: Final step - generate and send the chart.
    logger.log('Step 6: Generating chart');
    
    const parameters = ctx.wizard.state.parameters;
    const pickerState: PickerState | undefined = ctx.wizard.state.pickerState;
    
    logger.log(`Step 6: Parameters: ${JSON.stringify(parameters)}`);
    logger.log(`Step 6: Picker state: ${JSON.stringify(pickerState)}`);
    
    if (!pickerState || !parameters?.selectedCoin) {
      logger.error('Step 6: Missing required parameters');
      await ctx.reply('Missing parameters. Exiting wizard.');
      return ctx.scene.leave();
    }
    
    // Ensure selectedPairing is a string (fallback if null)
    const selectedPairing: string = pickerState.selectedPairing ?? 'USD';
    const selectedTimeframe: string = pickerState.selectedTimeframe ?? '1D';
    const selectedCoin = parameters.selectedCoin;

    logger.log(`Step 6: Generating chart for ${selectedCoin.name} / ${selectedPairing} / ${selectedTimeframe}`);
    
    const caption = `Chart for ${selectedCoin.name} (${selectedCoin.symbol})\nPairing: ${selectedPairing}\nTimeframe: ${selectedTimeframe}`;

    try {
      const chartImageService = new ChartImageService();
      const imageBuffer = await chartImageService.generateMockChart(selectedCoin.name, selectedPairing, selectedTimeframe);

      await getReplyWithChart(ctx, imageBuffer, caption);
      logger.log('Step 6: Chart generated and sent successfully');
    } catch (error) {
      logger.error(`Step 6: Error generating chart: ${error.message}`);
      await ctx.reply('An error occurred while generating the chart. Please try again.');
    }
    
    logger.log('Step 6: Leaving wizard scene');
    return ctx.scene.leave();
  }
);