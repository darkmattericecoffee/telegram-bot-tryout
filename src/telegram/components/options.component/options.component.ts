// src/telegram/components/options.component/options.component.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';

export async function optionsComponent(ctx: CustomContext) {
  const messageText = 'Choose an action:';
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('Route A', 'route_a'),
    Markup.button.callback('Route B', 'route_b'),
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