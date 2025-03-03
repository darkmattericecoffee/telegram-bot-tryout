// src/telegram/menus/sub.menu/watchlist.menu.ts
import { Markup } from 'telegraf';
import { CustomContext } from 'src/telegram/interfaces/custom-context.interface';
import { createGoBackButton } from 'src/telegram/constants/buttons.constant';
import { Logger } from '@nestjs/common';

const logger = new Logger('WatchlistMenu');

/**
 * Shows the watchlist submenu
 */
export async function showWatchlistMenu(ctx: CustomContext) {
  logger.log('Showing watchlist menu');
  
  const messageText = '📋 *Watchlist Menu*\n\nManage your cryptocurrency watchlists:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Show Watchlists', 'show_watchlist'),
      Markup.button.callback('➕ Create Watchlist', 'create_watchlist')
    ],
    [
      Markup.button.callback('✏️ Rename Watchlist', 'rename_watchlist'),
      Markup.button.callback('🗑️ Delete Watchlist', 'delete_watchlist')
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
 * Registers watchlist menu action handlers in the Telegram service
 * @param bot The Telegram bot instance
 */
export function registerWatchlistMenuHandlers(bot: any) {
  logger.log('Registering watchlist menu handlers');
  
  // Show watchlist menu
  bot.action('watchlist_menu', async (ctx: CustomContext) => {
    await showWatchlistMenu(ctx);
  });
  
  // Action handlers for watchlist operations
  bot.action('show_watchlist', async (ctx: CustomContext) => {
    logger.log('Show watchlist action triggered');
    await ctx.answerCbQuery();
    await ctx.scene.enter('show-watchlist-wizard');
  });
  
  bot.action('create_watchlist', async (ctx: CustomContext) => {
    logger.log('Create watchlist action triggered');
    await ctx.answerCbQuery();
    await ctx.scene.enter('create-watchlist-wizard');
  });
  
  bot.action('rename_watchlist', async (ctx: CustomContext) => {
    logger.log('Rename watchlist action triggered');
    await ctx.answerCbQuery();
    await ctx.scene.enter('rename-watchlist-wizard');
  });
  
  bot.action('delete_watchlist', async (ctx: CustomContext) => {
    logger.log('Delete watchlist action triggered');
    await ctx.answerCbQuery();
    await ctx.scene.enter('delete-watchlist-wizard');
  });
}