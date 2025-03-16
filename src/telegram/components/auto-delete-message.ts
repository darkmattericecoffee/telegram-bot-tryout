// src/telegram/helpers/auto-delete-message.ts
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';

/**
 * Sends a message that auto-deletes after specified duration
 */
export async function sendAutoDeleteMessage(
  ctx: Context, 
  text: string, 
  options: any = {}, 
  duration: number = 2000
): Promise<void> {
  // Create a logger instance - this will output to terminal
  const logger = new Logger('AutoDeleteMessage');
  
  try {
    // Safely access chat id
    const chatId = ctx.chat?.id;
    
    if (!chatId) {
      logger.error('Chat ID is undefined');
      return;
    }
    
    logger.log(`Sending message that will delete in ${duration}ms`);
    
    // Send the message
    const sentMessage = await ctx.telegram.sendMessage(chatId, text, options);
    logger.log(`Message ${sentMessage.message_id} sent successfully`);
    
    // Set timeout to delete the message
    logger.log(`Setting timeout for ${duration}ms`);
    
    setTimeout(async () => {
      logger.log(`Timeout triggered, now deleting message ${sentMessage.message_id}`);
      try {
        await ctx.telegram.deleteMessage(chatId, sentMessage.message_id);
        logger.log(`Successfully deleted message ${sentMessage.message_id}`);
      } catch (error) {
        logger.error(`Failed to delete message: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, duration);
    
  } catch (error) {
    logger.error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
  }
}