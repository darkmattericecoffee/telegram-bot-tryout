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
      Markup.button.callback('➕ New Alert', 'create_alert'),
      Markup.button.callback('🗑️ Delete Alert', 'delete_alert')
    ],
    [
      Markup.button.callback('🔄 Market Transitions', 'create_market_transition_alert'),
      Markup.button.callback('📊 Level Breaks', 'create_level_break_alert')
    ],
    [
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
• Max Indicators: ${limits.indicatorLimit} per alert

*Alert Types Available:*
• Horizon Score alerts (global trend indicator)
• Individual indicator alerts (up to 3 indicators)
• Market transition alerts (Bullish/Bearish shifts)
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
  
  if (!alertService) {
    logger.error('AlertService not provided to registerAlertsMenuHandlers');
    return;
  }
  
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
    // Inject alert service into context
    (ctx as any).alertService = alertService;
    await ctx.scene.enter('show-all-alerts-wizard');
  });
  
  // Create standard alert
  bot.action('create_alert', async (ctx: CustomContext) => {
    logger.log('Create alert action triggered');
    // Inject services into context for wizard to use
    (ctx as any).alertService = alertService;
    
    // For backward compatibility, if the watchlistService isn't available in the current scope
    if (!(ctx as any).watchlistService) {
      logger.warn('WatchlistService not available in context, using mock service');
      (ctx as any).watchlistService = { 
        getWatchlists: async (telegramId: string, isGroup: boolean) => [], 
        getWatchlistById: async (watchlistId: string) => null
      };
    }
    
    await ctx.scene.enter('create-alert-wizard');
  });
  
  // Create market transition alert
  bot.action('create_market_transition_alert', async (ctx: CustomContext) => {
    logger.log('Create market transition alert triggered');
    await ctx.answerCbQuery('Market transition alert creation coming soon!');
    await ctx.reply('The market transition alert creation feature is coming soon!');
  });
  
  // Create level break alert
  bot.action('create_level_break_alert', async (ctx: CustomContext) => {
    logger.log('Create level break alert triggered');
    await ctx.answerCbQuery('Level break alert creation coming soon!');
    await ctx.reply('The level break alert creation feature is coming soon!');
  });
  
  // Delete alert
  bot.action('delete_alert', async (ctx: CustomContext) => {
    logger.log('Delete alert action triggered');
    await ctx.answerCbQuery('Alert deletion coming soon!');
    await ctx.reply('The alert deletion feature is coming soon!');
  });
  
  // Back button handler (to main menu)
  bot.action('back_to_main', async (ctx: CustomContext) => {
    logger.log('Back to main menu action triggered');
    await ctx.answerCbQuery('Returning to main menu');
    // You would typically implement a function to show the main menu here
    // something like showMainMenu(ctx);
  });
}