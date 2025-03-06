import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../../components/feedback.component';
import { AlertService, AlertType, TimeFrame, Pairing } from '../../../services/alert.service';
import { LoadingMessageComponent, withLoading } from '../../../components/loading-message.component';
import { CoinSearchComponent } from '../../../components/coin-search.component';
import { CoinSearchService } from '../../../services/coin-search.service';
import { createGoBackButton } from '../../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../../menus/sub.menu/alerts.menu';
import { OptionsService, OptionsType } from '../../../services/options.service';

// Create logger
const logger = new Logger('MarketTransitionsWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();
const loadingMessageComponent = new LoadingMessageComponent();
const optionsService = new OptionsService();

/**
 * MarketTransitionsWizard - Guides user through creating a new market transition alert
 */
export const createMarketTransitionsWizard = (
  alertService: AlertService,
  coinSearchService: CoinSearchService
) => {
  const marketTransitionsWizard = new Scenes.WizardScene<CustomContext>(
    'market-transitions-wizard',
    
    // Step 1: Select market transition type
    async (ctx) => {
      logger.log('Step 1: Entering market transitions wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        await showMarketTransitionOptions(ctx);
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in market transitions wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to start Market Transitions wizard. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    },
    
    // Step 2: Select timeframe
    async (ctx) => {
      // This step handles callback actions
      return ctx.wizard.next();
    },
    
    // Step 3: Select pairing
    async (ctx) => {
      // This step handles callback actions
      return ctx.wizard.next();
    },
    
    // Step 4: Confirmation
    async (ctx) => {
      // This step handles callback actions
      return ctx.wizard.next();
    },
    
    // Step 5: Create the alert
    async (ctx) => {
      logger.log('Step 5: Creating the market transition alert');
      
      try {
        const parameters = ctx.wizard.state.parameters;
        
        if (!parameters.transitionType || 
            !parameters.timeframe ||
            !parameters.pairing) {
          await showErrorToast(ctx, 'Missing required alert parameters.');
          await ctx.scene.leave();
          await showAlertsMenu(ctx);
          return;
        }
        
        // Get the telegram ID
        const telegramId = String(ctx.from?.id || '');
        
        // Prepare alert creation DTO
        const createAlertDto: any = {
          userId: telegramId,
          telegramUserId: telegramId,
          alertType: AlertType.MARKET_TRANSITION,
          transitionType: parameters.transitionType,
          timeframe: parameters.timeframe,
          pairing: parameters.pairing,
          isDiscoveryAlert: true // Market transitions are always discovery alerts
        };
        
        // Create the alert with loading indicator
        await withLoading(
          ctx,
          async () => {
            // Create the alert
            const newAlert = await alertService.createAlert(createAlertDto);
            
            // Prepare success message
            const successMessage = `Market Transition Alert created for ${parameters.transitionType}!`;
            
            await showSuccessToast(ctx, successMessage);
            
            // Show detailed success message
            const detailMessage = `🔔 *Market Transition Alert Created*\n\nType: ${parameters.transitionType}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}\nPairing: ${parameters.pairing}`;
              
            await ctx.reply(detailMessage, { parse_mode: 'Markdown' });
          },
          {
            messages: [
              'Creating your market transition alert...',
              'Setting up alert parameters...',
              'Configuring alert settings...',
              'Almost done...'
            ],
            emoji: '🔄'
          }
        );
        
        // Return to alerts menu
        await showAlertsMenu(ctx);
        
        return ctx.scene.leave();
      } catch (error) {
        logger.error(`Error creating market transition alert: ${error.message}`);
        await showErrorToast(ctx, `Failed to create alert: ${error.message}`);
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
        return;
      }
    }
  );
  
  // Handler for market transition type selection
  marketTransitionsWizard.action(/^transition_type_(.+)$/, async (ctx) => {
    try {
      // Extract transition type from callback data
      const match = /^transition_type_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const transitionType = match[1];
        logger.log(`Selected transition type: ${transitionType}`);
        
        // Store selected transition type
        ctx.wizard.state.parameters.transitionType = transitionType;
        
        // Show timeframe options
        await showTimeframeOptions(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling transition type selection: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // Handler for timeframe selection
  marketTransitionsWizard.action(/^timeframe_(.+)$/, async (ctx) => {
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
  marketTransitionsWizard.action(/^pairing_(.+)$/, async (ctx) => {
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
        
        // Show confirmation
        await showAlertConfirmation(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pairing selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting pairing');
    }
  });
  
  // Register confirmation handler
  registerConfirmationHandler(
    marketTransitionsWizard,
    'create_transition_alert_confirm',
    async (ctx) => {
      // Move to the step that handles alert creation
      ctx.wizard.selectStep(4);
      
      const currentIndex = ctx.wizard.cursor;
      // Use the middleware directly
      if (currentIndex < marketTransitionsWizard.middleware().length) {
        return marketTransitionsWizard.middleware()[currentIndex](ctx, async () => {});
      }
      
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
      return;
    }
  );
  
  // Go back button handler
  marketTransitionsWizard.action('go_back', async (ctx) => {
    logger.log('Go back action triggered');
    
    const parameters = ctx.wizard.state.parameters;
    
    // Different back behavior depending on current step
    if (parameters.pairing) {
      // Back from confirmation to pairing selection
      await showPairingOptions(ctx);
    } else if (parameters.timeframe) {
      // Back from pairing selection to timeframe selection
      await showTimeframeOptions(ctx);
    } else if (parameters.transitionType) {
      // Back from timeframe selection to transition type selection
      await showMarketTransitionOptions(ctx);
    } else {
      // Back to main menu
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
    }
    
    await ctx.answerCbQuery();
  });
  
  return marketTransitionsWizard;
};

/**
 * Helper function to show market transition options
 */
async function showMarketTransitionOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing market transition options');
  
  try {
    // Show loading indicator while fetching transition types
    await withLoading(
      ctx,
      async () => {
        // Get market transition types
        const transitionTypes = await optionsService.getOptions(OptionsType.MARKET_TRANSITIONS);
        
        // Build message explaining market transition alerts
        const messageText = `
🔄 *Create Market Transition Alert*

Market transition alerts notify you when the overall market sentiment changes.

Select the type of market transition you want to track:
`;

        // Create buttons for each transition type
        const buttons = transitionTypes.map(type => {
          return [Markup.button.callback(type, `transition_type_${type}`)];
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
          'Loading market transition types...',
          'Fetching transition options...',
          'Getting transition data...'
        ],
        emoji: '🔄'
      }
    );
  } catch (error) {
    logger.error(`Error showing market transition options: ${error.message}`);
    await ctx.reply('Error loading market transition options. Please try again.');
    await ctx.scene.leave();
    await showAlertsMenu(ctx);
  }
}

/**
 * Helper function to show timeframe options
 */
async function showTimeframeOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing timeframe options');
  
  const parameters = ctx.wizard.state.parameters;
  
  // Build the message
  const messageText = `
*Select Timeframe for ${parameters.transitionType}*

Choose the timeframe for tracking this market transition:
`;
    
  // Create buttons for each timeframe
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
  const messageText = `
*Select Pairing for ${parameters.transitionType}*

Timeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}

Choose the trading pair to monitor:
`;
    
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
 * Helper function to show alert confirmation
 */
async function showAlertConfirmation(ctx: CustomContext): Promise<void> {
  logger.log('Showing alert confirmation');
  
  const parameters = ctx.wizard.state.parameters;
  
  // Build the confirmation message
  const messageText = `
🔔 *Confirm Market Transition Alert*

Type: ${parameters.transitionType}
Timeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}
Pairing: ${parameters.pairing}

Are you sure you want to create this alert?
`;
  
  // Show confirmation dialog
  await confirmationComponent.prompt(ctx, {
    message: messageText,
    confirmButtonText: '✅ Create Alert',
    confirmCallbackData: 'create_transition_alert_confirm',
    parse_mode: 'Markdown'
  });
}