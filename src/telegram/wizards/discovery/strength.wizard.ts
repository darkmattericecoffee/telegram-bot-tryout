// src/telegram/wizards/discovery/strength.wizard.ts
import { Scenes, Markup } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext, WizardState } from '../../interfaces/custom-context.interface';
import { DiscoveryService, StrengthParams } from '../../services/discovery.service';
import { PairTimePickerComponent, PickerState, PairTimePickerComponentCallbackHandler } from '../../components/pair-time-picker.component';
import { DiscoveryChartService } from '../../services/discovery-chart.service';
import { withLoading } from '../../components/loading-message.component';
import { pickerComponent } from '../../components/picker.component/picker.component';
import { showDiscoverMenu } from '../../menus/submenus/discover.menu';

// Initialize logger
const logger = new Logger('StrengthWizard');

// Initialize components
const combinedPicker = new PairTimePickerComponent();
const combinedPickerHandler = new PairTimePickerComponentCallbackHandler();

// Step 1: Select Strength Type (Strongest or Weakest)
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Entering step 1: Strength type selection');

  // Ensure discovery service is available
  const discoveryService = (ctx as any).discoveryService as DiscoveryService;
  
  if (!discoveryService) {
    logger.error('Discovery service not properly injected into context');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }

  // Provide options for strongest/weakest selection
  const pickerConfig = {
    text: '📊 *Strength Analysis*\n\nWould you like to see the strongest or weakest performers?',
    options: [
      { label: '🔼 Strongest Performers', action: 'strength_type_strongest' },
      { label: '🔽 Weakest Performers', action: 'strength_type_weakest' },
    ],
  };

  await pickerComponent(ctx, pickerConfig);
}

// Step 2: Select Pair and Timeframe
async function step2(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Entering step 2: Pair/timeframe selection');
  
  // Set or initialize the picker state
  if (!ctx.wizard.state.parameters.pickerState) {
    ctx.wizard.state.parameters.pickerState = {
      selectedPairing: 'USD',
      selectedTimeframe: '1D'
    };
  }
  
  // Show the combined picker with current selection
  const messageText = '⏱️ *Select Currency Pair and Timeframe*\n\nChoose the trading pair and time interval for your analysis:';
  const keyboard = combinedPicker.render('strengthpicker', ctx.wizard.state.parameters.pickerState);
  
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

// Final Step: Show Results
async function finalStep(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log('Entering final step: Fetching and displaying results');
  
  // Extract discovery service from context
  const discoveryService = (ctx as any).discoveryService as DiscoveryService;
  
  if (!discoveryService) {
    logger.error('Discovery service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
  
  // Extract parameters needed
  const { strengthType, pickerState } = ctx.wizard.state.parameters;
  
  // Set default values if missing
  const pairing = pickerState?.selectedPairing || 'USD';
  const timeframe = pickerState?.selectedTimeframe || '1D';
  
  try {
    // Wrap the API call with loading message
    const results = await withLoading(
      ctx,
      () => discoveryService.getStrength({
        type: strengthType,
        pairing,
        timeframe
      } as StrengthParams),
      { messages: [`🔍 Fetching ${strengthType} coins for ${pairing}/${timeframe}...`] }
    );
    
    if (!results || results.length === 0) {
      await ctx.reply('No results found. Please try different criteria.');
      await ctx.scene.leave();
      return showDiscoverMenu(ctx);
    }
    
    // Send intro message
    const introText = `
📈 *${strengthType === 'strongest' ? 'Strongest' : 'Weakest'} Performers*
Pair: ${pairing} | Timeframe: ${timeframe}

Showing top ${results.length} results:
    `;
    await ctx.reply(introText, { parse_mode: 'Markdown' });
    
    // Initialize chart service to send multiple chart responses
    const chartService = new DiscoveryChartService();
    
    // Send charts with results
    await chartService.sendMultipleCharts(
      ctx,
      results,
      `This coin is among the ${strengthType} performers for ${timeframe} timeframe.`
    );
    
    // Add a "New Search" button
    await ctx.reply('Would you like to perform another search?', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔍 New Search', 'strength_wizard')],
        [Markup.button.callback('🔙 Back to Discover', 'discover_menu')]
      ]).reply_markup
    });
    
    // End the wizard
    return ctx.scene.leave();
    
  } catch (error) {
    logger.error(`Error fetching strength data: ${error.message}`);
    await ctx.reply('An error occurred while fetching market data. Please try again.');
    await ctx.scene.leave();
    return showDiscoverMenu(ctx);
  }
}

// Create the wizard scene
export const StrengthWizard = new Scenes.WizardScene<CustomContext>(
  'strength-wizard',
  step1
);

// Middleware to restore discovery service
StrengthWizard.use((ctx, next) => {
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

// Handle strength type selection
StrengthWizard.action('strength_type_strongest', async (ctx) => {
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    strengthType: 'strongest'
  };
  await ctx.answerCbQuery('Selected: Strongest Performers');
  return step2(ctx);
});

StrengthWizard.action('strength_type_weakest', async (ctx) => {
  ctx.wizard.state.parameters = { 
    ...ctx.wizard.state.parameters, 
    strengthType: 'weakest'
  };
  await ctx.answerCbQuery('Selected: Weakest Performers');
  return step2(ctx);
});

// Handle pair-time picker callbacks
StrengthWizard.action(/^strengthpicker_.+$/, async (ctx) => {
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
    data.replace('strengthpicker', 'cmbpicker'), // Convert to standard format for handler
    currentState
  );
  
  // Update the state in the wizard
  ctx.wizard.state.parameters.pickerState = result.state;
  
  // If the user clicked "Choose", proceed to the next step
  if (result.proceed) {
    return finalStep(ctx);
  }
  
  // Otherwise, just redraw the same step with the updated selection
  return step2(ctx);
});

// Handle go back action
StrengthWizard.action('go_back', async (ctx) => {
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