// src/telegram/wizards/charting.wizard.ts
import { Scenes } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
import { CoinSearchComponent, CoinSearchConfig, CoinSearchState } from '../components/coin-search.component';
import { PairTimePickerComponent, PickerState } from '../components/pair-time-picker.component';
import { ChartImageService } from '../services/chart-image.service';
import { getReplyWithChart } from '../components/reply-with-image-caption.component';

// We assume that CoinSearchService is already provided in our DI container;
// here for the mock we can instantiate a new one.
const { CoinSearchService } = require('../services/coin-search.service');

export const chartingWizard = new Scenes.WizardScene<CustomContext>(
  'charting-wizard',
  async (ctx) => {
    // Step 1: Prompt for coin search query
    const coinSearchComponent = new CoinSearchComponent(new CoinSearchService());
    const coinSearchConfig: CoinSearchConfig = {
      promptText: 'Enter the coin name or symbol to search:',
      fieldName: 'selectedCoin',
    };
    await coinSearchComponent.prompt(ctx, coinSearchConfig);
    return ctx.wizard.next();
  },
  async (ctx) => {
    // Step 1 text handler: process coin search query from text message
    if (!ctx.message || typeof ctx.message.text !== 'string') {
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
    if (searchState.selectedCoin) {
      // If high confidence, save coin and move on.
      ctx.wizard.state.parameters = { selectedCoin: searchState.selectedCoin };
      return ctx.wizard.next();
    }
    // Otherwise, show the results for user selection.
    await coinSearchComponent.showResults(ctx, searchState);
    // Stay on the same step waiting for a callback query
  },
  async (ctx) => {
    // Step 1 callback: process coin selection if user clicks a result button.
    if (ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string' && ctx.callbackQuery.data.startsWith('coinsearch_select_')) {
      const selectedCoinId = ctx.callbackQuery.data.replace('coinsearch_select_', '');
      const coinSearchState: CoinSearchState = ctx.wizard.state.coinSearchState;
      const selected = coinSearchState.results.find(r => r.coin.id === selectedCoinId);
      if (selected) {
        ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, selectedCoin: selected.coin };
      }
      return ctx.wizard.next();
    }
    // If not our callback, do nothing.
  },
  async (ctx) => {
    // Step 2: Render the Pair and Timeframe picker.
    const pairTimePicker = new PairTimePickerComponent();
    // Set a default state if not already
    if (!ctx.wizard.state.pickerState) {
      ctx.wizard.state.pickerState = { selectedPairing: 'USD', selectedTimeframe: '1D', type: 'default' };
    }
    const keyboard = pairTimePicker.render('cmbpicker', ctx.wizard.state.pickerState);
    const promptText = 'Select a currency pairing and timeframe:';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(promptText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
    } else {
      await ctx.reply(promptText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
    }
    return ctx.wizard.next();
  },
  async (ctx) => {
    // Step 2 callback: process selections from the Pair/Time picker.
    if (ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string') {
      const pairTimePicker = new PairTimePickerComponent();
      let currentState: PickerState = ctx.wizard.state.pickerState;
      const { state, proceed, redraw } = await pairTimePicker.handleCallback(ctx, ctx.callbackQuery.data, currentState);
      ctx.wizard.state.pickerState = state;
      if (redraw) {
        const keyboard = pairTimePicker.render('cmbpicker', state);
        const promptText = 'Select a currency pairing and timeframe:';
        await ctx.editMessageText(promptText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
      }
      if (proceed) {
        return ctx.wizard.next();
      }
      // Otherwise, remain in the same step.
    }
  },
  async (ctx) => {
    // Step 3: Final step - generate and send the mock chart.
    const parameters = ctx.wizard.state.parameters;
    const pickerState: PickerState = ctx.wizard.state.pickerState;
    const selectedCoin = parameters.selectedCoin;
    const selectedPairing = pickerState.selectedPairing;
    const selectedTimeframe = pickerState.selectedTimeframe;

    const caption = `Chart for ${selectedCoin.name} (${selectedCoin.symbol})\nPairing: ${selectedPairing}\nTimeframe: ${selectedTimeframe}`;

    const chartImageService = new ChartImageService();
    const imageBuffer = await chartImageService.generateMockChart(selectedCoin.name, selectedPairing, selectedTimeframe);

    await getReplyWithChart(ctx, imageBuffer, caption);
    return ctx.scene.leave();
  }
);