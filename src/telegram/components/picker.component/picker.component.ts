// src/telegram/components/picker.component/picker.component.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';

export async function pickerComponent(ctx: CustomContext) {
  const messageText = 'Please pick an option:';
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('Option 1', 'picker_option_1'),
    Markup.button.callback('Option 2', 'picker_option_2'),
    Markup.button.callback('Go Back', 'go_back')
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