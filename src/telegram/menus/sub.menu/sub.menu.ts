// src/telegram/menus/sub.menu/sub.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { Logger } from '@nestjs/common';

const logger = new Logger('SubMenu');

/**
 * This is a legacy function that's kept for backward compatibility.
 * New navigation now uses dedicated sub-menus.
 */
export async function showSubMenu(ctx: CustomContext) {
  logger.log('Legacy sub-menu accessed - redirecting to main menu');
  
  // Show a message to indicate this menu is deprecated
  await ctx.reply("This menu has been redesigned. Redirecting to main menu...");
  
  // Show the main menu keyboard
  const mainMenuText = 'Welcome to TrendSniper Bot!\nChoose an option:';
  const mainMenuKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Watchlist', 'watchlist_submenu'),
      Markup.button.callback('📊 Analysis', 'analysis_submenu')
    ],
    [
      Markup.button.callback('🔍 Discover', 'discover_submenu')
    ]
  ]);
  
  await ctx.reply(mainMenuText, {
    reply_markup: mainMenuKeyboard.reply_markup,
  });
}

/**
 * Registers the legacy sub-menu handler for backward compatibility
 * @param bot The Telegram bot instance
 */
export function registerSubMenuHandlers(bot: any) {
  logger.log('Registering legacy sub-menu handler');
  
  // Legacy handler for backward compatibility
  bot.action('sub_menu', async (ctx: CustomContext) => {
    await showSubMenu(ctx);
  });
}