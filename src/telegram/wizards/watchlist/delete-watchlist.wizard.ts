// src/telegram/wizards/delete-watchlist.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { ConfirmationComponent, registerConfirmationHandler } from '../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { WatchlistService } from '../../services/watchlist.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';

// Create logger
const logger = new Logger('DeleteWatchlistWizard');

// Initialize components
const confirmationComponent = new ConfirmationComponent();

/**
 * DeleteWatchlistWizard - Allows user to delete an existing watchlist
 */
export const createDeleteWatchlistWizard = (watchlistService: WatchlistService) => {
  const deleteWatchlistWizard = new Scenes.WizardScene<CustomContext>(
    'delete-watchlist-wizard',
    // Step 1: Ask user to select a watchlist to delete
    async (ctx) => {
      logger.log('Step 1: Entering delete watchlist wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        // Get the telegram ID and determine if it's a group
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat for now
        
        // Get watchlists for the user
        const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
        
        if (watchlists.length === 0) {
          await ctx.reply('You don\'t have any watchlists to delete.');
          return ctx.scene.leave();
        }
        
        // Create buttons for each watchlist
        const buttons = watchlists.map(watchlist => {
          return [Markup.button.callback(
            watchlist.name,
            `select_watchlist_to_delete_${watchlist.id}`
          )];
        });
        
        // Add back button
        buttons.push([createGoBackButton()]);
        
        const keyboard = Markup.inlineKeyboard(buttons);
        
        await ctx.reply('⚠️ *Select a watchlist to delete:*', {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
        
        return ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in delete watchlist wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to load watchlists. Please try again.');
        return ctx.scene.leave();
      }
    },
    // Step 2: Confirm deletion
    async (ctx) => {
      // This step is just a placeholder for our action handlers
      return ctx.wizard.next();
    },
    // Step 3: Delete the watchlist
    async (ctx) => {
      logger.log('Step 3: Deleting watchlist');
      
      try {
        const { watchlistId, watchlistName } = ctx.wizard.state.parameters;
        
        if (!watchlistId || !watchlistName) {
          await showErrorToast(ctx, 'Missing watchlist information.');
          return ctx.scene.leave();
        }
        
        // Get the telegram ID and determine if it's a group
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat for now
        
        // Delete the watchlist
        await watchlistService.deleteWatchlist(
          telegramId,
          isGroup,
          watchlistId
        );
        
        await showSuccessToast(ctx, `Watchlist "${watchlistName}" has been deleted!`);
        
        // Display watchlist menu
        const messageText = `Watchlist "${watchlistName}" deleted successfully!`;
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('View Watchlists', 'show_watchlist'),
            Markup.button.callback('Delete Another', 'delete_watchlist')
          ],
          [createGoBackButton()]
        ]);
        
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
        
        return ctx.scene.leave();
      } catch (error) {
        logger.error(`Error deleting watchlist: ${error.message}`);
        await showErrorToast(ctx, 'Failed to delete watchlist. Please try again.');
        return ctx.scene.leave();
      }
    }
  );
  
  // Handle watchlist selection
  deleteWatchlistWizard.action(/^select_watchlist_to_delete_(.+)$/, async (ctx) => {
    try {
      // Extract watchlist ID from callback data
      const match = /^select_watchlist_to_delete_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const watchlistId = match[1];
        logger.log(`Selected watchlist to delete: ${watchlistId}`);
        
        // Get watchlist details
        const watchlist = await watchlistService.getWatchlistById(watchlistId);
        
        // Store watchlist information
        ctx.wizard.state.parameters.watchlistId = watchlistId;
        ctx.wizard.state.parameters.watchlistName = watchlist.name;
        
        // Show confirmation dialog
        const confirmMessage = `⚠️ *Are you sure you want to delete the watchlist "${watchlist.name}"?*\n\nThis action cannot be undone.`;
        
        await confirmationComponent.prompt(ctx, {
          message: confirmMessage,
          confirmButtonText: '🗑️ Delete Permanently',
          confirmCallbackData: 'delete_watchlist_confirm'
        });
        
        return ctx.wizard.next();
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling watchlist selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting watchlist');
      return ctx.scene.leave();
    }
  });
  
  // Register confirmation handler
  registerConfirmationHandler(
    deleteWatchlistWizard,
    'delete_watchlist_confirm',
    async (ctx) => {
      // Forward to the next step in the wizard (delete watchlist)
      const currentIndex = ctx.wizard.cursor;
      // Use the middleware directly instead of accessing private steps
      if (currentIndex < deleteWatchlistWizard.middleware().length) {
        return deleteWatchlistWizard.middleware()[currentIndex](ctx, async () => {});
      }
      return ctx.scene.leave();
    }
  );
  
  // Go back button handler
  deleteWatchlistWizard.action('go_back', async (ctx) => {
    logger.log('Leaving delete watchlist wizard');
    await ctx.scene.leave();
    
    // Return to the watchlist menu
    const messageText = 'Watchlist Menu';
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Show Watchlists', 'show_watchlist'),
        Markup.button.callback('Create Watchlist', 'create_watchlist')
      ],
      [
        Markup.button.callback('Rename Watchlist', 'rename_watchlist'),
        Markup.button.callback('Delete Watchlist', 'delete_watchlist')
      ],
      [createGoBackButton()]
    ]);
    
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(messageText, {
          reply_markup: keyboard.reply_markup,
        });
      } catch (error) {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
        });
      }
    } else {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
      });
    }
  });
  
  return deleteWatchlistWizard;
};