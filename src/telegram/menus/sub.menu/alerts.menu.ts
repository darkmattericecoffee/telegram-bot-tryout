// src/telegram/menus/sub.menu/alerts.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { Logger } from '@nestjs/common';
import { AlertService } from '../../services/alert.service';

const logger = new Logger('AlertsMenu');

/**
 * Shows the alerts submenu
 */
export async function showAlertsMenu(ctx: CustomContext) {
  logger.log('Showing alerts menu');
  
  const messageText = '🔔 *Alerts Menu*\n\nManage your cryptocurrency price and indicator alerts:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 My Alerts', 'show_all_alerts'),
    ],
    [
      Markup.button.callback('➕ Watchlist Alert', 'create_alert'),
      Markup.button.callback('🔎 Discovery Alert', 'create_discovery_alert')
    ],
    [
      Markup.button.callback('🔄 Market Transitions', 'create_market_transition_alert'),
      Markup.button.callback('📊 Level Breaks', 'create_level_break_alert')
    ],
    [
      Markup.button.callback('🗑️ Delete Alert', 'delete_alert'),
      Markup.button.callback('🔧 Alert Settings', 'alert_settings')
    ],
    [createGoBackButton()]
  ]);
  
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error(`Error editing message: ${error.message}`);
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
  
  // Answer callback query if this was triggered by a callback
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
}

/**
 * Displays the alert limits information
 */
export async function showAlertSettings(ctx: CustomContext, alertService: AlertService) {
  logger.log('Showing alert settings');
  
  const limits = alertService.getAlertsLimits();
  
  const messageText = `
🔧 *Alert Settings*

*Alert Limits:*
• Watchlist Alerts: ${limits.watchlistLimit} per watchlist
• Discovery Alerts: ${limits.discoveryLimit} total

*Alert Types Available:*
• Price alerts (above/below threshold)
• Percentage change alerts
• Volume alerts
• Technical indicator alerts (RSI, MACD, Moving Averages)
• Market transition alerts (Bullish/Bearish)
• Support/Resistance level break alerts

For custom alert requirements, please contact support.
`;

  const keyboard = Markup.inlineKeyboard([
    [createGoBackButton()]
  ]);
  
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error(`Error editing message: ${error.message}`);
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
  
  // Answer callback query
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
}

/**
 * Registers alert menu action handlers in the Telegram service
 * @param bot The Telegram bot instance
 * @param alertService The AlertService instance
 */
export function registerAlertsMenuHandlers(bot: any, alertService: AlertService) {
  logger.log('Registering alerts menu handlers');
  
  // Show alerts submenu
  bot.action('alerts_submenu', async (ctx: CustomContext) => {
    logger.log('Alerts submenu action triggered');
    await showAlertsMenu(ctx);
  });
  
  // Show alert settings
  bot.action('alert_settings', async (ctx: CustomContext) => {
    logger.log('Alert settings action triggered');
    await showAlertSettings(ctx, alertService);
  });
  
  // Show all alerts (combines watchlist and discovery)
  bot.action('show_all_alerts', async (ctx: CustomContext) => {
    logger.log('Show all alerts action triggered');
    // First try watchlist alerts, then show discovery alerts
    await ctx.scene.enter('show-watchlist-alerts-wizard');
  });
  
  // Show watchlist alerts
  bot.action('show_watchlist_alerts', async (ctx: CustomContext) => {
    logger.log('Show watchlist alerts action triggered');
    await ctx.scene.enter('show-watchlist-alerts-wizard');
  });
  
  // Show discovery alerts
  bot.action('show_discovery_alerts', async (ctx: CustomContext) => {
    logger.log('Show discovery alerts action triggered');
    await ctx.scene.enter('show-discovery-alerts-wizard');
  });
  
  // Create standard alert
  bot.action('create_alert', async (ctx: CustomContext) => {
    logger.log('Create alert action triggered');
    await ctx.scene.enter('create-alert-wizard');
  });
  
  // Create discovery alert
  bot.action('create_discovery_alert', async (ctx: CustomContext) => {
    logger.log('Create discovery alert action triggered');
    await ctx.scene.enter('discovery-alert-wizard');
  });
  
  // Create market transition alert
  bot.action('create_market_transition_alert', async (ctx: CustomContext) => {
    logger.log('Create market transition alert triggered');
    await ctx.scene.enter('market-transitions-wizard');
  });
  
  // Create level break alert
  bot.action('create_level_break_alert', async (ctx: CustomContext) => {
    logger.log('Create level break alert triggered');
    await ctx.scene.enter('level-breaks-wizard');
  });
  
  // Delete alert
  bot.action('delete_alert', async (ctx: CustomContext) => {
    logger.log('Delete alert action triggered');
    await ctx.scene.enter('delete-alert-wizard');
  });
}