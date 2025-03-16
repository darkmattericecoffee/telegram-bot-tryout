// src/telegram/menus/sub.menu/discover.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { Logger } from '@nestjs/common';

const logger = new Logger('DiscoverMenu');

/**
 * Shows the discover submenu
 */
export async function showDiscoverMenu(ctx: CustomContext) {
  logger.log('Showing discover menu');
  
  const messageText = '🔍 *Discover Menu*\n\nExplore new features and cryptocurrencies:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✨ Example Wizard', 'start_wizard')
    ],
    [
      Markup.button.callback('🔥 Trending Coins', 'trending_coins'),
      Markup.button.callback('🆕 New Listings', 'new_listings')
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
 * Registers discover menu action handlers in the Telegram service
 * @param bot The Telegram bot instance
 */
export function registerDiscoverMenuHandlers(bot: any) {
  logger.log('Registering discover menu handlers');
  
  // Show discover menu
  bot.action('discover_submenu', async (ctx: CustomContext) => {
    await showDiscoverMenu(ctx);
  });
  
  // Trending coins placeholder
  bot.action('trending_coins', async (ctx: CustomContext) => {
    logger.log('Trending coins action triggered');
    await ctx.answerCbQuery('Trending coins feature coming soon!');
    await ctx.reply('The trending coins feature is coming soon!');
  });
  
  // New listings placeholder
  bot.action('new_listings', async (ctx: CustomContext) => {
    logger.log('New listings action triggered');
    await ctx.answerCbQuery('New listings feature coming soon!');
    await ctx.reply('The new listings feature is coming soon!');
  });
}