import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';

export interface OptionsConfig {
  text: string;
  buttons: { label: string; action: string }[];
}

export async function optionsComponent(ctx: CustomContext, config: OptionsConfig) {
  const keyboard = Markup.inlineKeyboard([
    ...config.buttons.map((button) =>
      Markup.button.callback(button.label, button.action)
    ),
    createGoBackButton(), // Add the "Go Back" button
  ]);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(config.text, {
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      await ctx.reply(config.text, {
        reply_markup: keyboard.reply_markup,
      });
    }
  } else {
    await ctx.reply(config.text, {
      reply_markup: keyboard.reply_markup,
    });
  }
}