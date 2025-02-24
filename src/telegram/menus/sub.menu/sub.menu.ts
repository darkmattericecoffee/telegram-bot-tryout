import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';

export async function showSubMenu(ctx: CustomContext) {
  const messageText = 'Sub Menu';
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('Start Wizard', 'start_wizard'),
    createGoBackButton(), // Use the reusable button
  ]);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
      });
    }
  } else {
    await ctx.reply(messageText, {
      reply_markup: keyboard.reply_markup,
    });
  }
}