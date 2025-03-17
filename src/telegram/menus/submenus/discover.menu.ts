// src/telegram/menus/submenus/discover.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Logger } from '@nestjs/common';

const logger = new Logger('DiscoverMenu');

/**
 * Shows the discovery submenu
 */
export async function showDiscoverMenu(ctx: CustomContext) {
  logger.log('Showing discovery menu');
  
  const messageText = `
🔍 *Discover Menu*

Explore new opportunities and analyze market trends:

• Find strongest and weakest coins across different timeframes
• Discover latest market trend signals
• Explore coins with breakout potential
`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🏆 Strength Analysis', 'strength_wizard'),
    ],
    [
      Markup.button.callback('🔄 Latest Signals', 'latest_signals_wizard'),
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
 * Registers discovery menu action handlers in the Telegram service
 * @param bot The Telegram bot instance
 * @param discoveryService The DiscoveryService instance
 */
export function registerDiscoveryMenuHandlers(bot: any, discoveryService: any) {
  logger.log('Registering discovery menu handlers');
  
  // Show discover submenu
  bot.action('discover_submenu', async (ctx: CustomContext) => {
    logger.log('Discovery submenu action triggered');
    await showDiscoverMenu(ctx);
  });
  
  // Strength wizard action
  bot.action('strength_wizard', async (ctx: CustomContext) => {
    logger.log('Strength wizard action triggered');
    // Inject discovery service
    (ctx as any).discoveryService = discoveryService;
    await ctx.scene.enter('strength-wizard');
  });
  
  // Latest signals wizard action
  bot.action('latest_signals_wizard', async (ctx: CustomContext) => {
    logger.log('Latest signals wizard action triggered');
    // Inject discovery service
    (ctx as any).discoveryService = discoveryService;
    await ctx.scene.enter('latest-signals-wizard');
  });
}