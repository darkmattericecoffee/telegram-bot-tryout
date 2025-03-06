// src/telegram/wizards/alerts/show-discovery-alerts.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { AlertService } from '../../services/alert.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../menus/sub.menu/alerts.menu';
import { LoadingMessageComponent, withLoading } from '../../components/loading-message.component';

// Create logger
const logger = new Logger('ShowDiscoveryAlertsWizard');

// Initialize components
const loadingMessageComponent = new LoadingMessageComponent();

/**
 * ShowDiscoveryAlertsWizard - Displays discovery alerts for the user
 */
export const createShowDiscoveryAlertsWizard = (alertService: AlertService) => {
  const showDiscoveryAlertsWizard = new Scenes.WizardScene<CustomContext>(
    'show-discovery-alerts-wizard',
    // Step 1: Show all discovery alerts
    async (ctx) => {
      logger.log('Entering show discovery alerts wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        // Get the telegram ID
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat
        
        // Show loading indicator while fetching data
        await withLoading(
          ctx,
          async () => {
            // Get all discovery alerts
            const alerts = await alertService.getDiscoveryAlerts(telegramId);
            
            // Store alerts in wizard state
            ctx.wizard.state.parameters.discoveryAlerts = alerts;
            
            // Check if we have any alerts
            if (alerts.length === 0) {
              const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('➕ Create Discovery Alert', 'create_discovery_alert')],
                [createGoBackButton()]
              ]);
              
              await ctx.reply('You don\'t have any discovery alerts yet. Discovery alerts help you find new opportunities based on technical indicators and market conditions.', {
                reply_markup: keyboard.reply_markup
              });
              return;
            }
            
            // Get alert limits
            const limits = alertService.getAlertsLimits();
            
            // Prepare the alerts message
            let messageText = '🔎 *Your Discovery Alerts*\n\n';
            messageText += `Alert limit: ${alerts.length}/${limits.discoveryLimit} discovery alerts\n\n`;
            
            // Group alerts by type
            const alertsByType = {};
            
            alerts.forEach(alert => {
              const typeName = AlertService.getAlertTypeName(alert.alertType);
              
              if (!alertsByType[typeName]) {
                alertsByType[typeName] = [];
              }
              
              alertsByType[typeName].push(alert);
            });
            
            // Format alerts by type
            Object.keys(alertsByType).forEach(typeName => {
              messageText += `*${typeName} Alerts:*\n`;
              
              alertsByType[typeName].forEach(alert => {
                const timeframeName = AlertService.getTimeFrameName(alert.timeframe);
                const threshold = alert.threshold;
                
                messageText += `• ${alert.alertType.includes('RSI') ? 'RSI' : alert.alertType.includes('MACD') ? 'MACD' : 'MA'} ${timeframeName}: Threshold ${threshold} (${alert.pairing})\n`;
                if (alert.message) {
                  messageText += `  Message: "${alert.message}"\n`;
                }
              });
              
              messageText += '\n';
            });
            
            // Create buttons for alert management
            const manageButtons = [
              [
                Markup.button.callback('➕ Add Discovery Alert', 'create_discovery_alert'),
                Markup.button.callback('🗑️ Delete Alert', 'delete_alert')
              ],
              [createGoBackButton()]
            ];
            
            const keyboard = Markup.inlineKeyboard(manageButtons);
            
            // Send the formatted message
            await ctx.reply(messageText, {
              reply_markup: keyboard.reply_markup,
              parse_mode: 'Markdown'
            });
          },
          {
            messages: [
              'Loading your discovery alerts...',
              'Fetching alert data...',
              'Getting your discovery alert information...'
            ],
            emoji: '🔎'
          }
        );
        
        ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in show discovery alerts wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to load discovery alerts. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    },
    
    // Step 2: Handle button actions
    async (ctx) => {
      // This step is just for handling actions
      return;
    }
  );
  
  // Handler for create discovery alert
  showDiscoveryAlertsWizard.action('create_discovery_alert', async (ctx) => {
    logger.log('Create discovery alert action triggered');
    await ctx.answerCbQuery();
    
    await ctx.scene.leave();
    await ctx.scene.enter('create-alert-wizard', { isDiscoveryAlert: true });
  });
  
  // Handler for delete alert
  showDiscoveryAlertsWizard.action('delete_alert', async (ctx) => {
    logger.log('Delete alert action triggered');
    await ctx.answerCbQuery();
    
    await ctx.scene.leave();
    await ctx.scene.enter('delete-alert-wizard', { alertType: 'discovery' });
  });
  
  // Go back button handler
  showDiscoveryAlertsWizard.action('go_back', async (ctx) => {
    logger.log('Leaving show discovery alerts wizard');
    await ctx.scene.leave();
    
    // Return to the alerts menu
    await showAlertsMenu(ctx);
  });
  
  return showDiscoveryAlertsWizard;
};