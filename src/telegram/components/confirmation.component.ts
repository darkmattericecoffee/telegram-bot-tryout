import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
import { createGoBackButton } from '../constants/buttons.constant';

export interface ConfirmationConfig {
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmCallbackData?: string;
}

@Injectable()
export class ConfirmationComponent {
  private readonly logger = new Logger(ConfirmationComponent.name);

  /**
   * Displays a confirmation dialog with confirm and cancel options.
   * @param ctx The Telegram context
   * @param config Configuration for the confirmation dialog
   */
  public async prompt(ctx: CustomContext, config: ConfirmationConfig): Promise<void> {
    const {
      message,
      confirmButtonText = 'Confirm',
      cancelButtonText = '← Go Back',
      confirmCallbackData = 'confirmation_confirm'
    } = config;
    
    // Create buttons with confirm and cancel options
    const buttons = [
      [
        Markup.button.callback(confirmButtonText, confirmCallbackData),
        Markup.button.callback(cancelButtonText, 'go_back')
      ]
    ];
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    // Send or edit message with the confirmation
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        await ctx.reply(message, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      }
    } else {
      await ctx.reply(message, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
    
    this.logger.log(`Prompted user for confirmation: ${message}`);
  }
}

/**
 * Utility function to register confirmation handlers on a wizard
 * @param wizard The wizard scene
 * @param confirmCallbackData The callback data for confirmation button
 * @param nextStep Function to call after confirmation
 */
export function registerConfirmationHandler(
  wizard: any,
  confirmCallbackData: string = 'confirmation_confirm',
  nextStep: (ctx: CustomContext) => Promise<void>
) {
  // Set up a handler for the confirmation button
  wizard.action(confirmCallbackData, async (ctx) => {
    await ctx.answerCbQuery('Confirmed');
    return nextStep(ctx);
  });
  
  // The 'go_back' action is typically handled globally in the wizard
}