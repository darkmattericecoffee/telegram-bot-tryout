// src/telegram/wizards/alerts/show-alerts.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext, WizardState } from 'src/telegram/interfaces/custom-context.interface';
import { Markup } from 'telegraf';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { AlertService, AlertConfig, AlertType } from 'src/telegram/services/alert.service';
import { PaginationComponent } from 'src/telegram/components/pagination.component';
import { showAlertsMenu } from 'src/telegram/menus/sub.menu/alerts.menu';

// Create logger for wizard
const logger = new Logger('ShowAllAlertsWizard');

// Initialize pagination component
const paginationComponent = new PaginationComponent();

// Step 1: Show list of alerts
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Entering step 1: Show alerts list');

  // Extract alert service from context
  const alertService = (ctx as any).alertService as AlertService;
  
  if (!alertService) {
    logger.error('Alert service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  try {
    // Get user's alerts
    const userId = ctx.from?.id.toString() || 'unknown';
    logger.log(`Getting alerts for user: ${userId}`);
    const alerts = await alertService.getAlerts(userId);
    
    if (!alerts || alerts.length === 0) {
      // No alerts found
      const messageText = `
🔔 *My Alerts*

You don't have any alerts set up yet. 

To create a new alert, return to the Alerts Menu and select "New Alert".
      `;
      
      const keyboard = Markup.inlineKeyboard([
        [createGoBackButton()]
      ]);
      
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
      
      return;
    }
    
    // Store alerts in wizard state
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      alerts,
      currentPage: 1
    };
    
    // Show alerts with pagination
    await showAlertsPage(ctx);
    
  } catch (error) {
    logger.error(`Error fetching alerts: ${error.message}`);
    await ctx.reply('An error occurred while fetching your alerts. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
}

/**
 * Helper function to show a page of alerts
 */
async function showAlertsPage(ctx: CustomContext) {
  const { alerts, currentPage } = ctx.wizard.state.parameters;
  const itemsPerPage = 5;
  
  // Calculate total pages
  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  
  // Get alerts for current page
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageAlerts = alerts.slice(startIdx, startIdx + itemsPerPage);
  
  // Create message for alerts on this page
  let messageText = `🔔 *My Alerts* (${alerts.length} total)\n\n`;
  
  pageAlerts.forEach((alert: AlertConfig, idx: number) => {
    const typeEmoji = alert.type === AlertType.WATCHLIST ? '📋' : '💰';
    const statusEmoji = alert.active ? '✅' : '❌';
    
    messageText += `${idx + 1 + startIdx}. ${typeEmoji} *${alert.name}*\n`;
    messageText += `   Target: ${alert.targetName}\n`;
    messageText += `   Timeframe: ${alert.pairing}/${alert.timeframe}\n`;
    messageText += `   Status: ${statusEmoji} ${alert.active ? 'Active' : 'Inactive'}\n\n`;
  });
  
  // Create buttons for each alert on this page
  const alertButtons = pageAlerts.map((alert: AlertConfig, idx: number) => [
    Markup.button.callback(
      `${idx + 1 + startIdx}. ${alert.name}`, 
      `view_alert_${alert.id}`
    )
  ]);
  
  // Add pagination navigation
  const paginationRow = paginationComponent.render(
    'alert_page',
    currentPage,
    totalPages
  );
  
  // Add back button
  const buttons = [
    ...alertButtons,
    paginationRow,
    [createGoBackButton()]
  ];
  
  const keyboard = Markup.inlineKeyboard(buttons);
  
  // Send or edit message
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

/**
 * Step 2: Show alert details
 */
async function showAlertDetails(ctx: CustomContext, alertId: string) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log(`Showing details for alert: ${alertId}`);
  
  // Extract alert service from context
  const alertService = (ctx as any).alertService as AlertService;
  
  if (!alertService) {
    logger.error('Alert service not properly injected');
    await ctx.reply('An error occurred. Please try again later.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  try {
    // Get user's alerts
    const userId = ctx.from?.id.toString() || 'unknown';
    const alerts = await alertService.getAlerts(userId);
    
    // Find the selected alert
    const alert = alerts.find(a => a.id === alertId);
    
    if (!alert) {
      await ctx.reply('Alert not found. It may have been deleted.');
      return step1(ctx);
    }
    
    // Store the selected alert
    ctx.wizard.state.parameters.selectedAlert = alert;
    
    // Format alert details
    const typeEmoji = alert.type === AlertType.WATCHLIST ? '📋' : '💰';
    const statusEmoji = alert.active ? '✅' : '❌';
    
    let alertDetails = `
🔔 *Alert Details*

*${alert.name}*
${typeEmoji} Type: ${alert.type === AlertType.WATCHLIST ? 'Watchlist' : 'Specific Coin'}
🎯 Target: ${alert.targetName}
💱 Pair: ${alert.pairing}
⏱️ Timeframe: ${alert.timeframe}
🔄 Status: ${statusEmoji} ${alert.active ? 'Active' : 'Inactive'}
📅 Created: ${alert.createdAt.toLocaleString()}
    `;
    
    // Add notification type specific details
    if (alert.indicators && alert.indicators.length > 0) {
      alertDetails += `\n📊 *Indicators:* ${alert.indicators.join(', ')}`;
    } else {
      alertDetails += `\n🌟 *Notification:* Horizon Score Flip`;
    }
    
    // Create action buttons
    const buttons = [
      [
        Markup.button.callback(
          alert.active ? '❌ Disable Alert' : '✅ Enable Alert',
          `toggle_alert_${alert.id}`
        ),
        Markup.button.callback(
          '🗑️ Delete Alert',
          `confirm_delete_alert_${alert.id}`
        )
      ],
      [
        Markup.button.callback('← Back to Alerts', 'back_to_alerts_list')
      ]
    ];
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    // Send or edit message
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(alertDetails, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        await ctx.reply(alertDetails, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      }
    } else {
      await ctx.reply(alertDetails, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
    
  } catch (error) {
    logger.error(`Error fetching alert details: ${error.message}`);
    await ctx.reply('An error occurred while fetching alert details. Please try again.');
    return step1(ctx);
  }
}

/**
 * Step 3: Confirm alert deletion
 */
async function confirmDeleteAlert(ctx: CustomContext, alertId: string) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log(`Confirming deletion for alert: ${alertId}`);
  
  const alert = ctx.wizard.state.parameters.selectedAlert;
  
  if (!alert) {
    await ctx.reply('Alert not found. It may have been deleted.');
    return step1(ctx);
  }
  
  const confirmationMessage = `
⚠️ *Confirm Deletion*

Are you sure you want to delete the alert:
*${alert.name}*?

This action cannot be undone.
  `;
  
  const buttons = [
    [
      Markup.button.callback('🗑️ Yes, Delete', `delete_alert_${alertId}`),
      Markup.button.callback('❌ No, Cancel', `view_alert_${alertId}`)
    ]
  ];
  
  const keyboard = Markup.inlineKeyboard(buttons);
  
  // Send or edit message
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(confirmationMessage, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      await ctx.reply(confirmationMessage, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
  } else {
    await ctx.reply(confirmationMessage, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'Markdown'
    });
  }
}

// Create the wizard scene
export const showAllAlertsWizard = new Scenes.WizardScene<CustomContext>(
  'show-all-alerts-wizard',
  step1
);

// Handle pagination
showAllAlertsWizard.action(/^alert_page_prev_\d+$/, async (ctx) => {
  logger.log('Previous page action triggered');
  
  // Get current page
  const currentPage = ctx.wizard.state.parameters.currentPage || 1;
  
  // Update page number (ensure it doesn't go below 1)
  ctx.wizard.state.parameters.currentPage = Math.max(1, currentPage - 1);
  
  // Show updated page
  await showAlertsPage(ctx);
  await ctx.answerCbQuery();
});

showAllAlertsWizard.action(/^alert_page_next_\d+$/, async (ctx) => {
  logger.log('Next page action triggered');
  
  // Get current page and total alerts
  const currentPage = ctx.wizard.state.parameters.currentPage || 1;
  const alerts = ctx.wizard.state.parameters.alerts || [];
  const itemsPerPage = 5;
  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  
  // Update page number (ensure it doesn't exceed total pages)
  ctx.wizard.state.parameters.currentPage = Math.min(totalPages, currentPage + 1);
  
  // Show updated page
  await showAlertsPage(ctx);
  await ctx.answerCbQuery();
});

// View specific alert
showAllAlertsWizard.action(/^view_alert_(\w+)$/, async (ctx) => {
  // Extract alert ID from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.split('_').pop();
  logger.log(`View alert action triggered for alert: ${alertId}`);
  
  await ctx.answerCbQuery();
  return showAlertDetails(ctx, alertId);
});

// Toggle alert status
showAllAlertsWizard.action(/^toggle_alert_(\w+)$/, async (ctx) => {
  // Extract alert ID from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.split('_').pop();
  logger.log(`Toggle alert status triggered for alert: ${alertId}`);
  
  // Extract alert service from context
  const alertService = (ctx as any).alertService as AlertService;
  
  if (!alertService) {
    logger.error('Alert service not properly injected');
    await ctx.answerCbQuery('Service error. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  try {
    // Toggle the alert status
    const updatedAlert = await alertService.toggleAlertStatus(alertId);
    
    if (!updatedAlert) {
      await ctx.answerCbQuery('Error: Alert not found');
      return step1(ctx);
    }
    
    // Update the selected alert in wizard state
    ctx.wizard.state.parameters.selectedAlert = updatedAlert;
    
    await ctx.answerCbQuery(`Alert ${updatedAlert.active ? 'enabled' : 'disabled'}`);
    
    // Show updated alert details
    return showAlertDetails(ctx, alertId);
    
  } catch (error) {
    logger.error(`Error toggling alert status: ${error.message}`);
    await ctx.answerCbQuery('Error updating alert');
    return showAlertDetails(ctx, alertId);
  }
});

// Confirm delete alert
showAllAlertsWizard.action(/^confirm_delete_alert_(\w+)$/, async (ctx) => {
  // Extract alert ID from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.split('_').pop();
  logger.log(`Confirm delete alert triggered for alert: ${alertId}`);
  
  await ctx.answerCbQuery();
  return confirmDeleteAlert(ctx, alertId);
});

// Delete alert
showAllAlertsWizard.action(/^delete_alert_(\w+)$/, async (ctx) => {
  // Extract alert ID from callback data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.split('_').pop();
  logger.log(`Delete alert triggered for alert: ${alertId}`);
  
  // Extract alert service from context
  const alertService = (ctx as any).alertService as AlertService;
  
  if (!alertService) {
    logger.error('Alert service not properly injected');
    await ctx.answerCbQuery('Service error. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
  
  try {
    // Delete the alert
    const success = await alertService.deleteAlert(alertId);
    
    if (!success) {
      await ctx.answerCbQuery('Error: Alert not found');
      return step1(ctx);
    }
    
    await ctx.answerCbQuery('Alert deleted successfully');
    
    // Refresh alerts list and show step 1
    const userId = ctx.from?.id.toString() || 'unknown';
    const alerts = await alertService.getAlerts(userId);
    
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      alerts,
      currentPage: 1,
      selectedAlert: null
    };
    
    return step1(ctx);
    
  } catch (error) {
    logger.error(`Error deleting alert: ${error.message}`);
    await ctx.answerCbQuery('Error deleting alert');
    return showAlertDetails(ctx, alertId);
  }
});

// Back to alerts list
showAllAlertsWizard.action('back_to_alerts_list', async (ctx) => {
  logger.log('Back to alerts list action triggered');
  await ctx.answerCbQuery();
  return step1(ctx);
});

// Go back to menu
showAllAlertsWizard.action('go_back', async (ctx) => {
  logger.log('Go back to menu action triggered');
  await ctx.answerCbQuery('Returning to menu');
  await ctx.scene.leave();
  return showAlertsMenu(ctx);
});