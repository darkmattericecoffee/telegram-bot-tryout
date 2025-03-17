// src/telegram/wizards/discovery/latest-signals.wizard.ts
import { Scenes, Markup } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext, WizardState } from '../../interfaces/custom-context.interface';
import { DiscoveryService, LatestSignalsParams } from '../../services/discovery.service';
import { DiscoveryChartService } from '../../services/discovery-chart.service';
import { withLoading } from '../../components/loading-message.component';
import { pickerComponent } from '../../components/picker.component/picker.component';
import { showDiscoverMenu } from '../../menus/submenus/discover.menu';
import { optionsComponent } from '../../components/options.component/options.component';
import { OptionsService, OptionsType } from '../../services/options.service';

// Initialize logger
const logger = new Logger('LatestSignalsWizard');

// Initialize services
const optionsService = new OptionsService();

// Step 1: Select Indicator Type
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Entering step 1: Indicator type selection');

  // Ensure discovery service is available
  const discoveryService = (ctx as any).discoveryService as DiscoveryService;
  
  if (!discoveryService) {
    logger.error('Discovery service not properly injected into context');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }

  try {
    // Fetch available indicators from the service
    const indicators = await optionsService.getOptions(OptionsType.INDICATORS);
    
    // Map each indicator to an option
    const options = indicators.map(indicator => ({
      label: indicator,
      action: `indicator_${indicator.toLowerCase().replace(/\s+/g, '_')}`
    }));
    
    // Add a simplified "All Indicators" option
    options.unshift({ label: '📊 All Indicators', action: 'indicator_all' });
    
    const pickerConfig = {
      text: '📈 *Latest Signals*\n\nWhich indicator would you like to see signals for?',
      options,
      autoLayout: true
    };

    await pickerComponent(ctx, pickerConfig);
  } catch (error) {
    logger.error(`Error fetching indicators: ${error.message}`);
    await ctx.reply('An error occurred while fetching indicators. Please try again.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
}

// Step 2: Select Signal Direction/Sentiment
async function step2(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Entering step 2: Signal direction selection');
  
  const { indicatorType } = ctx.wizard.state.parameters;
  const indicatorDisplay = indicatorType === 'all' ? 'All Indicators' : indicatorType;
  
  try {
    // Fetch market transitions from the options service
    const marketTransitions = await optionsService.getOptions(OptionsType.MARKET_TRANSITIONS);
    
    // Map market transitions to options
    const options = marketTransitions.map(transition => {
      // Convert to proper action format (lowercase with underscores)
      const actionValue = transition.toLowerCase().replace(/\s+/g, '_');
      return {
        label: `${transition === 'Bearish to Bullish' ? '📈' : '📉'} ${transition}`,
        action: `sentiment_${actionValue}`
      };
    });
    
    const pickerConfig = {
      text: `🔍 *Signal Direction for ${indicatorDisplay}*\n\nWhat type of market sentiment are you looking for?`,
      options,
      autoLayout: true
    };

    await pickerComponent(ctx, pickerConfig);
  } catch (error) {
    logger.error(`Error fetching market transitions: ${error.message}`);
    await ctx.reply('An error occurred while fetching market transitions. Please try again.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
}

// Final Step: Show Results
async function finalStep(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log('Entering final step: Fetching and displaying signals');
  
  // Extract discovery service from context
  const discoveryService = (ctx as any).discoveryService as DiscoveryService;
  
  if (!discoveryService) {
    logger.error('Discovery service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
  
  // Extract parameters needed
  const { indicatorType, sentiment } = ctx.wizard.state.parameters;
  
  try {
    // Display loading message
    const loadingMessage = await ctx.reply('Loading...');
    
    // Wrap the API call with loading message
    const indicatorDisplay = indicatorType === 'all' ? 'All Indicators' : indicatorType;
    
    // Format the sentiment display nicely for the user
    const sentimentDisplay = sentiment.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    try {
      // Try to delete the loading message
      await ctx.deleteMessage(loadingMessage.message_id);
    } catch (error) {
      logger.warn('Could not delete loading message', error);
    }
    
    // Fetch results from discovery service
    const results = await discoveryService.getLatestSignals({
      indicatorType: indicatorType,
      sentiment: sentiment.replace(/_/g, ' ')
    } as LatestSignalsParams);
    
    if (!results || results.length === 0) {
      await ctx.reply('No signals found. Please try different criteria.');
      await ctx.scene.leave();
      return showDiscoverMenu(ctx);
    }
    
    // Send intro message
    const introText = `
📊 *Latest ${sentimentDisplay} Signals*
Indicator: ${indicatorDisplay}

Found ${results.length} coins with recent signals:
    `;
    await ctx.reply(introText, { parse_mode: 'Markdown' });
    
    // Initialize chart service to send multiple chart responses
    const chartService = new DiscoveryChartService();
    
    // Send charts with results as individual messages
    await chartService.sendMultipleCharts(
      ctx,
      results,
      `This coin shows a ${sentimentDisplay.toLowerCase()} signal on ${indicatorDisplay}.`
    );
    
    // Add a "New Search" button
    await ctx.reply('Would you like to find more signals?', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔍 New Signal Search', 'latest_signals_wizard')],
        [Markup.button.callback('🔙 Back to Discover', 'discover_menu')]
      ]).reply_markup
    });
    
    // End the wizard
    return ctx.scene.leave();
    
  } catch (error) {
    logger.error(`Error fetching signals: ${error.message}`);
    await ctx.reply('An error occurred while fetching signal data. Please try again.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
}

// Create the wizard scene
export const LatestSignalsWizard = new Scenes.WizardScene<CustomContext>(
  'latest-signals-wizard',
  step1
);

// Middleware to restore discovery service
LatestSignalsWizard.use((ctx, next) => {
  // Check if discovery service is available in the context
  const discoveryService = (ctx as any).discoveryService;
  
  if (!discoveryService) {
    logger.warn('Discovery service missing in wizard middleware');
    
    // Try to restore from session
    if ((ctx.session as any).discoveryService) {
      logger.log('Restoring discoveryService from session in wizard middleware');
      (ctx as any).discoveryService = (ctx.session as any).discoveryService;
    }
  }
  
  return next();
});

// Handle indicator type selection
LatestSignalsWizard.action(/^indicator_(.+)$/, async (ctx) => {
  // Extract the selected indicator from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery
    ? (ctx.callbackQuery as any).data
    : '';
  const selectedIndicator = callbackData.replace('indicator_', '');
  
  logger.log(`Selected indicator: ${selectedIndicator}`);
  
  // Store the selection
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    indicatorType: selectedIndicator === 'all' ? 'all' : selectedIndicator.replace(/_/g, ' ')
  };
  
  // Notify the user and proceed to next step
  await ctx.answerCbQuery(`Selected: ${selectedIndicator === 'all' ? 'All Indicators' : selectedIndicator.replace(/_/g, ' ')}`);
  return step2(ctx);
});

// Handle sentiment/direction selection
LatestSignalsWizard.action(/^sentiment_(.+)$/, async (ctx) => {
  // Extract the selected sentiment from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery
    ? (ctx.callbackQuery as any).data
    : '';
  const selectedSentiment = callbackData.replace('sentiment_', '');
  
  logger.log(`Selected sentiment: ${selectedSentiment}`);
  
  // Store the selection
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    sentiment: selectedSentiment
  };
  
  // Convert underscore format to display format for user feedback
  const sentimentDisplay = selectedSentiment.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  // Notify the user and proceed to final step
  await ctx.answerCbQuery(`Selected: ${sentimentDisplay}`);
  return finalStep(ctx);
});

// Handle go back action
LatestSignalsWizard.action('go_back', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  if (wizardState.step && wizardState.step > 1) {
    // Determine which step to go back to
    let previousStep = wizardState.step - 1;
    wizardState.step = previousStep;
    
    logger.log(`Going back to step ${previousStep}`);
    
    switch (previousStep) {
      case 1:
        return step1(ctx);
      case 2:
        return step2(ctx);
      default:
        return step1(ctx);
    }
  } else {
    // If at first step, leave the scene and go back to menu
    await ctx.answerCbQuery('Returning to menu');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
});