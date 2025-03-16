// src/telegram/wizards/discovery/discovery.wizard.ts
import { Scenes } from 'telegraf'; // Create the discovery wizard scene with all steps

export const DiscoveryWizard = new Scenes.WizardScene<CustomContext>(
  'discovery-wizard',
  step1
);

// Register all action handlers for the discovery wizard
  
  // Strength type handlers
  DiscoveryWizard.action('discover_type_strongest', async (ctx) => {
    logger.log('Strongest type selected');
    ctx.wizard.state.parameters.type = 'strongest';
    await ctx.answerCbQuery('Showing strongest coins');
    return stepPairTimeframe(ctx);
  });
  
  DiscoveryWizard.action('discover_type_weakest', async (ctx) => {
    logger.log('Weakest type selected');
    ctx.wizard.state.parameters.type = 'weakest';
    await ctx.answerCbQuery('Showing weakest coins');
    return stepPairTimeframe(ctx);
  });
  
  // Average indicator handlers
  DiscoveryWizard.action('discover_indicator_TrendScore', async (ctx) => {
    logger.log('TrendScore indicator selected');
    ctx.wizard.state.parameters.indicator = 'TrendScore';
    await ctx.answerCbQuery('Selected Trend Score indicator');
    return stepPairTimeframe(ctx);
  });
  
  DiscoveryWizard.action('discover_indicator_RSI', async (ctx) => {
    logger.log('RSI indicator selected');
    ctx.wizard.state.parameters.indicator = 'RSI';
    await ctx.answerCbQuery('Selected RSI indicator');
    return stepPairTimeframe(ctx);
  });
  
  DiscoveryWizard.action('discover_indicator_PriceVsTrend', async (ctx) => {
    logger.log('Price vs Trend indicator selected');
    ctx.wizard.state.parameters.indicator = 'Price vs Trend';
    await ctx.answerCbQuery('Selected Price vs Trend indicator');
    return stepPairTimeframe(ctx);
  });
  
  DiscoveryWizard.action('discover_indicator_VolumeToTrend', async (ctx) => {
    logger.log('Volume to Trend indicator selected');
    ctx.wizard.state.parameters.indicator = 'Volume to Trend';
    await ctx.answerCbQuery('Selected Volume to Trend indicator');
    return stepPairTimeframe(ctx);
  });
  
  // Signal type handlers
  DiscoveryWizard.action('discover_signal_TrendScore', async (ctx) => {
    logger.log('TrendScore signal selected');
    ctx.wizard.state.parameters.indicator = 'TrendScore';
    await ctx.answerCbQuery('Selected Trend Score signal');
    return stepSignalsSentiment(ctx);
  });
  
  DiscoveryWizard.action('discover_signal_RSI', async (ctx) => {
    logger.log('RSI signal selected');
    ctx.wizard.state.parameters.indicator = 'RSI';
    await ctx.answerCbQuery('Selected RSI signal');
    return stepSignalsSentiment(ctx);
  });
  
  DiscoveryWizard.action('discover_signal_PriceVsTrend', async (ctx) => {
    logger.log('Price vs Trend signal selected');
    ctx.wizard.state.parameters.indicator = 'Price vs Trend';
    await ctx.answerCbQuery('Selected Price vs Trend signal');
    return stepSignalsSentiment(ctx);
  });
  
  DiscoveryWizard.action('discover_signal_LevelBreaches', async (ctx) => {
    logger.log('Level Breaches signal selected');
    ctx.wizard.state.parameters.indicator = 'Level Breaches';
    await ctx.answerCbQuery('Selected Level Breaches signal');
    return stepSignalsSentiment(ctx);
  });
  
  // Divergence type handler
  DiscoveryWizard.action('discover_divergence_volume_trend', async (ctx) => {
    logger.log('Volume vs Trend divergence selected');
    ctx.wizard.state.parameters.divergenceType = 'volume_trend';
    await ctx.answerCbQuery('Analyzing Volume vs Trend divergences');
    return stepPairTimeframe(ctx);
  });
  
  // Sentiment handlers for signals
  DiscoveryWizard.action('discover_sentiment_bullish_to_bearish', async (ctx) => {
    logger.log('Bullish to bearish sentiment selected');
    ctx.wizard.state.parameters.sentiment = 'bullish_to_bearish';
    await ctx.answerCbQuery('Showing bullish to bearish signals');
    return stepPairTimeframe(ctx);
  });
  
  DiscoveryWizard.action('discover_sentiment_bearish_to_bullish', async (ctx) => {
    logger.log('Bearish to bullish sentiment selected');
    ctx.wizard.state.parameters.sentiment = 'bearish_to_bullish';
    await ctx.answerCbQuery('Showing bearish to bullish signals');
    return stepPairTimeframe(ctx);
  });
  
  // Handle pair/time picker callbacks
  DiscoveryWizard.action(/^cmbpicker_.+$/, async (ctx) => {
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
    
    // If the user clicked "Choose", proceed to show results
    if (result.proceed) {
      // Reset page to 1 when showing new results
      ctx.wizard.state.parameters.page = 1;
      return showDiscoveryResults(ctx);
    }
    
    // Otherwise, just redraw the same step with the updated selection
    return stepPairTimeframe(ctx);
  });
  
  // Handle pagination
  DiscoveryWizard.action(/^discovery_page_(\d+)$/, async (ctx) => {
    const match = /^discovery_page_(\d+)$/.exec(
      ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
    );
    
    if (match) {
      const page = parseInt(match[1], 10);
      logger.log(`Changing to page ${page}`);
      
      // Update the page in wizard state
      ctx.wizard.state.parameters.page = page;
      
      // Show the selected page
      await ctx.answerCbQuery(`Showing page ${page}`);
      return showDiscoveryResults(ctx);
    }
    
    await ctx.answerCbQuery();
  });
  
  // Back to discovery menu action
  DiscoveryWizard.action('back_to_discovery', async (ctx) => {
    logger.log('Returning to discovery menu');
    await ctx.answerCbQuery('Opening discovery menu');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  });
  
  // No-op for current page indicator click
  DiscoveryWizard.action('discovery_page_current', async (ctx) => {
    await ctx.answerCbQuery();
  });
  
  // Go Back button handler
  DiscoveryWizard.action('go_back', async (ctx) => {
    const wizardState = ctx.wizard.state as WizardState;
    const feature = wizardState.parameters?.feature;
    
    // Exit the wizard and return to discovery menu
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  });
  
  // Handle action button callbacks (Add to Watchlist, Set Alert, etc.)
  DiscoveryWizard.action(/^(add_watchlist|set_alert|view_coingecko)_.+$/, async (ctx) => {
    logger.log('Action button callback triggered');
    
    // Get the callback data
    const data = ctx.callbackQuery && 'data' in ctx.callbackQuery 
      ? (ctx.callbackQuery as any).data 
      : '';
    
    // Let the handler process the action
    await actionButtonsHandler.handleCallback(ctx, data);
  });
  
  // Export the wizard for use in the module
  export default DiscoveryWizard;
  import { Logger } from '@nestjs/common';
  import { Markup } from 'telegraf';
  import { CustomContext, WizardState } from '../../interfaces/custom-context.interface';
  import { PairTimePickerComponent, PickerState, PairTimePickerComponentCallbackHandler } from '../../components/pair-time-picker.component';
  import { LoadingMessageComponent, withLoading } from '../../components/loading-message.component';
  import { ActionButtonsComponent, ActionButtonType } from '../../components/action-buttons.component';
  import { ActionButtonsHandler } from '../../components/action-buttons.component';
  import { ChartImageService } from '../../services/chart-image.service';
  import { showDiscoverMenu } from '../../menus/submenus/discover.menu';
  
  // Create logger for discovery wizard
  const logger = new Logger('DiscoveryWizard');
  
  // Initialize components and services
  const pairTimePicker = new PairTimePickerComponent();
  const pairTimePickerHandler = new PairTimePickerComponentCallbackHandler();
  const actionButtonsComponent = new ActionButtonsComponent();
  const actionButtonsHandler = new ActionButtonsHandler();
  const chartImageService = new ChartImageService();
  const loadingMessageComponent = new LoadingMessageComponent();
  
  // Mock data for discovery features
  const mockCoins = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', price: 65482.12, percentChange: 3.2, volume: 35900000000, marketCap: 1250000000000, trendScore: 82, rsi: 62, priceVsTrend: 8.5, volumeVsTrend: 12.3 },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', price: 3245.87, percentChange: 2.5, volume: 18700000000, marketCap: 389000000000, trendScore: 75, rsi: 58, priceVsTrend: 4.2, volumeVsTrend: -5.6 },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB', price: 562.34, percentChange: -1.8, volume: 2300000000, marketCap: 87000000000, trendScore: 48, rsi: 42, priceVsTrend: -3.1, volumeVsTrend: 7.2 },
    { id: 'solana', name: 'Solana', symbol: 'SOL', price: 146.78, percentChange: 5.6, volume: 3800000000, marketCap: 62000000000, trendScore: 88, rsi: 72, priceVsTrend: 12.3, volumeVsTrend: 15.7 },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA', price: 0.58, percentChange: -2.3, volume: 1200000000, marketCap: 20500000000, trendScore: 42, rsi: 38, priceVsTrend: -5.8, volumeVsTrend: -3.2 },
    { id: 'ripple', name: 'XRP', symbol: 'XRP', price: 0.62, percentChange: 1.3, volume: 1800000000, marketCap: 32700000000, trendScore: 65, rsi: 52, priceVsTrend: 2.1, volumeVsTrend: 4.5 },
    { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', price: 7.94, percentChange: -3.7, volume: 670000000, marketCap: 9800000000, trendScore: 35, rsi: 31, priceVsTrend: -8.2, volumeVsTrend: -10.3 },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', price: 0.14, percentChange: 12.5, volume: 2100000000, marketCap: 18400000000, trendScore: 92, rsi: 78, priceVsTrend: 15.6, volumeVsTrend: 18.2 },
    { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX', price: 36.21, percentChange: 4.2, volume: 950000000, marketCap: 12700000000, trendScore: 78, rsi: 64, priceVsTrend: 7.5, volumeVsTrend: 9.1 },
    { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', price: 0.00002512, percentChange: -5.2, volume: 850000000, marketCap: 14800000000, trendScore: 32, rsi: 28, priceVsTrend: -9.4, volumeVsTrend: -6.7 },
    { id: 'litecoin', name: 'Litecoin', symbol: 'LTC', price: 87.65, percentChange: 1.1, volume: 520000000, marketCap: 6400000000, trendScore: 62, rsi: 54, priceVsTrend: 3.2, volumeVsTrend: 2.8 },
    { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', price: 16.34, percentChange: 8.3, volume: 730000000, marketCap: 8900000000, trendScore: 86, rsi: 68, priceVsTrend: 10.7, volumeVsTrend: 14.2 }
  ];
  
  // Loading messages based on feature type
  const DISCOVERY_LOADING_MESSAGES = {
    strength: [
      'Analyzing market strength...',
      'Calculating price momentum...',
      'Finding strongest performers...',
      'Evaluating price movements...',
      'Ranking coins by strength...'
    ],
    average: [
      'Calculating market averages...',
      'Processing indicator data...',
      'Analyzing technical indicators...',
      'Computing market metrics...',
      'Finding significant patterns...'
    ],
    signals: [
      'Scanning for market signals...',
      'Detecting trend changes...',
      'Finding breakout patterns...',
      'Analyzing indicator crossovers...',
      'Evaluating market shifts...'
    ],
    divergences: [
      'Locating price divergences...',
      'Analyzing indicator divergences...',
      'Finding hidden patterns...',
      'Detecting divergent trends...',
      'Calculating correlation breakdowns...'
    ],
    market_cap: [
      'Ranking by market capitalization...',
      'Finding market cap movers...',
      'Calculating valuation changes...',
      'Analyzing market cap rankings...',
      'Evaluating market dominance...'
    ],
    volume: [
      'Analyzing volume trends...',
      'Ranking by trading volume...',
      'Finding volume breakouts...',
      'Calculating volume changes...',
      'Detecting abnormal volume patterns...'
    ]
  };
  
  /**
   * Filter and sort coins based on discovery feature and options
   */
  function getDiscoveryResults(feature: string, options: any, page: number = 1, limit: number = 5) {
    let filteredCoins = [...mockCoins];
  
    // Filter and sort based on feature type
    switch (feature) {
      case 'strength':
        filteredCoins = filteredCoins.sort((a, b) => {
          if (options.type === 'weakest') {
            return a.percentChange - b.percentChange;
          } else {
            return b.percentChange - a.percentChange;
          }
        });
        break;
  
      case 'average':
        // Sort by selected indicator
        switch (options.indicator) {
          case 'TrendScore':
            filteredCoins = filteredCoins.sort((a, b) => b.trendScore - a.trendScore);
            break;
          case 'RSI':
            filteredCoins = filteredCoins.sort((a, b) => b.rsi - a.rsi);
            break;
          case 'Price vs Trend':
            filteredCoins = filteredCoins.sort((a, b) => b.priceVsTrend - a.priceVsTrend);
            break;
          case 'Volume to Trend':
            filteredCoins = filteredCoins.sort((a, b) => b.volumeVsTrend - a.volumeVsTrend);
            break;
          default:
            filteredCoins = filteredCoins.sort((a, b) => b.trendScore - a.trendScore);
        }
        break;
  
      case 'signals':
        // Filter by signal direction
        if (options.sentiment === 'bullish_to_bearish') {
          filteredCoins = filteredCoins.filter(coin => coin.trendScore > 60 && coin.percentChange < 0);
        } else {
          filteredCoins = filteredCoins.filter(coin => coin.trendScore < 40 && coin.percentChange > 0);
        }
        break;
  
      case 'divergences':
        // Sort by volume-trend divergence magnitude
        filteredCoins = filteredCoins.sort((a, b) => Math.abs(b.volumeVsTrend) - Math.abs(a.volumeVsTrend));
        break;
  
      case 'market_cap':
        // Sort by market cap
        filteredCoins = filteredCoins.sort((a, b) => b.marketCap - a.marketCap);
        break;
  
      case 'volume':
        // Sort by volume
        filteredCoins = filteredCoins.sort((a, b) => b.volume - a.volume);
        break;
    }
  
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCoins = filteredCoins.slice(startIndex, endIndex);
  
    return {
      coins: paginatedCoins,
      totalItems: filteredCoins.length,
      page,
      hasMore: endIndex < filteredCoins.length
    };
  }
  
  /**
   * Format coin caption based on feature
   */
  function formatCoinCaption(coin: any, feature: string, options: any): string {
    let caption = `📊 *${coin.name} (${coin.symbol})*\n`;
    caption += `💰 Price: $${coin.price.toLocaleString()} (${coin.percentChange >= 0 ? '⬆️' : '⬇️'} ${Math.abs(coin.percentChange).toFixed(2)}%)\n`;
  
    // Add feature-specific details
    switch (feature) {
      case 'strength':
        caption += `💪 Strength Ranking: ${options.type === 'strongest' ? 'Top Performer' : 'Weak Performer'}\n`;
        caption += `📈 Volume: $${(coin.volume / 1000000).toFixed(2)}M\n`;
        break;
  
      case 'average':
        if (options.indicator === 'TrendScore') {
          caption += `🔍 Trend Score: ${coin.trendScore}/100\n`;
          caption += `📋 Interpretation: ${interpretTrendScore(coin.trendScore)}\n`;
        } else if (options.indicator === 'RSI') {
          caption += `📊 RSI: ${coin.rsi}\n`;
          caption += `📋 Status: ${interpretRSI(coin.rsi)}\n`;
        } else if (options.indicator === 'Price vs Trend') {
          caption += `📉 Price vs Trend: ${coin.priceVsTrend > 0 ? '+' : ''}${coin.priceVsTrend.toFixed(2)}%\n`;
          caption += `📋 Status: ${interpretPriceVsTrend(coin.priceVsTrend)}\n`;
        } else if (options.indicator === 'Volume to Trend') {
          caption += `📊 Volume to Trend: ${coin.volumeVsTrend > 0 ? '+' : ''}${coin.volumeVsTrend.toFixed(2)}%\n`;
          caption += `📋 Status: ${interpretVolumeVsTrend(coin.volumeVsTrend)}\n`;
        }
        break;
  
      case 'signals':
        caption += `🔔 Signal: ${options.sentiment === 'bullish_to_bearish' ? 'Bullish → Bearish' : 'Bearish → Bullish'}\n`;
        caption += `📊 Indicator: ${options.indicator || 'TrendScore'}\n`;
        
        if (options.indicator === 'RSI') {
          caption += `📋 RSI Value: ${coin.rsi}\n`;
        } else if (options.indicator === 'Price vs Trend') {
          caption += `📋 Price/Trend: ${coin.priceVsTrend.toFixed(2)}%\n`;
        } else {
          caption += `📋 Trend Score: ${coin.trendScore}/100\n`;
        }
        break;
  
      case 'divergences':
        caption += `↗️ Volume vs Trend Divergence: ${coin.volumeVsTrend > 0 ? '+' : ''}${coin.volumeVsTrend.toFixed(2)}%\n`;
        caption += `📋 Interpretation: ${interpretDivergence(coin.volumeVsTrend)}\n`;
        break;
  
      case 'market_cap':
        caption += `💰 Market Cap: $${(coin.marketCap / 1000000000).toFixed(2)}B\n`;
        caption += `📋 Rank Change: ${Math.random() > 0.5 ? '⬆️' : '⬇️'} ${Math.floor(Math.random() * 5) + 1}\n`;
        break;
  
      case 'volume':
        caption += `📈 Volume: $${(coin.volume / 1000000).toFixed(2)}M\n`;
        caption += `📋 Volume Change: ${Math.random() > 0.5 ? '⬆️' : '⬇️'} ${(Math.random() * 30).toFixed(2)}%\n`;
        break;
    }
  
    // Add timeframe information
    caption += `\n⏱️ Timeframe: ${options.timeframe}`;
  
    return caption;
  }
  
  /**
   * Helper functions to interpret indicator values
   */
  function interpretTrendScore(score: number): string {
    if (score >= 80) return 'Very Bullish';
    if (score >= 60) return 'Bullish';
    if (score >= 40) return 'Neutral';
    if (score >= 20) return 'Bearish';
    return 'Very Bearish';
  }
  
  function interpretRSI(rsi: number): string {
    if (rsi >= 70) return 'Overbought';
    if (rsi >= 60) return 'Bullish';
    if (rsi >= 40) return 'Neutral';
    if (rsi >= 30) return 'Bearish';
    return 'Oversold';
  }
  
  function interpretPriceVsTrend(value: number): string {
    if (value >= 10) return 'Strongly Overperforming Trend';
    if (value >= 5) return 'Overperforming Trend';
    if (value >= -5) return 'Following Trend';
    if (value >= -10) return 'Underperforming Trend';
    return 'Strongly Underperforming Trend';
  }
  
  function interpretVolumeVsTrend(value: number): string {
    if (value >= 10) return 'Volume Significantly Above Trend';
    if (value >= 5) return 'Volume Above Trend';
    if (value >= -5) return 'Volume Following Trend';
    if (value >= -10) return 'Volume Below Trend';
    return 'Volume Significantly Below Trend';
  }
  
  function interpretDivergence(value: number): string {
    if (Math.abs(value) >= 15) return 'Strong Divergence - Potential Reversal Signal';
    if (Math.abs(value) >= 10) return 'Moderate Divergence - Watch Carefully';
    if (Math.abs(value) >= 5) return 'Slight Divergence - Early Signal';
    return 'No Significant Divergence';
  }
  
  /**
   * Helper function to create pagination keyboard
   */
  function createPaginationKeyboard(currentPage: number, totalItems: number, itemsPerPage: number) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const buttons: Array<ReturnType<typeof Markup.button.callback>> = [];
  
    // Previous page button
    if (currentPage > 1) {
      buttons.push(Markup.button.callback('◀️ Previous', `discovery_page_${currentPage - 1}`));
    }
  
    // Page indicator
    buttons.push(Markup.button.callback(`${currentPage} / ${totalPages}`, 'discovery_page_current'));
  
    // Next page button
    if (currentPage < totalPages) {
      buttons.push(Markup.button.callback('Next ▶️', `discovery_page_${currentPage + 1}`));
    }
  
    // Return to discovery menu button
    const keyboard = [
      buttons,
      [Markup.button.callback('← Back to Discovery Menu', 'back_to_discovery')]
    ];
  
    return Markup.inlineKeyboard(keyboard);
  }
  
  /**
   * Helper function to get display name for feature
   */
  function getFeatureDisplayName(feature: string): string {
    switch (feature) {
      case 'strength': return 'Strength';
      case 'average': return 'Market Average';
      case 'signals': return 'Latest Signals';
      case 'divergences': return 'Divergences';
      case 'market_cap': return 'Market Cap';
      case 'volume': return 'Volume';
      default: return 'Discovery';
    }
  }
  
  // Step 1: Choose specific type based on feature
  async function step1(ctx: CustomContext) {
    (ctx.wizard.state as WizardState).step = 1;
    logger.log('Step 1: Initial discovery feature selection');
  
    // Initialize parameters if needed
    if (!ctx.wizard.state.parameters) {
      ctx.wizard.state.parameters = {};
    }
  
    // Get the feature from scene state or context
    let feature;
    if (ctx.scene.state && 'feature' in ctx.scene.state) {
      feature = ctx.scene.state.feature;
      ctx.wizard.state.parameters.feature = feature;
      logger.log(`Feature set from scene state: ${feature}`);
    } else if (ctx.wizard.state.parameters.feature) {
      feature = ctx.wizard.state.parameters.feature;
      logger.log(`Feature already set in wizard state: ${feature}`);
    } else {
      logger.error('No feature specified');
      await ctx.reply('❌ Error: No discovery feature specified. Please select a feature from the menu.');
      await showDiscoverMenu(ctx);
      return ctx.scene.leave();
    }
  
    // Customize the wizard based on the selected feature
    switch (feature) {
      case 'strength':
        return stepStrengthType(ctx);
      case 'average':
        return stepAverageIndicator(ctx);
      case 'signals':
        return stepSignalsIndicator(ctx);
      case 'divergences':
        return stepDivergencesType(ctx);
      case 'market_cap':
        // Market cap feature doesn't need type selection, go straight to pairing/timeframe
        return stepPairTimeframe(ctx);
      case 'volume':
        // Volume feature doesn't need type selection, go straight to pairing/timeframe
        return stepPairTimeframe(ctx);
      default:
        logger.error(`Unknown feature: ${feature}`);
        await ctx.reply('❌ Error: Unknown discovery feature.');
        await showDiscoverMenu(ctx);
        return ctx.scene.leave();
    }
  }
  
  // Step for Strength type selection (weakest/strongest)
  async function stepStrengthType(ctx: CustomContext) {
    logger.log('Step: Strength type selection');
  
    const messageText = '💪 *Strength Discovery*\n\nDo you want to see the strongest or weakest performers?';
  
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔥 Strongest', 'discover_type_strongest'),
        Markup.button.callback('❄️ Weakest', 'discover_type_weakest')
      ],
      [
        Markup.button.callback('← Back', 'go_back')
      ]
    ]);
  
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
  
  // Step for Average indicator type selection
  async function stepAverageIndicator(ctx: CustomContext) {
    logger.log('Step: Average indicator selection');
  
    const messageText = '📊 *Market Average Discovery*\n\nWhich indicator would you like to analyze?';
  
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Trend Score', 'discover_indicator_TrendScore'),
        Markup.button.callback('RSI', 'discover_indicator_RSI')
      ],
      [
        Markup.button.callback('Price vs Trend', 'discover_indicator_PriceVsTrend'),
        Markup.button.callback('Volume to Trend', 'discover_indicator_VolumeToTrend')
      ],
      [
        Markup.button.callback('← Back', 'go_back')
      ]
    ]);
  
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
  
  // Step for Signals indicator type selection
  async function stepSignalsIndicator(ctx: CustomContext) {
    logger.log('Step: Signals indicator selection');
  
    const messageText = '🔔 *Latest Signals Discovery*\n\nWhich signal type would you like to analyze?';
  
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Trend Score', 'discover_signal_TrendScore'),
        Markup.button.callback('RSI', 'discover_signal_RSI')
      ],
      [
        Markup.button.callback('Price vs Trend', 'discover_signal_PriceVsTrend'),
        Markup.button.callback('Level Breaches', 'discover_signal_LevelBreaches')
      ],
      [
        Markup.button.callback('← Back', 'go_back')
      ]
    ]);
  
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
  
  // Step for Divergences type selection
  async function stepDivergencesType(ctx: CustomContext) {
    logger.log('Step: Divergences type selection');
  
    const messageText = '↗️ *Divergences Discovery*\n\nWhich divergence type would you like to analyze?';
  
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Volume vs Trend', 'discover_divergence_volume_trend')
      ],
      [
        Markup.button.callback('← Back', 'go_back')
      ]
    ]);
  
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
  
  // Step for Signals sentiment selection
  async function stepSignalsSentiment(ctx: CustomContext) {
    logger.log('Step: Signals sentiment selection');
  
    const messageText = '🔔 *Latest Signals Discovery*\n\nWhich market sentiment would you like to see?';
  
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🐂 Bullish to Bearish', 'discover_sentiment_bullish_to_bearish')
      ],
      [
        Markup.button.callback('🐻 Bearish to Bullish', 'discover_sentiment_bearish_to_bullish')
      ],
      [
        Markup.button.callback('← Back', 'go_back')
      ]
    ]);
  
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
  
  // Common step for pair and timeframe selection
  async function stepPairTimeframe(ctx: CustomContext) {
    (ctx.wizard.state as WizardState).step = 2;
    logger.log('Step 2: Pair/timeframe selection');
  
    // Set or initialize the picker state
    if (!ctx.wizard.state.parameters.pickerState) {
      ctx.wizard.state.parameters.pickerState = {
        selectedPairing: 'USD',
        selectedTimeframe: '1D'
      };
    }
  
    // Get feature name for display
    const featureName = getFeatureDisplayName(ctx.wizard.state.parameters.feature);
  
    // Show the combined picker with current selection
    const messageText = `📊 *${featureName} Discovery*\n\nPlease select currency pair and timeframe:`;
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
  
  // Final step: Show discovery results
  async function showDiscoveryResults(ctx: CustomContext) {
    logger.log('Step: Showing discovery results');
  
    const parameters = ctx.wizard.state.parameters;
    const feature = parameters.feature;
    const pickerState = parameters.pickerState || { selectedPairing: 'USD', selectedTimeframe: '1D' };
    const page = parameters.page || 1;
  
    // Prepare discovery options
    const options: any = {
      feature,
      pairing: pickerState.selectedPairing,
      timeframe: pickerState.selectedTimeframe,
      type: parameters.type,
      indicator: parameters.indicator,
      sentiment: parameters.sentiment,
      divergenceType: parameters.divergenceType
    };
  
    // Get feature name for display
    const featureName = getFeatureDisplayName(feature);
  
    try {
      // Use the withLoading helper to show loading messages during data fetching
      await withLoading(
        ctx,
        async () => {
          // Fetch discovery results (mock function)
          const results = getDiscoveryResults(feature, options, page);
  
          // If no results, show a message and return to feature selection
          if (results.coins.length === 0) {
            await ctx.reply('❌ No matching coins found for your criteria.');
            return stepPairTimeframe(ctx);
          }
  
          // Store pagination info in state
          parameters.totalItems = results.totalItems;
          parameters.hasMore = results.hasMore;
  
          // Send header message with pagination info
          const headerText = `*${featureName} Discovery*\n` +
                        `Pairing: ${pickerState.selectedPairing} | Timeframe: ${pickerState.selectedTimeframe}\n` +
                        `Showing results ${(page - 1) * 5 + 1}-${(page - 1) * 5 + results.coins.length} of ${results.totalItems}`;
  
          await ctx.reply(headerText, { parse_mode: 'Markdown' });
  
          // Send result messages for each coin
          for (const coin of results.coins) {
            // Generate chart for the coin
            const imageBuffer = await chartImageService.generateMockChart(
              coin.name,
              pickerState.selectedPairing,
              pickerState.selectedTimeframe
            );
  
            // Format the caption based on feature type
            const caption = formatCoinCaption(coin, feature, options);
  
            // Send chart with caption and action buttons
            await ctx.replyWithPhoto({ source: imageBuffer }, { 
              caption: caption, 
              parse_mode: 'Markdown',
              reply_markup: actionButtonsComponent.createMarkup({
                type: ActionButtonType.TRADING,
                identifier: coin.id
              }).reply_markup
            });
          }
  
          // Add pagination controls if needed
          if (results.totalItems > 5) {
            const paginationKeyboard = createPaginationKeyboard(page, results.totalItems, 5);
            await ctx.reply('Navigate through results:', { reply_markup: paginationKeyboard.reply_markup });
          }
  
          // Add a button to return to discovery menu
          await ctx.reply('Would you like to try another discovery feature?', {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('← Back to Discovery Menu', 'back_to_discovery')]
            ]).reply_markup
          });
        },
        {
          // Get loading messages based on feature
          messages: DISCOVERY_LOADING_MESSAGES[feature] || DISCOVERY_LOADING_MESSAGES.strength,
          emoji: '🔍'
        }
      );
    } catch (error) {
      logger.error(`Error showing discovery results: ${error.message}`);
      await ctx.reply('❌ An error occurred while retrieving discovery data. Please try again.');
      return stepPairTimeframe(ctx);
    }
  }