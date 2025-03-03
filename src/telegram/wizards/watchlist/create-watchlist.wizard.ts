import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { TextInputComponent, registerTextInputHandlers } from '../../components/text-input.component';
import { ConfirmationComponent, registerConfirmationHandler } from '../../components/confirmation.component';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { WatchlistService } from '../../services/watchlist.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';

// Create logger
const logger = new Logger('CreateWatchlistWizard');

// Initialize components
const textInputComponent = new TextInputComponent();
const confirmationComponent = new ConfirmationComponent();

/**
 * CreateWatchlistWizard - Allows user to create a new watchlist
 */
export const createCreateWatchlistWizard = (watchlistService: WatchlistService) => {
  const createWatchlistWizard = new Scenes.WizardScene<CustomContext>(
    'create-watchlist-wizard',
    // Step 1: Ask for watchlist name
    async (ctx) => {
      logger.log('Step 1: Entering create watchlist wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {};
        
        const textInputConfig = {
          question: '📝 *Enter a name for your new watchlist:*\n\nType a name below.',
          fieldName: 'watchlistName'
        };
        
        await textInputComponent.prompt(ctx, textInputConfig);
        ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in create watchlist wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to start wizard. Please try again.');
        ctx.scene.leave();
      }
    },
    // Step 2: Handle text input and confirm
    async (ctx) => {
      logger.log('Step 2: Confirmation step');
      
      // This step doesn't directly handle messages,
      // it's just a transition for registerTextInputHandlers
      ctx.wizard.next();
    },
    // Step 3: Create watchlist
    async (ctx) => {
      logger.log('Step 3: Creating watchlist');
      
      try {
        const watchlistName = ctx.wizard.state.parameters.watchlistName;
        
        if (!watchlistName) {
          await showErrorToast(ctx, 'No watchlist name provided.');
          ctx.scene.leave();
          return;
        }
        
        // Get the telegram ID and determine if it's a group
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat for now
        
        // Create the watchlist
        const newWatchlist = await watchlistService.createWatchlist(
          telegramId,
          isGroup,
          watchlistName
        );
        
        await showSuccessToast(ctx, `Watchlist "${watchlistName}" has been created!`);
        
        // Display watchlist menu
        const messageText = `Watchlist "${watchlistName}" created successfully!`;
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('View Watchlists', 'show_watchlist'),
            Markup.button.callback('Create Another', 'create_watchlist')
          ],
          [createGoBackButton()]
        ]);
        
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
        
        ctx.scene.leave();
      } catch (error) {
        logger.error(`Error creating watchlist: ${error.message}`);
        await showErrorToast(ctx, 'Failed to create watchlist. Please try again.');
        ctx.scene.leave();
      }
    }
  );
  
  // Register text input handler for the watchlist name
  registerTextInputHandlers(
    createWatchlistWizard,
    'watchlistName',
    async (ctx) => {
      const watchlistName = ctx.wizard.state.parameters.watchlistName;
      
      // Show confirmation dialog
      const confirmMessage = `Are you sure you want to create a watchlist named "${watchlistName}"?`;
      
      await confirmationComponent.prompt(ctx, {
        message: confirmMessage,
        confirmButtonText: '✅ Create Watchlist',
        confirmCallbackData: 'create_watchlist_confirm'
      });
      
      ctx.wizard.selectStep(2);
    }
  );
  
  // Register confirmation handler
  registerConfirmationHandler(
    createWatchlistWizard,
    'create_watchlist_confirm',
    async (ctx) => {
      // Forward to the next step in the wizard (create watchlist)
      const currentIndex = ctx.wizard.cursor;
      // Use the step at the current cursor position directly instead of accessing private steps
      if (currentIndex < createWatchlistWizard.middleware().length) {
        await createWatchlistWizard.middleware()[currentIndex](ctx, async () => {});
      } else {
        ctx.scene.leave();
      }
    }
  );
  
  // Go back button handler
  createWatchlistWizard.action('go_back', async (ctx) => {
    logger.log('Leaving create watchlist wizard');
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
  
  return createWatchlistWizard;
};