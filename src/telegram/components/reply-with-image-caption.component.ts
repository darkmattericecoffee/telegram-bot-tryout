// src/telegram/components/reply-with-image-caption.component.ts
import { CustomContext } from '../interfaces/custom-context.interface';

export async function getReplyWithChart(
  ctx: CustomContext,
  imageBuffer: Buffer,
  caption: string,
): Promise<void> {
  // Use replyWithPhoto to send the image and caption
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageMedia({
        type: 'photo',
        media: { source: imageBuffer },
        caption,
      });
    } catch (error) {
      await ctx.replyWithPhoto({ source: imageBuffer }, { caption });
    }
  } else {
    await ctx.replyWithPhoto({ source: imageBuffer }, { caption });
  }
}