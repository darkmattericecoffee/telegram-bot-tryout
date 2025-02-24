import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';

export interface ResponseConfig {
  text: string;
  parameters: Record<string, any>; // Collected parameters
}

export async function responseComponent(ctx: CustomContext, config: ResponseConfig) {
  const messageText = `${config.text}\n\n**Parameters to send to API:**\n${JSON.stringify(
    config.parameters,
    null,
    2
  )}`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText);
    } catch (error) {
      await ctx.reply(messageText);
    }
  } else {
    await ctx.reply(messageText);
  }
}