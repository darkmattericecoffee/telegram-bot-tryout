// src/telegram/wizards/alerts/show-alerts.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext, WizardState } from 'src/telegram/interfaces/custom-context.interface';
import { Markup } from 'telegraf';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { AlertService, AlertConfig, AlertType, AlertNotificationType } from 'src/telegram/services/alert.service';
import { PaginationComponent } from 'src/telegram/components/pagination.component';
import { showAlertsMenu } from 'src/telegram/menus/submenus/alerts.menu';

// Create logger for wizard
const logger = new Logger('ShowAllAlertsWizard');

// Initialize pagination component
const paginationComponent = new PaginationComponent();

// Create a singleton AlertService instance for testing
// In production, this would be injected via NestJS DI
const alertServiceInstance = new AlertService();

// Step 1: Show alert categories
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;
  logger.log('Entering step 1: Show alert categories');

  // Extract alert service from context or use singleton
  const alertService = (ctx as any).alertService || alertServiceInstance;
  
  try {
    // Always use mock user ID for testing
    const userId = "12345";
    logger.log(`Getting alerts for user: ${userId}`);
    
    // Get alerts and summary
    const alerts = await alertService.getAlerts(userId);
    const summary = await alertService.getAlertsSummary(userId);
    
    // Store all alerts in wizard state
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      alerts,
      summary
    };
    
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
    
    // Show alert categories
    const messageText = `
🔔 *Alerts Menu*

*🗂️ Overview*
• Total Active Alerts: ${summary.totalAlerts}
• Coin-Specific Alerts: ${summary.discoveryAlerts}
• Watchlist Alerts: ${summary.watchlistAlerts}

*⬇️ Alert Limits:*
• Coin-Specific Alerts: ${summary.remaining.discovery}/${alertService.getAlertsLimits().discoveryLimit} remaining
• Watchlist Alerts: ${summary.remaining.watchlist}/${alertService.getAlertsLimits().watchlistLimit} remaining

Please select a category to view:
    `;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🪙 Coin Alerts', 'show_coin_alerts')
      ],
      [
        Markup.button.callback('📋 Watchlist Alerts', 'show_watchlist_alerts')
      ],
      [
        Markup.button.callback('📊 Horizon Level Breaks', 'show_horizon_breaks')
      ],
      [createGoBackButton()]
    ]);
    
    await ctx.reply(messageText, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    logger.error(`Error fetching alerts: ${error.message}`);
    await ctx.reply('An error occurred while fetching your alerts. Please try again.');
    await ctx.scene.leave();
    return showAlertsMenu(ctx);
  }
}

/**
 * Step 2A: Show coin-specific alerts
 */
async function showCoinAlerts(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Showing coin-specific alerts');
  
  const alerts = ctx.wizard.state.parameters.alerts || [];
  
  // Filter for coin alerts (discovery type)
  const coinAlerts = alerts.filter(alert => alert.type === AlertType.DISCOVERY);
  
  if (coinAlerts.length === 0) {
    await ctx.reply('You don\'t have any coin-specific alerts set up.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('← Back', 'back_to_main')]
      ]).reply_markup
    });
    return;
  }
  
  // Group by target coins
  const coinGroups = {};
  
  coinAlerts.forEach(alert => {
    if (!coinGroups[alert.targetId]) {
      coinGroups[alert.targetId] = {
        name: alert.targetName,
        alerts: []
      };
    }
    
    coinGroups[alert.targetId].alerts.push(alert);
  });
  
  // Store coin groups in state
  ctx.wizard.state.parameters.coinGroups = coinGroups;
  
  // Create message
  let messageText = `🪙 *Coin-Specific Alerts*\n\n`;
  messageText += `You have alerts for ${Object.keys(coinGroups).length} coins:\n\n`;
  
  // Create buttons for each coin
  const coinButtons = Object.entries(coinGroups).map(([coinId, group]: [string, any]) => {
    const coinName = group.name;
    const alertCount = group.alerts.length;
    return [
      Markup.button.callback(
        `${coinName} (${alertCount} alerts)`, 
        `view_coin_${coinId}`
      )
    ];
  });
  
  // Add back button
  const buttons = [
    ...coinButtons,
    [Markup.button.callback('← Back', 'back_to_main')]
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
  
  await ctx.answerCbQuery();
}

/**
 * Step 2B: Show watchlist alerts
 */
async function showWatchlistAlerts(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Showing watchlist alerts');
  
  const alerts = ctx.wizard.state.parameters.alerts || [];
  
  // Filter for watchlist alerts
  const watchlistAlerts = alerts.filter(alert => alert.type === AlertType.WATCHLIST);
  
  if (watchlistAlerts.length === 0) {
    await ctx.reply('You don\'t have any watchlist alerts set up.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('← Back', 'back_to_main')]
      ]).reply_markup
    });
    return;
  }
  
  // Group by watchlist
  const watchlistGroups = {};
  
  watchlistAlerts.forEach(alert => {
    if (!watchlistGroups[alert.targetId]) {
      watchlistGroups[alert.targetId] = {
        name: alert.targetName,
        alerts: []
      };
    }
    
    watchlistGroups[alert.targetId].alerts.push(alert);
  });
  
  // Store watchlist groups in state
  ctx.wizard.state.parameters.watchlistGroups = watchlistGroups;
  
  // Create message
  let messageText = `📋 *Watchlist Alerts*\n\n`;
  messageText += `You have alerts for ${Object.keys(watchlistGroups).length} watchlists:\n\n`;
  
  // Create buttons for each watchlist
  const watchlistButtons = Object.entries(watchlistGroups).map(([watchlistId, group]: [string, any]) => {
    const watchlistName = group.name;
    const alertCount = group.alerts.length;
    return [
      Markup.button.callback(
        `${watchlistName} (${alertCount} alerts)`, 
        `view_watchlist_${watchlistId}`
      )
    ];
  });
  
  // Add back button
  const buttons = [
    ...watchlistButtons,
    [Markup.button.callback('← Back', 'back_to_main')]
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
  
  await ctx.answerCbQuery();
}

/**
 * Step 2C: Show horizon level breaks
 */
async function showHorizonBreaks(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  logger.log('Showing horizon level breaks');
  
  const alerts = ctx.wizard.state.parameters.alerts || [];
  
  // Filter for horizon score alerts
  const horizonAlerts = alerts.filter(alert => 
    alert.notificationType === AlertNotificationType.HORIZON_SCORE
  );
  
  if (horizonAlerts.length === 0) {
    await ctx.reply('You don\'t have any horizon level break alerts set up.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('← Back', 'back_to_main')]
      ]).reply_markup
    });
    return;
  }
  
  // Create message
  let messageText = `📊 *Horizon Level Break Alerts*\n\n`;
  messageText += `You have ${horizonAlerts.length} horizon score alerts:\n\n`;
  
  // Create buttons for each horizon alert
  const alertButtons = horizonAlerts.map(alert => {
    const typeEmoji = alert.type === AlertType.WATCHLIST ? '📋' : '🪙';
    return [
      Markup.button.callback(
        `${typeEmoji} ${alert.targetName} - ${alert.pairing}/${alert.timeframe}`, 
        `view_alert_${alert.id}`
      )
    ];
  });
  
  // Add back button
  const buttons = [
    ...alertButtons,
    [Markup.button.callback('← Back', 'back_to_main')]
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
  
  await ctx.answerCbQuery();
}

/**
 * Step 3A: Show alerts for specific coin
 */
async function showCoinDetails(ctx: CustomContext, coinId: string) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log(`Showing alerts for coin: ${coinId}`);
  
  const coinGroups = ctx.wizard.state.parameters.coinGroups || {};
  const coinGroup = coinGroups[coinId];
  
  if (!coinGroup) {
    await ctx.reply('Coin not found. It may have been deleted.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('← Back', 'show_coin_alerts')]
      ]).reply_markup
    });
    return;
  }
  
  // Create message
  let messageText = `🪙 *${coinGroup.name} Alerts*\n\n`;
  
  // Group alerts by notification type
  const horizonAlerts = coinGroup.alerts.filter(a => 
    a.notificationType === AlertNotificationType.HORIZON_SCORE
  );
  
  const indicatorAlerts = coinGroup.alerts.filter(a => 
    a.notificationType === AlertNotificationType.INDIVIDUAL_INDICATORS
  );
  
  // Create alert buttons
  const alertButtons: any[] = [];
  
  // Add horizon alerts
  horizonAlerts.forEach(alert => {
    alertButtons.push([
      Markup.button.callback(
        `📊 Horizon Score - ${alert.pairing}/${alert.timeframe}`, 
        `view_alert_${alert.id}`
      )
    ]);
  });
  
  // Add indicator alerts - expand to individual indicators
  indicatorAlerts.forEach(alert => {
    if (alert.indicators && alert.indicators.length > 0) {
      // Create a button for each individual indicator
      alert.indicators.forEach(indicator => {
        alertButtons.push([
          Markup.button.callback(
            `${indicator} - ${alert.pairing}/${alert.timeframe}`, 
            `view_indicator_${alert.id}_${encodeURIComponent(indicator)}`
          )
        ]);
      });
    }
  });
  
  // Add back button
  const buttons = [
    ...alertButtons,
    [Markup.button.callback('← Back', 'show_coin_alerts')]
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
  
  await ctx.answerCbQuery();
}

/**
 * Step 3B: Show alerts for specific watchlist
 */
async function showWatchlistDetails(ctx: CustomContext, watchlistId: string) {
  (ctx.wizard.state as WizardState).step = 3;
  logger.log(`Showing alerts for watchlist: ${watchlistId}`);
  
  const watchlistGroups = ctx.wizard.state.parameters.watchlistGroups || {};
  const watchlistGroup = watchlistGroups[watchlistId];
  
  if (!watchlistGroup) {
    await ctx.reply('Watchlist not found. It may have been deleted.', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('← Back', 'show_watchlist_alerts')]
      ]).reply_markup
    });
    return;
  }
  
  // Create message
  let messageText = `📋 *${watchlistGroup.name} Alerts*\n\n`;
  
  // Group alerts by notification type
  const horizonAlerts = watchlistGroup.alerts.filter(a => 
    a.notificationType === AlertNotificationType.HORIZON_SCORE
  );
  
  const indicatorAlerts = watchlistGroup.alerts.filter(a => 
    a.notificationType === AlertNotificationType.INDIVIDUAL_INDICATORS
  );
  
  // Create alert buttons
  const alertButtons: any[] = [];
  
  // Add horizon alerts
  horizonAlerts.forEach(alert => {
    alertButtons.push([
      Markup.button.callback(
        `📊 Horizon Score - ${alert.pairing}/${alert.timeframe}`, 
        `view_alert_${alert.id}`
      )
    ]);
  });
  
  // Add indicator alerts - expand to individual indicators
  indicatorAlerts.forEach(alert => {
    if (alert.indicators && alert.indicators.length > 0) {
      // Create a button for each individual indicator
      alert.indicators.forEach(indicator => {
        alertButtons.push([
          Markup.button.callback(
            `${indicator} - ${alert.pairing}/${alert.timeframe}`, 
            `view_indicator_${alert.id}_${encodeURIComponent(indicator)}`
          )
        ]);
      });
    }
  });
  
  // Add back button
  const buttons = [
    ...alertButtons,
    [Markup.button.callback('← Back', 'show_watchlist_alerts')]
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
  
  await ctx.answerCbQuery();
}

/**
 * Step 4: Show alert details and delete option
 */
async function showAlertDetails(ctx: CustomContext, alertId: string) {
  (ctx.wizard.state as WizardState).step = 4;
  logger.log(`Showing details for alert: ${alertId}`);
  
  // Extract alert service from context or use singleton
  const alertService = (ctx as any).alertService || alertServiceInstance;
  
  try {
    // Always use mock user ID for testing
    const userId = "12345";
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
    const typeEmoji = alert.type === AlertType.WATCHLIST ? '📋' : '🪙';
    const notificationTypeEmoji = alert.notificationType === AlertNotificationType.HORIZON_SCORE ? '📊' : '📈';
    
    let alertDetails = `
${typeEmoji} ${notificationTypeEmoji} *Alert Details*

*${alert.name}*
${typeEmoji} *Target:* ${alert.targetName}
💱 *Pair:* ${alert.pairing}
⏱️ *Timeframe:* ${alert.timeframe}
📅 *Created:* ${alert.createdAt.toLocaleString()}
    `;
    
    // Add notification type specific details
    if (alert.indicators && alert.indicators.length > 0) {
      alertDetails += `\n📊 *Indicators:* ${alert.indicators.join(', ')}`;
    } else {
      alertDetails += `\n🌟 *Notification:* Horizon Score Flip`;
    }
    
    // Create action buttons
    const backAction = alert.type === AlertType.WATCHLIST 
      ? `view_watchlist_${alert.targetId}`
      : `view_coin_${alert.targetId}`;
    
    const buttons = [
      [
        Markup.button.callback(
          '🗑️ Delete Alert',
          `confirm_delete_alert_${alert.id}`
        )
      ],
      [
        Markup.button.callback('← Back', backAction)
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
    
    await ctx.answerCbQuery();
    
  } catch (error) {
    logger.error(`Error fetching alert details: ${error.message}`);
    await ctx.reply('An error occurred while fetching alert details. Please try again.');
    return step1(ctx);
  }
}

/**
 * Step 4B: Show individual indicator alert details
 */
async function showIndicatorAlertDetails(ctx: CustomContext, alertId: string, indicator: string) {
  (ctx.wizard.state as WizardState).step = 4;
  logger.log(`Showing details for indicator: ${indicator} in alert: ${alertId}`);
  
  // Extract alert service from context or use singleton
  const alertService = (ctx as any).alertService || alertServiceInstance;
  
  try {
    // Always use mock user ID for testing
    const userId = "12345";
    const alerts = await alertService.getAlerts(userId);
    
    // Find the selected alert
    const alert = alerts.find(a => a.id === alertId);
    
    if (!alert || !alert.indicators || !alert.indicators.includes(indicator)) {
      await ctx.reply('Alert or indicator not found. It may have been deleted.');
      return step1(ctx);
    }
    
    // Store the selected alert and indicator
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      selectedAlert: alert,
      selectedIndicator: indicator
    };
    
    // Format alert details
    const typeEmoji = alert.type === AlertType.WATCHLIST ? '📋' : '🪙';
    
    let alertDetails = `
${typeEmoji} *${indicator} Alert Details*

*${alert.name} - ${indicator}*
${typeEmoji} *Target:* ${alert.targetName}
💱 *Pair:* ${alert.pairing}
⏱️ *Timeframe:* ${alert.timeframe}
📅 *Created:* ${alert.createdAt.toLocaleString()}
    `;
    
    // Create action buttons
    const backAction = alert.type === AlertType.WATCHLIST 
      ? `view_watchlist_${alert.targetId}`
      : `view_coin_${alert.targetId}`;
    
    const buttons = [
      [
        Markup.button.callback(
          '🗑️ Remove This Indicator',
          `confirm_delete_indicator_${alert.id}_${encodeURIComponent(indicator)}`
        )
      ],
      [
        Markup.button.callback('← Back', backAction)
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
    
    await ctx.answerCbQuery();
    
  } catch (error) {
    logger.error(`Error fetching indicator details: ${error.message}`);
    await ctx.reply('An error occurred while fetching indicator details. Please try again.');
    return step1(ctx);
  }
}

/**
 * Step 5A: Confirm alert deletion
 */
async function confirmDeleteAlert(ctx: CustomContext, alertId: string) {
  (ctx.wizard.state as WizardState).step = 5;
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
  
  await ctx.answerCbQuery();
}

/**
 * Step 5B: Confirm indicator deletion
 */
async function confirmDeleteIndicator(ctx: CustomContext, alertId: string, indicator: string) {
  (ctx.wizard.state as WizardState).step = 5;
  logger.log(`Confirming deletion for indicator: ${indicator} in alert: ${alertId}`);
  
  const alert = ctx.wizard.state.parameters.selectedAlert;
  
  if (!alert) {
    await ctx.reply('Alert not found. It may have been deleted.');
    return step1(ctx);
  }
  
  const confirmationMessage = `
⚠️ *Confirm Indicator Removal*

Are you sure you want to remove the indicator:
*${indicator}*
from the alert: *${alert.name}*?

This action cannot be undone.
  `;
  
  const buttons = [
    [
      Markup.button.callback('🗑️ Yes, Remove', `delete_indicator_${alertId}_${encodeURIComponent(indicator)}`),
      Markup.button.callback('❌ No, Cancel', `view_indicator_${alertId}_${encodeURIComponent(indicator)}`)
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
  
  await ctx.answerCbQuery();
}

// Create the wizard scene
export const showAllAlertsWizard = new Scenes.WizardScene<CustomContext>(
  'show-all-alerts-wizard',
  step1
);

// ===== Main Menu Handlers =====
showAllAlertsWizard.action('show_coin_alerts', async (ctx) => {
  await showCoinAlerts(ctx);
});

showAllAlertsWizard.action('show_watchlist_alerts', async (ctx) => {
  await showWatchlistAlerts(ctx);
});

showAllAlertsWizard.action('show_horizon_breaks', async (ctx) => {
  await showHorizonBreaks(ctx);
});

showAllAlertsWizard.action('back_to_main', async (ctx) => {
  await ctx.answerCbQuery();
  return step1(ctx);
});

// ===== Coin Detail Handlers =====
showAllAlertsWizard.action(/^view_coin_(\w+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const coinId = callbackData.match(/view_coin_(\w+)/)?.[1] || '';
  logger.log(`View coin action triggered for coin: ${coinId}`);
  
  return showCoinDetails(ctx, coinId);
});

// ===== Watchlist Detail Handlers =====
showAllAlertsWizard.action(/^view_watchlist_(\w+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const watchlistId = callbackData.match(/view_watchlist_(\w+)/)?.[1] || '';
  logger.log(`View watchlist action triggered for watchlist: ${watchlistId}`);
  
  return showWatchlistDetails(ctx, watchlistId);
});

// ===== Alert Detail Handlers =====
showAllAlertsWizard.action(/^view_alert_(\w+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.match(/view_alert_(\w+)/)?.[1] || '';
  logger.log(`View alert action triggered for alert: ${alertId}`);
  
  return showAlertDetails(ctx, alertId);
});

// ===== Individual Indicator Alert Handlers =====
showAllAlertsWizard.action(/^view_indicator_(\w+)_(.+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const match = callbackData.match(/view_indicator_(\w+)_(.+)/);
  if (!match) return step1(ctx);
  
  const alertId = match[1];
  const indicator = decodeURIComponent(match[2]);
  
  logger.log(`View individual indicator triggered for alert: ${alertId}, indicator: ${indicator}`);
  
  return showIndicatorAlertDetails(ctx, alertId, indicator);
});

// ===== Alert Deletion Handlers =====
showAllAlertsWizard.action(/^confirm_delete_alert_(\w+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.match(/confirm_delete_alert_(\w+)/)?.[1] || '';
  logger.log(`Confirm delete alert triggered for alert: ${alertId}`);
  
  return confirmDeleteAlert(ctx, alertId);
});

showAllAlertsWizard.action(/^delete_alert_(\w+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const alertId = callbackData.match(/delete_alert_(\w+)/)?.[1] || '';
  logger.log(`Delete alert triggered for alert: ${alertId}`);
  
  // Extract alert service from context or use singleton
  const alertService = (ctx as any).alertService || alertServiceInstance;
  
  try {
    // Delete the alert
    const success = await alertService.deleteAlert(alertId);
    
    if (!success) {
      await ctx.answerCbQuery('Error: Alert not found');
      return step1(ctx);
    }
    
    await ctx.answerCbQuery('Alert deleted successfully');
    
    // Refresh alerts and return to main menu
    const userId = "12345"; // Always use mock user ID for testing
    const alerts = await alertService.getAlerts(userId);
    const summary = await alertService.getAlertsSummary(userId);
    
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      alerts,
      summary,
      selectedAlert: null
    };
    
    return step1(ctx);
    
  } catch (error) {
    logger.error(`Error deleting alert: ${error.message}`);
    await ctx.answerCbQuery('Error deleting alert');
    return step1(ctx);
  }
});

// Individual indicator deletion handlers
showAllAlertsWizard.action(/^confirm_delete_indicator_(\w+)_(.+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const match = callbackData.match(/confirm_delete_indicator_(\w+)_(.+)/);
  if (!match) return step1(ctx);
  
  const alertId = match[1];
  const indicator = decodeURIComponent(match[2]);
  
  logger.log(`Confirm delete indicator triggered for alert: ${alertId}, indicator: ${indicator}`);
  
  return confirmDeleteIndicator(ctx, alertId, indicator);
});

showAllAlertsWizard.action(/^delete_indicator_(\w+)_(.+)$/, async (ctx) => {
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? (ctx.callbackQuery as any).data
    : '';
  
  const match = callbackData.match(/delete_indicator_(\w+)_(.+)/);
  if (!match) return step1(ctx);
  
  const alertId = match[1];
  const indicator = decodeURIComponent(match[2]);
  
  logger.log(`Delete indicator triggered for alert: ${alertId}, indicator: ${indicator}`);
  
  // Extract alert service from context or use singleton
  const alertService = (ctx as any).alertService || alertServiceInstance;
  
  try {
    // Get the alert
    const userId = "12345"; // Always use mock user ID for testing
    const alerts = await alertService.getAlerts(userId);
    const alert = alerts.find(a => a.id === alertId);
    
    if (!alert || !alert.indicators || !alert.indicators.includes(indicator)) {
      await ctx.answerCbQuery('Error: Indicator not found');
      return step1(ctx);
    }
    
    // Remove the indicator from the alert
    const updatedIndicators = alert.indicators.filter(ind => ind !== indicator);
    
    // If this was the last indicator, delete the entire alert
    if (updatedIndicators.length === 0) {
      const success = await alertService.deleteAlert(alertId);
      
      if (!success) {
        await ctx.answerCbQuery('Error deleting alert');
        return step1(ctx);
      }
      
      await ctx.answerCbQuery('Alert deleted successfully (last indicator removed)');
    } else {
      // Otherwise update the alert with the remaining indicators
      // Note: This is a mock implementation - in a real app you'd have an updateAlert method
      alert.indicators = updatedIndicators;
      await ctx.answerCbQuery(`Indicator ${indicator} removed successfully`);
    }
    
    // Refresh alerts and return to main menu
    const updatedAlerts = await alertService.getAlerts(userId);
    const summary = await alertService.getAlertsSummary(userId);
    
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      alerts: updatedAlerts,
      summary,
      selectedAlert: null,
      selectedIndicator: null
    };
    
    // Return to the coin or watchlist view
    if (alert.type === AlertType.WATCHLIST) {
      return showWatchlistDetails(ctx, alert.targetId);
    } else {
      return showCoinDetails(ctx, alert.targetId);
    }
  } catch (error) {
    logger.error(`Error deleting indicator: ${error.message}`);
    await ctx.answerCbQuery('Error deleting indicator');
    return step1(ctx);
  }
});

// Go back to menu
showAllAlertsWizard.action('go_back', async (ctx) => {
  logger.log('Go back to menu action triggered');
  await ctx.answerCbQuery('Returning to menu');
  await ctx.scene.leave();
  return showAlertsMenu(ctx);
});
