// src/telegram/menus/main.menu/main.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from '../../interfaces/custom-context.interface';

export async function showMainMenu(ctx: CustomContext) {
  const mainMenuText = 'Welcome to TrendSniper Bot!\nChoose an option:';
  const mainMenuKeyboard = Markup.inlineKeyboard([
    Markup.button.callback('Sub Menu', 'sub_menu'),
    Markup.button.callback('Start Wizard', 'start_wizard'),
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