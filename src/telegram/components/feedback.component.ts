// src/telegram/components/toast-message.component.ts
import { CustomContext } from '../interfaces/custom-context.interface';
import { Logger } from '@nestjs/common';

// Create logger for toast messages
const logger = new Logger('ToastMessage');

/**
 * Toast message configuration
 */
export interface ToastMessageConfig {
  /**
   * The message to display
   */
  message: string;
  
  /**
   * How long to display the toast in milliseconds (default: 2000ms)
   */
  duration?: number;
  
  /**
   * Optional emoji to display before the message
   */
  emoji?: string;
  
  /**
   * Toast type for styling/behavior
   */
  type?: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Component for displaying temporary toast messages
 */
export class ToastMessageComponent {
  /**
   * Show a toast message that auto-dismisses after the specified duration
   * 
   * @param ctx - The Telegram context
   * @param config - Configuration for the toast message
   * @returns Object with function to manually dismiss the toast early
   */
  async show(ctx: CustomContext, config: ToastMessageConfig): Promise<{ dismiss: () => Promise<void> }> {
    // Set default values
    const duration = config.duration || 2000;
    
    // Select emoji based on type if not provided
    let emoji = config.emoji;
    if (!emoji) {
      switch (config.type) {
        case 'success':
          emoji = '✅';
          break;
        case 'error':
          emoji = '❌';
          break;
        case 'warning':
          emoji = '⚠️';
          break;
        case 'info':
        default:
          emoji = 'ℹ️';
          break;
      }
    }
    
    // Format the message
    const fullMessage = `${emoji} ${config.message}`;
    
    logger.log(`Showing toast message: "${fullMessage}" (${duration}ms)`);
    
    // Send the toast message
    const messageResponse = await ctx.reply(fullMessage);
    
    // Set up auto-dismiss timer
    const timerId = setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(
          messageResponse.chat.id,
          messageResponse.message_id
        );
        logger.log('Toast message auto-dismissed');
      } catch (error) {
        logger.error(`Failed to auto-dismiss toast message: ${error.message}`);
      }
    }, duration);
    
    // Return function to manually dismiss
    return {
      dismiss: async () => {
        clearTimeout(timerId);
        try {
          await ctx.telegram.deleteMessage(
            messageResponse.chat.id,
            messageResponse.message_id
          );
          logger.log('Toast message manually dismissed');
        } catch (error) {
          logger.error(`Failed to manually dismiss toast message: ${error.message}`);
        }
      }
    };
  }
}

/**
 * Helper function to display error messages as toasts
 * 
 * @param ctx - The Telegram context
 * @param error - The error object or message string
 * @param duration - How long to show the message (default: 3000ms)
 */
export async function showErrorToast(
  ctx: CustomContext,
  error: Error | string,
  duration: number = 3000
): Promise<void> {
  const toastComponent = new ToastMessageComponent();
  const message = error instanceof Error ? error.message : error;
  
  await toastComponent.show(ctx, {
    message,
    type: 'error',
    duration
  });
}

/**
 * Helper function to display success messages as toasts
 * 
 * @param ctx - The Telegram context
 * @param message - The success message
 * @param duration - How long to show the message (default: 2000ms)
 */
export async function showSuccessToast(
  ctx: CustomContext,
  message: string,
  duration: number = 2000
): Promise<void> {
  const toastComponent = new ToastMessageComponent();
  
  await toastComponent.show(ctx, {
    message,
    type: 'success',
    duration
  });
}

/**
 * Wrap an async operation with error handling that shows errors as toast messages
 * 
 * @param ctx - The Telegram context
 * @param operation - The async operation to perform
 * @param errorMessage - Optional custom error message prefix
 * @returns Result of the operation
 */
export async function withErrorToast<T>(
  ctx: CustomContext,
  operation: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await showErrorToast(ctx, `${errorMessage}: ${message}`);
    logger.error(`Error in operation: ${message}`);
    return null;
  }
}