// src/telegram/components/loading-message.component.ts
import { CustomContext } from '../interfaces/custom-context.interface';
import { Logger } from '@nestjs/common';

// Create logger for loading messages
const logger = new Logger('LoadingMessage');

/**
 * Loading message configuration
 */
export interface LoadingMessageConfig {
  /**
   * Array of possible loading messages (one will be randomly selected)
   */
  messages: string[];
  
  /**
   * Optional emoji to display before the message
   */
  emoji?: string;
}

// Default loading messages if none provided
const DEFAULT_LOADING_MESSAGES = [
  'Processing your request...',
  'This will only take a moment...',
  'Working on it...',
  'Almost there...',
  'Please wait...'
];

// Default loading emoji
const DEFAULT_LOADING_EMOJI = '⏳';

/**
 * Component for displaying and managing loading messages
 */
export class LoadingMessageComponent {
  /**
   * Show a loading message and return functions to update or remove it
   * 
   * @param ctx - The Telegram context
   * @param config - Configuration for the loading message
   * @returns Object with functions to update or remove the loading message
   */
  async show(ctx: CustomContext, config?: Partial<LoadingMessageConfig>) {
    const messages = config?.messages || DEFAULT_LOADING_MESSAGES;
    const emoji = config?.emoji || DEFAULT_LOADING_EMOJI;
    
    // Select a random message
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const fullMessage = `${emoji} ${randomMessage}`;
    
    logger.log(`Showing loading message: "${fullMessage}"`);
    
    // Send the loading message
    const messageResponse = await ctx.reply(fullMessage);
    
    // Return functions to manage the loading message
    return {
      /**
       * Update the loading message with a new random message
       */
      update: async () => {
        const newRandomMessage = messages[Math.floor(Math.random() * messages.length)];
        const newFullMessage = `${emoji} ${newRandomMessage}`;
        
        logger.log(`Updating loading message to: "${newFullMessage}"`);
        
        try {
          await ctx.telegram.editMessageText(
            messageResponse.chat.id,
            messageResponse.message_id,
            undefined,
            newFullMessage
          );
        } catch (error) {
          logger.error(`Failed to update loading message: ${error.message}`);
        }
      },
      
      /**
       * Remove the loading message
       */
      remove: async () => {
        logger.log('Removing loading message');
        
        try {
          await ctx.telegram.deleteMessage(
            messageResponse.chat.id,
            messageResponse.message_id
          );
          logger.log('Loading message removed successfully');
        } catch (error) {
          logger.error(`Failed to remove loading message: ${error.message}`);
        }
      }
    };
  }
}

/**
 * Helper function to use the loading message with async operations using a wrapper pattern
 * 
 * @param ctx - The Telegram context
 * @param operation - The async operation to perform while showing loading message
 * @param config - Configuration for the loading message
 * @returns Result of the operation
 */
export async function withLoading<T>(
  ctx: CustomContext,
  operation: () => Promise<T>,
  config?: Partial<LoadingMessageConfig>
): Promise<T> {
  const loadingComponent = new LoadingMessageComponent();
  const loading = await loadingComponent.show(ctx, config);
  
  try {
    // Perform the operation
    const result = await operation();
    
    // Remove the loading message
    await loading.remove();
    
    return result;
  } catch (error) {
    // Remove the loading message even if there's an error
    await loading.remove();
    throw error;
  }
}