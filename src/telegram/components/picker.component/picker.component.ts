import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';

export interface PickerConfig {
  text: string;
  options: { label: string; action: string }[];
  buttonsPerRow?: number;
  autoLayout?: boolean;
}

/**
 * Creates a picker component with automatic layout detection
 * @param ctx - The CustomContext
 * @param config - Configuration for the picker
 */
export async function pickerComponent(ctx: CustomContext, config: PickerConfig) {
  // Default to auto layout if not specified
  const autoLayout = config.autoLayout !== false;
  let buttonsPerRow = config.buttonsPerRow;
  
  // If auto layout is enabled and buttons per row is not explicitly set
  if (autoLayout && buttonsPerRow === undefined) {
    // Find the longest label
    const longestLabelLength = Math.max(...config.options.map(option => option.label.length));
    
    // Determine the optimal layout based on label length
    if (longestLabelLength > 10) {
      buttonsPerRow = 1; // Use horizontal layout (1 button per row) for long labels
    } else if (longestLabelLength > 6) {
      buttonsPerRow = 2; // Use 2 buttons per row for medium length labels
    } else {
      buttonsPerRow = 3; // Default layout (3 buttons per row)
    }
  }
  
  // Fallback to 3 buttons per row if not set
  buttonsPerRow = buttonsPerRow || 3;
  
  // Build the button rows using proper typing
  const buttonRows: ReturnType<typeof Markup.button.callback>[][] = [];
  const optionsCopy = [...config.options]; // Create a copy to avoid modifying the original array
  
  // Create rows with the determined buttons per row
  while (optionsCopy.length > 0) {
    const row: ReturnType<typeof Markup.button.callback>[] = [];
    
    // Add buttons to the current row
    for (let i = 0; i < buttonsPerRow && optionsCopy.length > 0; i++) {
      const option = optionsCopy.shift(); // Remove the first element
      if (option) {
        row.push(Markup.button.callback(option.label, option.action));
      }
    }
    
    buttonRows.push(row);
  }
  
  // Add the "Go Back" button as its own row
  const backButtonRow = [createGoBackButton()];
  
  // Create the keyboard with the button rows
  const keyboard = Markup.inlineKeyboard([...buttonRows, backButtonRow]);
  
  // Handle the response
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(config.text, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      await ctx.reply(config.text, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    }
  } else {
    await ctx.reply(config.text, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'Markdown',
    });
  }
}