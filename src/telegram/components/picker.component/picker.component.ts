import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';

export interface PickerConfig {
  text: string;
  options: { label: string; action: string }[];
}

export async function pickerComponent(ctx: CustomContext, config: PickerConfig) {
  const keyboard = Markup.inlineKeyboard([
    ...config.options.map((option) =>
      Markup.button.callback(option.label, option.action)
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