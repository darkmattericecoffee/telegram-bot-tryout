import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';

export interface MultiPickerState {
  selectedOptions: string[];
  type: string;
}

@Injectable()
export class MultiPickerComponent {
  private readonly logger = new Logger(MultiPickerComponent.name);

  /**
   * Render an inline keyboard for user to pick multiple options with a limit.
   * @param {string} prefix - a short prefix for your callback data
   * @param {MultiPickerState} state - the currently selected values
   * @param {string[]} options - available options to display
   * @param {number} limit - maximum number of options that can be selected
   */
  public render(
    prefix = 'multipicker',
    state: MultiPickerState = { selectedOptions: [], type: 'default' },
    options: string[] = [],
    limit: number = 3
  ): any {
    const selectedOptions = state.selectedOptions || [];
    
    // Create buttons grid (3 buttons per row)
    const optionButtons: Array<Array<ReturnType<typeof Markup.button.callback>>> = [];
    const buttonsPerRow = 3;
    
    for (let i = 0; i < options.length; i += buttonsPerRow) {
      const row: Array<ReturnType<typeof Markup.button.callback>> = [];
      
      for (let j = 0; j < buttonsPerRow && i + j < options.length; j++) {
        const option = options[i + j];
        const isSelected = selectedOptions.includes(option);
        
        row.push(
          Markup.button.callback(
            isSelected ? `✅ ${option}` : option,
            `${prefix}_option_${option}`
          )
        );
      }
      
      optionButtons.push(row);
    }
    
    // Navigation buttons row with back and next
    const navigationRow = [
      Markup.button.callback('← Back', 'go_back'),
      Markup.button.callback('Next →', `${prefix}_CHOOSE`)
    ];
    
    // Combine all button rows
    const buttons = [...optionButtons, navigationRow];
    
    return Markup.inlineKeyboard(buttons);
  }
}

@Injectable()
export class MultiPickerCallbackHandler {
  private readonly logger = new Logger(MultiPickerCallbackHandler.name);

  /**
   * Processes the callback data and updates the state.
   */
  public async handleCallback(
    ctx: CustomContext,
    data: string,
    currentState: MultiPickerState,
    options: string[],
    limit: number
  ): Promise<{ state: MultiPickerState; proceed: boolean; redraw?: boolean }> {
    // Extract prefix, action, and value from callback data (e.g., "multipicker_option_RSI")
    const parts = data.split('_');
    
    if (parts.length < 2 || parts[0] !== 'multipicker') {
      return { state: currentState, proceed: false }; // not for us
    }

    // Handle the "Choose" action
    if (parts[1] === 'CHOOSE') {
      if (currentState.selectedOptions.length === 0) {
        await ctx.answerCbQuery('Please select at least one option');
        return { state: currentState, proceed: false, redraw: false };
      }
      
      this.logger.log(`Proceeding with selections: ${currentState.selectedOptions.join(', ')}`);
      await ctx.answerCbQuery(`Selection confirmed: ${currentState.selectedOptions.join(', ')}`);
      return { state: currentState, proceed: true, redraw: true };
    }

    // Handle option selection/deselection
    if (parts[1] === 'option' && parts[2]) {
      const option = parts[2];
      const selectedOptions = [...currentState.selectedOptions];
      const isSelected = selectedOptions.includes(option);
      
      if (isSelected) {
        // Remove the option if already selected
        const index = selectedOptions.indexOf(option);
        if (index !== -1) {
          selectedOptions.splice(index, 1);
          this.logger.log(`Deselected option: ${option}`);
          await ctx.answerCbQuery(`Deselected: ${option}`);
        }
      } else {
        // Add the option if not already selected and within limit
        if (selectedOptions.length >= limit) {
          this.logger.log(`Selection limit reached (${limit})`);
          await ctx.answerCbQuery(`Maximum ${limit} options allowed`);
          // Return the unchanged state and don't redraw
          return { 
            state: currentState, 
            proceed: false,
            redraw: false  // Signal not to redraw the component
          };
        }
        
        selectedOptions.push(option);
        this.logger.log(`Selected option: ${option}`);
        await ctx.answerCbQuery(`Selected: ${option}`);
      }
      
      return { 
        state: { ...currentState, selectedOptions }, 
        proceed: false 
      };
    }

    // If we reached here, something unexpected happened
    return { state: currentState, proceed: false, redraw: false };
  }
}