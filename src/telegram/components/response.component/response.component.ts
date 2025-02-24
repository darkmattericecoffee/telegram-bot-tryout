// src/telegram/components/response.component.ts
import { CustomContext } from "src/telegram/interfaces/custom-context.interface";

export async function responseComponent(ctx: CustomContext) {
  const messageText = 'Simulated backend response: TrendSniper analysis result.';
  
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