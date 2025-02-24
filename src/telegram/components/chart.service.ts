import { CustomContext } from '../interfaces/custom-context.interface';

export async function getReplyWithChart(
  ctx: CustomContext,
  imageBuffer: Buffer,
  caption: string
): Promise<void> {
  // Using replyWithPhoto to send the chart image along with a caption.
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageMedia({
        type: 'photo',
        media: { source: imageBuffer },
        caption,
      });
    } catch (error) {
      // Fallback in case editing fails
      await ctx.replyWithPhoto({ source: imageBuffer }, { caption });
    }
  } else {
    await ctx.replyWithPhoto({ source: imageBuffer }, { caption });
  }
}