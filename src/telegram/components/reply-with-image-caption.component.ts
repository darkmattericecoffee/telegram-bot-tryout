// src/telegram/components/reply-with-image-caption.component.ts
import { CustomContext } from '../interfaces/custom-context.interface';
import { ActionButtonsComponent, ActionButtonType } from './action-buttons.component';
import { Logger } from '@nestjs/common';

// Create logger for chart replies
const logger = new Logger('ReplyWithChart');

// Initialize the action buttons component
const actionButtonsComponent = new ActionButtonsComponent();

/**
 * Reply with a chart image and optional action buttons
 * @param ctx - The Telegram context
 * @param imageBuffer - The image buffer to send
 * @param caption - The caption for the image
 * @param coinId - Optional coin ID for action buttons
 * @param buttonType - Optional button type configuration
 */
export async function getReplyWithChart(
  ctx: CustomContext,
  imageBuffer: Buffer,
  caption: string,
  coinId?: string,
  buttonType: ActionButtonType = ActionButtonType.DEFAULT
): Promise<void> {
  try {
    logger.log(`Replying with chart for ${coinId || 'unknown coin'}`);
    
    // If we have a coin ID, add action buttons
    if (coinId) {
      logger.log(`Adding ${buttonType} buttons for coin: ${coinId}`);
      
      await actionButtonsComponent.addButtonsToPhoto(ctx, imageBuffer, caption, {
        type: buttonType,
        identifier: coinId,
        showBackButton: true
      });
    } else {
      // Otherwise, just send the photo with caption
      logger.log('Sending chart without action buttons');
      
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageMedia({
            type: 'photo',
            media: { source: imageBuffer },
            caption,
          });
        } catch (error) {
          logger.error(`Failed to edit message: ${error.message}`);
          await ctx.replyWithPhoto({ source: imageBuffer }, { caption });
        }
      } else {
        await ctx.replyWithPhoto({ source: imageBuffer }, { caption });
      }
    }
    
    logger.log('Chart sent successfully');
  } catch (error) {
    logger.error(`Error sending chart: ${error.message}`);
    throw error;
  }
}