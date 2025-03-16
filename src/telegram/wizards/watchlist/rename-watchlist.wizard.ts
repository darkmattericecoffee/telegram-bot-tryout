// src/telegram/wizards/watchlist/rename-watchlist.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { TextInputComponent, registerTextInputHandlers } from '../../components/text-input.component';
import { ConfirmationComponent, registerConfirmationHandler } from '../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../components/toast.component';
import { WatchlistService } from '../../services/watchlist.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showWatchlistMenu } from '../../menus/submenus/watchlist.menu';

// Create logger
const logger = new Logger('RenameWatchlistWizard');

// Initialize components
const textInputComponent = new TextInputComponent();
const confirmationComponent = new ConfirmationComponent();

/**
 * RenameWatchlistWizard - Allows user to rename an existing watchlist
 */
export const createRenameWatchlistWizard = (watchlistService: WatchlistService) => {
  const renameWatchlistWizard = new Scenes.WizardScene<CustomContext>(
    'rename-watchlist-wizard',
    // Step 1: Ask user to select a watchlist to rename
    async (ctx) => {
      logger.log('Step 1: Entering rename watchlist wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        // Get the telegram ID and determine if it's a group
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat for now
        
        // Get watchlists for the user
        const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
        
        if (watchlists.length === 0) {
          await ctx.reply('You don\'t have any watchlists to rename. Create one first!');
          ctx.scene.leave();
          await showWatchlistMenu(ctx);
          return;
        }
        
        // Create buttons for each watchlist
        const buttons = watchlists.map(watchlist => {
          return [Markup.button.callback(
            watchlist.name,
            `select_watchlist_${watchlist.id}`
          )];
        });
        
        // Add back button
        buttons.push([createGoBackButton()]);
        
        const keyboard = Markup.inlineKeyboard(buttons);
        
        await ctx.reply('Select a watchlist to rename:', {
          reply_markup: keyboard.reply_markup
        });
        
        ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in rename watchlist wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to load watchlists. Please try again.');
        ctx.scene.leave();
        await showWatchlistMenu(ctx);
      }
    },
    // Step 2: Ask for new name
    async (ctx) => {
      // This step is just a placeholder for our action handlers
      ctx.wizard.next();
    },
    // Step 3: Handle text input and confirm
    async (ctx) => {
      // This step is just a placeholder for our text input handlers
      ctx.wizard.next();
    },
    // Step 4: Rename the watchlist
    async (ctx) => {
      logger.log('Step 4: Renaming watchlist');
      
      try {
        const { watchlistId, newWatchlistName, currentWatchlistName } = ctx.wizard.state.parameters;
        
        if (!watchlistId || !newWatchlistName) {
          await showErrorToast(ctx, 'Missing watchlist information.');
          ctx.scene.leave();
          await showWatchlistMenu(ctx);
          return;
        }
        
        // Get the telegram ID and determine if it's a group
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat for now
        
        // Rename the watchlist
        const updatedWatchlist = await watchlistService.renameWatchlist(
          telegramId,
          isGroup,
          watchlistId,
          newWatchlistName
        );
        
        await showSuccessToast(ctx, `Watchlist renamed from "${currentWatchlistName}" to "${newWatchlistName}"!`);
        
        // Display success message
        await ctx.reply(`Watchlist renamed successfully!`);
        
        // Return to watchlist menu
        await showWatchlistMenu(ctx);
        
        ctx.scene.leave();
      } catch (error) {
        logger.error(`Error renaming watchlist: ${error.message}`);
        await showErrorToast(ctx, 'Failed to rename watchlist. Please try again.');
        ctx.scene.leave();
        await showWatchlistMenu(ctx);
      }
    }
  );
  
  // Handle watchlist selection
  renameWatchlistWizard.action(/^select_watchlist_(.+)$/, async (ctx) => {
    try {
      // Extract watchlist ID from callback data
      const match = /^select_watchlist_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const watchlistId = match[1];
        logger.log(`Selected watchlist ID: ${watchlistId}`);
        
        // Get watchlist details
        const watchlist = await watchlistService.getWatchlistById(watchlistId);
        
        // Store watchlist information
        ctx.wizard.state.parameters.watchlistId = watchlistId;
        ctx.wizard.state.parameters.currentWatchlistName = watchlist.name;
        
        // Ask for new name
        const textInputConfig = {
          question: `📝 *Enter a new name for "${watchlist.name}":*\n\nType a name below.`,
          fieldName: 'newWatchlistName'
        };
        
        await textInputComponent.prompt(ctx, textInputConfig);
        ctx.wizard.selectStep(2);
        return;
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling watchlist selection: ${error.message}`);
      await ctx.answerCbQuery('Error selecting watchlist');
      ctx.scene.leave();
      await showWatchlistMenu(ctx);
    }
  });
  
  // Register text input handler for the new watchlist name
  registerTextInputHandlers(
    renameWatchlistWizard,
    'newWatchlistName',
    async (ctx) => {
      const newWatchlistName = ctx.wizard.state.parameters.newWatchlistName;
      const currentWatchlistName = ctx.wizard.state.parameters.currentWatchlistName;
      
      // Show confirmation dialog
      const confirmMessage = `Are you sure you want to rename "${currentWatchlistName}" to "${newWatchlistName}"?`;
      
      await confirmationComponent.prompt(ctx, {
        message: confirmMessage,
        confirmButtonText: '✅ Rename Watchlist',
        confirmCallbackData: 'rename_watchlist_confirm'
      });
      
      ctx.wizard.selectStep(3);
    }
  );
  
  // Register confirmation handler
  registerConfirmationHandler(
    renameWatchlistWizard,
    'rename_watchlist_confirm',
    async (ctx) => {
      // Forward to the next step in the wizard (rename watchlist)
      const currentIndex = ctx.wizard.cursor;
      // Use the middleware directly instead of accessing private steps
      if (currentIndex < renameWatchlistWizard.middleware().length) {
        await renameWatchlistWizard.middleware()[currentIndex](ctx, async () => {});
      } else {
        ctx.scene.leave();
        await showWatchlistMenu(ctx);
      }
    }
  );
  
  // Go back button handler
  renameWatchlistWizard.action('go_back', async (ctx) => {
    logger.log('Leaving rename watchlist wizard');
    await ctx.scene.leave();
    
    // Return to the watchlist menu
    await showWatchlistMenu(ctx);
  });
  
  return renameWatchlistWizard;
};