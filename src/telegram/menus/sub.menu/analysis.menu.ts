// src/telegram/menus/sub.menu/analysis.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { Logger } from '@nestjs/common';

const logger = new Logger('AnalysisMenu');

/**
 * Shows the analysis submenu
 */
export async function showAnalysisMenu(ctx: CustomContext) {
  logger.log('Showing analysis menu');
  
  const messageText = '📊 *Analysis Menu*\n\nAnalyze cryptocurrency price data and trends:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📈 Charting', 'charting_wizard')
    ],
    [
      // Additional analysis options can be added here in the future
      Markup.button.callback('🧮 Price Calculator', 'price_calculator')
    ],
    [createGoBackButton()]
  ]);
  
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error(`Error editing message: ${error.message}`);
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown'
      });
    }
  } else {
    await ctx.reply(messageText, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'Markdown'
    });
  }
  
  // Answer callback query if this was triggered by a callback
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
}

/**
 * Registers analysis menu action handlers in the Telegram service
 * @param bot The Telegram bot instance
 */
export function registerAnalysisMenuHandlers(bot: any) {
  logger.log('Registering analysis menu handlers');
  
  // Show analysis menu
  bot.action('analysis_submenu', async (ctx: CustomContext) => {
    await showAnalysisMenu(ctx);
  });
  
  // Price calculator placeholder
  bot.action('price_calculator', async (ctx: CustomContext) => {
    logger.log('Price calculator action triggered');
    await ctx.answerCbQuery('Price calculator coming soon!');
    await ctx.reply('The price calculator feature is coming soon!');
  });
}