// src/telegram/wizards/alerts/delete-alert.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { AlertService } from '../../services/alert.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../menus/sub.menu/alerts.menu';
import { LoadingMessageComponent, withLoading } from '../../components/loading-message.component';

// Create logger
const logger = new Logger('DeleteAlertWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();
const loadingMessageComponent = new LoadingMessageComponent();

// Define a proper type for scene state
interface DeleteAlertSceneState {
  alertType?: 'watchlist' | 'discovery';
  [key: string]: any;
}

/**
 * DeleteAlertWizard - Allows user to delete an existing alert
 */
export const createDeleteAlertWizard = (alertService: AlertService) => {
  const deleteAlertWizard = new Scenes.WizardScene<CustomContext>(
    'delete-alert-wizard',
    // Step 1: Ask user to select an alert type (if not provided) or show alert list
    async (ctx) => {
      logger.log('Step 1: Entering delete alert wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        // Check if we have a filter from scene state
        const sceneState = ctx.scene.state as DeleteAlertSceneState || {};
        const alertTypeFilter = sceneState?.alertType;
        
        if (alertTypeFilter) {
          logger.log(`Alert type filter provided: ${alertTypeFilter}`);
          ctx.wizard.state.parameters.alertTypeFilter = alertTypeFilter;
          
          // Skip to showing filtered alert list
          return await showAlertList(ctx, alertService, alertTypeFilter);
        }
        
        // No filter provided, ask user to select alert type
        const messageText = '🗑️ *Delete Alert*\n\nWhat type of alert would you like to delete?';
        
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('📋 Watchlist Alerts', 'select_type_watchlist'),
            Markup.button.callback('🔎 Discovery Alerts', 'select_type_discovery')
          ],
          [
            Markup.button.callback('🔔 All Alerts', 'select_type_all')
          ],
          [createGoBackButton()]
        ]);
        
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
        
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in delete alert wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to start Delete Alert wizard. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    },
    
    // Step 2: Handle alert type selection or show alert list
    async (ctx) => {
      // This step is just for handling actions
      return ctx.wizard.next();
    },
    
    // Step 3: Confirm deletion
    async (ctx) => {
      // This step is just a placeholder for our action handlers
      return ctx.wizard.next();
    },
    
    // Step 4: Delete the alert
    async (ctx) => {
      logger.log('Step 4: Deleting alert');
      
      try {
        const { alertId, alertName } = ctx.wizard.state.parameters;
        
        if (!alertId) {
          await showErrorToast(ctx, 'Missing alert information.');
          await ctx.scene.leave();
          await showAlertsMenu(ctx);
          return;
        }
        
        // Delete the alert with loading indicator
        await withLoading(
          ctx,
          async () => {
            // Delete the alert
            const success = await alertService.deleteAlert(alertId);
            
            if (success) {
              await showSuccessToast(ctx, `Alert has been deleted!`);
              
              // Display success message
              await ctx.reply('Alert deleted successfully!');
            } else {
              throw new Error('Failed to delete alert');
            }
          },
          {
            messages: [
              'Deleting alert...',
              'Removing alert from system...',
              'Processing your request...'
            ],
            emoji: '🗑️'
          }
        );
        
        // Return to alerts menu
        await showAlertsMenu(ctx);
        
        return ctx.scene.leave();
      } catch (error) {
        logger.error(`Error deleting alert: ${error.message}`);
        await showErrorToast(ctx, 'Failed to delete alert. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
        return;
      }
    }
  );
  
  // Handler for alert type selection
  deleteAlertWizard.action(/^select_type_(.+)$/, async (ctx) => {
    try {
      // Extract alert type from callback data
      const match = /^select_type_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const alertType = match[1];
        logger.log(`Selected alert type: ${alertType}`);
        
        // Store selected alert type
        ctx.wizard.state.parameters.alertTypeFilter = alertType;
        
        // Show alerts of the selected type
        await showAlertList(ctx, alertService, alertType);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling alert type selection: ${error.message}`);
      await ctx.answerCbQuery('Error loading alerts');
    }
  });
  
  // Handler for alert selection
  deleteAlertWizard.action(/^select_alert_(.+)$/, async (ctx) => {
    try {
      // Extract alert ID from callback data
      const match = /^select_alert_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const alertId = match[1];
        logger.log(`Selected alert ID: ${alertId}`);
        
        // Get alert details
        const alert = await alertService.getAlertById(alertId);
        
        if (!alert) {
          await ctx.answerCbQuery('Alert not found');
          // Show alert list again
          return await showAlertList(ctx, alertService, ctx.wizard.state.parameters.alertTypeFilter);
        }
        
        // Store alert information
        ctx.wizard.state.parameters.alertId = alertId;
        
        // Format alert name for display
        let alertName = '';
        
        if (alert.isDiscoveryAlert) {
          const typeName = AlertService.getAlertTypeName(alert.alertType);
          const timeframe = AlertService.getTimeFrameName(alert.timeframe);
          alertName = `${typeName} (${timeframe})`;
        } else {
          alertName = `${alert.coinName || alert.coinIdentifier} ${AlertService.getAlertTypeName(alert.alertType)}`;
        }
        
        ctx.wizard.state.parameters.alertName = alertName;
        
        // Show confirmation dialog
        const alertDetails = alert.isDiscoveryAlert
          ? `Discovery Alert: ${AlertService.getAlertTypeName(alert.alertType)}, Threshold: ${alert.threshold}, Timeframe: ${AlertService.getTimeFrameName(alert.timeframe)}`
          : `Watchlist Alert: ${alert.coinName || alert.coinIdentifier}, ${AlertService.getAlertTypeName(alert.alertType)}, Threshold: ${alert.threshold}`;
          
        const confirmMessage = `⚠️ *Are you sure you want to delete this alert?*\n\n${alertDetails}\n\nThis action cannot be undone.`;
        
        await confirmationComponent.prompt(ctx, {
          message: confirmMessage,
          confirmButtonText: '🗑️ Delete Alert',
          confirmCallbackData: 'delete_alert_confirm',
          parse_mode: 'Markdown'
        });
        
        ctx.wizard.selectStep(3);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling alert selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting alert');
    }
  });
  
  // Register confirmation handler
  registerConfirmationHandler(
    deleteAlertWizard,
    'delete_alert_confirm',
    async (ctx) => {
      // Move to the step that handles deletion
      ctx.wizard.selectStep(3);
      
      const currentIndex = ctx.wizard.cursor;
      // Use the middleware directly
      if (currentIndex < deleteAlertWizard.middleware().length) {
        return deleteAlertWizard.middleware()[currentIndex](ctx, async () => {});
      }
      
      await ctx.scene.leave();
      await showAlertsMenu(ctx);
      return;
    }
  );
  
  // Go back button handler
  deleteAlertWizard.action('go_back', async (ctx) => {
    logger.log('Leaving delete alert wizard');
    await ctx.scene.leave();
    
    // Return to the alerts menu
    await showAlertsMenu(ctx);
  });
  
  return deleteAlertWizard;
};

/**
 * Helper function to show a list of alerts to delete
 */
async function showAlertList(
  ctx: CustomContext,
  alertService: AlertService,
  alertType: string
): Promise<void> {
  logger.log(`Showing alert list for type: ${alertType}`);
  
  try {
    // Get the telegram ID
    const telegramId = String(ctx.from?.id || '');
    const isGroup = false; // Assume personal chat
    
    // Show loading indicator while fetching alerts
    await withLoading(
      ctx,
      async () => {
        let alerts: any[] = [];
        
        // Get alerts based on the selected type
        if (alertType === 'watchlist') {
          alerts = await alertService.getWatchlistAlerts(telegramId);
        } else if (alertType === 'discovery') {
          alerts = await alertService.getDiscoveryAlerts(telegramId);
        } else {
          // Get all alerts
          const watchlistAlerts = await alertService.getWatchlistAlerts(telegramId);
          const discoveryAlerts = await alertService.getDiscoveryAlerts(telegramId);
          alerts = [...watchlistAlerts, ...discoveryAlerts];
        }
        
        // Check if we have any alerts
        if (alerts.length === 0) {
          const noAlertsText = `No ${alertType === 'all' ? '' : alertType + ' '}alerts found.`;
          
          const keyboard = Markup.inlineKeyboard([
            [createGoBackButton()]
          ]);
          
          await ctx.reply(noAlertsText, {
            reply_markup: keyboard.reply_markup
          });
          return;
        }
        
        // Prepare the message
        let messageText = `🗑️ *Select an alert to delete:*\n\n`;
        
        // Create buttons for each alert
        const buttons = alerts.map(alert => {
          // Format alert label
          let label = '';
          
          if (alert.isDiscoveryAlert) {
            const typeName = AlertService.getAlertTypeName(alert.alertType);
            const timeframe = AlertService.getTimeFrameName(alert.timeframe);
            label = `🔎 ${typeName} (${timeframe})`;
          } else {
            const typeName = AlertService.getAlertTypeName(alert.alertType);
            label = `📋 ${alert.coinName || alert.coinIdentifier} - ${typeName}`;
            
            if (alert.watchlistName) {
              label += ` (${alert.watchlistName})`;
            }
          }
          
          // Truncate label if too long
          if (label.length > 40) {
            label = label.substring(0, 37) + '...';
          }
          
          return [Markup.button.callback(
            label,
            `select_alert_${alert.id}`
          )];
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
          'Loading alerts...',
          'Fetching alert data...',
          'Getting your alert information...'
        ],
        emoji: '🔔'
      }
    );
  } catch (error) {
    logger.error(`Error showing alert list: ${error.message}`);
    await showErrorToast(ctx, 'Failed to load alerts. Please try again.');
    throw error;
  }
}