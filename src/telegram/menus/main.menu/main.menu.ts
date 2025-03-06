// src/telegram/menus/main.menu/main.menu.ts - Updated version
import { Markup } from 'telegraf';
import { CustomContext } from '../../interfaces/custom-context.interface';

export async function showMainMenu(ctx: CustomContext) {
  const mainMenuText = 'Welcome to TrendSniper Bot!\nChoose an option:';
  const mainMenuKeyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Watchlist', 'watchlist_submenu'),
      Markup.button.callback('📊 Analysis', 'analysis_submenu')
    ],
    [
      Markup.button.callback('🔔 Alerts', 'alerts_submenu'),
      Markup.button.callback('🔍 Discover', 'discover_submenu')
    ]
  ]);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(mainMenuText, {
        reply_markup: mainMenuKeyboard.reply_markup,
      });
    } catch (error) {
      await ctx.reply(mainMenuText, {
        reply_markup: mainMenuKeyboard.reply_markup,
      });
    }
  } else {
    await ctx.reply(mainMenuText, {
      reply_markup: mainMenuKeyboard.reply_markup,
    });
  }
}