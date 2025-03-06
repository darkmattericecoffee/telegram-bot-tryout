import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../../components/feedback.component';
import { AlertService, AlertType, Pairing, TimeFrame } from '../../../services/alert.service';


import { LoadingMessageComponent, withLoading } from '../../../components/loading-message.component';
import { createGoBackButton } from '../../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../../menus/sub.menu/alerts.menu';
import { OptionsService, OptionsType } from '../../../services/options.service';

// Create logger
const logger = new Logger('LevelBreaksWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();
const loadingMessageComponent = new LoadingMessageComponent();
const optionsService = new OptionsService();

/**
 * LevelBreaksWizard - Guides user through creating a new support/resistance level break alert
 */
export const createLevelBreaksWizard = (
  alertService: AlertService
) => {
  const levelBreaksWizard = new Scenes.WizardScene<CustomContext>(
    'level-breaks-wizard',
    
    // Step 1: Select level break type
    async (ctx) => {
      logger.log('Step 1: Entering level breaks wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        await showLevelBreakOptions(ctx);
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in level breaks wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to start Level Breaks wizard. Please try again.');
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
      logger.log('Step 5: Creating the level break alert');
      
      try {
        const parameters = ctx.wizard.state.parameters;
        
        if (!parameters.breakType || 
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
          alertType: AlertType.LEVEL_BREAK,
          breakType: parameters.breakType,
          timeframe: parameters.timeframe,
          pairing: parameters.pairing,
          isDiscoveryAlert: true // Level breaks are discovery alerts
        };
        
        // Create the alert with loading indicator
        await withLoading(
          ctx,
          async () => {
            // Create the alert
            const newAlert = await alertService.createAlert(createAlertDto);
            
            // Prepare success message
            const successMessage = `Level Break Alert created for ${parameters.breakType}!`;
            
            await showSuccessToast(ctx, successMessage);
            
            // Show detailed success message
            const detailMessage = `🔔 *Level Break Alert Created*\n\nType: ${parameters.breakType}\nTimeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}\nPairing: ${parameters.pairing}`;
              
            await ctx.reply(detailMessage, { parse_mode: 'Markdown' });
          },
          {
            messages: [
              'Creating your level break alert...',
              'Setting up alert parameters...',
              'Configuring alert settings...',
              'Almost done...'
            ],
            emoji: '📊'
          }
        );
        
        // Return to alerts menu
        await showAlertsMenu(ctx);
        
        return ctx.scene.leave();
      } catch (error) {
        logger.error(`Error creating level break alert: ${error.message}`);
        await showErrorToast(ctx, `Failed to create alert: ${error.message}`);
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
        return;
      }
    }
  );
  
  // Handler for level break type selection
  levelBreaksWizard.action(/^break_type_(.+)$/, async (ctx) => {
    try {
      // Extract break type from callback data
      const match = /^break_type_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const breakType = match[1];
        logger.log(`Selected break type: ${breakType}`);
        
        // Store selected break type
        ctx.wizard.state.parameters.breakType = breakType;
        
        // Show timeframe options
        await showTimeframeOptions(ctx);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling break type selection: ${error.message}`);
      await ctx.answerCbQuery('Error processing selection');
    }
  });
  
  // Handler for timeframe selection
  levelBreaksWizard.action(/^timeframe_(.+)$/, async (ctx) => {
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
  levelBreaksWizard.action(/^pairing_(.+)$/, async (ctx) => {
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
    levelBreaksWizard,
    'create_level_break_confirm',
    async (ctx) => {
      // Move to the step that handles alert creation
      ctx.wizard.selectStep(4);
      
      const currentIndex = ctx.wizard.cursor;
      // Use the middleware directly
      if (currentIndex < levelBreaksWizard.middleware().length) {
        return levelBreaksWizard.middleware()[currentIndex](ctx, async () => {});
      }
      
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
      return;
    }
  );
  
  // Go back button handler
  levelBreaksWizard.action('go_back', async (ctx) => {
    logger.log('Go back action triggered');
    
    const parameters = ctx.wizard.state.parameters;
    
    // Different back behavior depending on current step
    if (parameters.pairing) {
      // Back from confirmation to pairing selection
      await showPairingOptions(ctx);
    } else if (parameters.timeframe) {
      // Back from pairing selection to timeframe selection
      await showTimeframeOptions(ctx);
    } else if (parameters.breakType) {
      // Back from timeframe selection to break type selection
      await showLevelBreakOptions(ctx);
    } else {
      // Back to main menu
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
    }
    
    await ctx.answerCbQuery();
  });
  
  return levelBreaksWizard;
};

/**
 * Helper function to show level break options
 */
async function showLevelBreakOptions(ctx: CustomContext): Promise<void> {
  logger.log('Showing level break options');
  
  try {
    // Show loading indicator while fetching level break types
    await withLoading(
      ctx,
      async () => {
        // Get level break types
        const breakTypes = await optionsService.getOptions(OptionsType.LEVEL_BREAKS);
        
        // Build message explaining level break alerts
        const messageText = `
📊 *Create Level Break Alert*

Level break alerts notify you when important support or resistance levels are broken or rejected.

Select the type of level break you want to track:
`;

        // Create buttons for each break type
        const buttons = breakTypes.map(type => {
          return [Markup.button.callback(type, `break_type_${type}`)];
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
          'Loading level break types...',
          'Fetching support/resistance options...',
          'Getting level data...'
        ],
        emoji: '📊'
      }
    );
  } catch (error) {
    logger.error(`Error showing level break options: ${error.message}`);
    await ctx.reply('Error loading level break options. Please try again.');
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
*Select Timeframe for ${parameters.breakType}*

Choose the timeframe for detecting this level break:
`;
    
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
*Select Pairing for ${parameters.breakType}*

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
🔔 *Confirm Level Break Alert*

Type: ${parameters.breakType}
Timeframe: ${AlertService.getTimeFrameName(parameters.timeframe)}
Pairing: ${parameters.pairing}

Are you sure you want to create this alert?
`;
  
  // Show confirmation dialog
  await confirmationComponent.prompt(ctx, {
    message: messageText,
    confirmButtonText: '✅ Create Alert',
    confirmCallbackData: 'create_level_break_confirm',
    parse_mode: 'Markdown'
  });
}