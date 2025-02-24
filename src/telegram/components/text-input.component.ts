import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
import { createGoBackButton } from '../constants/buttons.constant';

export interface TextInputConfig {
  question: string;
  fieldName: string;
  skipButtonText?: string;
  showSkipButton?: boolean;
}

@Injectable()
export class TextInputComponent {
  private readonly logger = new Logger(TextInputComponent.name);

  /**
   * Shows a text prompt to the user, asking them to provide text input.
   * @param ctx The Telegram context
   * @param config Configuration for the text input
   */
  public async prompt(ctx: CustomContext, config: TextInputConfig): Promise<void> {
    const { question, showSkipButton = false, skipButtonText = 'Skip' } = config;
    
    // Create buttons if needed
    const buttons: Array<ReturnType<typeof Markup.button.callback>[]> = [];
    
    // Add Skip button if requested
    if (showSkipButton) {
      buttons.push([Markup.button.callback(skipButtonText, 'textinput_skip')]);
    }
    
    // Always add a back button
    buttons.push([createGoBackButton()]);
    
    // Create keyboard markup if we have buttons
    const keyboard = buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined;
    
    // Send the message
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(question, {
          reply_markup: keyboard?.reply_markup,
          parse_mode: 'Markdown',
        });
      } catch (error) {
        await ctx.reply(question, {
          reply_markup: keyboard?.reply_markup,
          parse_mode: 'Markdown',
        });
      }
    } else {
      await ctx.reply(question, {
        reply_markup: keyboard?.reply_markup,
        parse_mode: 'Markdown',
      });
    }
    
    this.logger.log(`Prompted user for text input: ${question}`);
  }
}

/**
 * Creates a handler for waiting for text input
 * @param fieldName The name of the field to store the response in
 * @param nextStep Function to call after receiving input
 * @returns A function that handles text responses
 */
export function createWaitForTextInput(fieldName: string, nextStep: (ctx: CustomContext) => Promise<void>) {
  return async (ctx: CustomContext) => {
    // Only process if this is a text message
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }
    
    const text = ctx.message.text;
    
    // Store the user input in the wizard state parameters
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      [fieldName]: text
    };
    
    // Go to the next step
    return nextStep(ctx);
  };
}

/**
 * Utility function to register text input handlers on a wizard
 * @param wizard The wizard scene
 * @param fieldName The field name to store the response in
 * @param nextStep Function to call after receiving input
 */
export function registerTextInputHandlers(
  wizard: any,
  fieldName: string,
  nextStep: (ctx: CustomContext) => Promise<void>
) {
  // Set up a handler for text messages
  wizard.on('text', createWaitForTextInput(fieldName, nextStep));
  
  // Set up a handler for the skip button
  wizard.action('textinput_skip', async (ctx) => {
    // Store null or empty string for skipped input
    ctx.wizard.state.parameters = {
      ...ctx.wizard.state.parameters,
      [fieldName]: ''
    };
    
    await ctx.answerCbQuery('Skipped');
    return nextStep(ctx);
  });
}