// src/telegram/wizards/alerts/show-watchlist-alerts.wizard.ts
import { Scenes } from 'telegraf';
import { Logger } from '@nestjs/common';
import { CustomContext } from '../../interfaces/custom-context.interface';
import { showSuccessToast, showErrorToast } from '../../components/feedback.component';
import { AlertService } from '../../services/alert.service';
import { WatchlistService } from '../../services/watchlist.service';
import { createGoBackButton } from '../../constants/buttons.constant';
import { Markup } from 'telegraf';
import { showAlertsMenu } from '../../menus/sub.menu/alerts.menu';
import { LoadingMessageComponent, withLoading } from '../../components/loading-message.component';

// Create logger
const logger = new Logger('ShowWatchlistAlertsWizard');

// Initialize components
const loadingMessageComponent = new LoadingMessageComponent();

/**
 * ShowWatchlistAlertsWizard - Displays alerts for user's watchlists
 */
export const createShowWatchlistAlertsWizard = (
  alertService: AlertService,
  watchlistService: WatchlistService
) => {
  const showWatchlistAlertsWizard = new Scenes.WizardScene<CustomContext>(
    'show-watchlist-alerts-wizard',
    // Step 1: Show watchlists or all watchlist alerts
    async (ctx) => {
      logger.log('Step 1: Entering show watchlist alerts wizard');
      
      try {
        // Initialize wizard state
        ctx.wizard.state.parameters = {
          currentPage: 1
        };
        
        // Get the telegram ID 
        const telegramId = String(ctx.from?.id || '');
        const isGroup = false; // Assume personal chat
        
        // Show loading indicator while fetching data
        await withLoading(
          ctx,
          async () => {
            // First get the user's watchlists
            const watchlists = await watchlistService.getWatchlists(telegramId, isGroup);
            
            if (watchlists.length === 0) {
              await ctx.reply('You don\'t have any watchlists yet. Create a watchlist first to set alerts on it.');
              await ctx.scene.leave();
              await showAlertsMenu(ctx);
              return;
            }
            
            // Store watchlists in wizard state
            ctx.wizard.state.parameters.watchlists = watchlists;
            
            // Build the message and keyboard
            const messageText = '📋 *Select a watchlist to view alerts:*\n\nOr choose "All Watchlists" to see alerts across all your watchlists.';
            
            // Create buttons for each watchlist
            const buttons = watchlists.map(watchlist => {
              return [Markup.button.callback(
                watchlist.name,
                `select_watchlist_${watchlist.id}`
              )];
            });
            
            // Add "All Watchlists" button
            buttons.unshift([Markup.button.callback('📊 All Watchlists', 'all_watchlists')]);
            
            // Add back button
            buttons.push([createGoBackButton()]);
            
            const keyboard = Markup.inlineKeyboard(buttons);
            
            await ctx.reply(messageText, {
              reply_markup: keyboard.reply_markup,
              parse_mode: 'Markdown'
            });
          },
          {
            messages: [
              'Loading your watchlists...',
              'Fetching watchlist data...',
              'Getting your watchlist information...'
            ],
            emoji: '📋'
          }
        );
        
        ctx.wizard.next();
      } catch (error) {
        logger.error(`Error in show watchlist alerts wizard: ${error.message}`);
        await showErrorToast(ctx, 'Failed to load watchlists. Please try again.');
        await ctx.scene.leave();
        await showAlertsMenu(ctx);
      }
    },
    
    // Step 2: Show alerts for the selected watchlist
    async (ctx) => {
      // This step is just for handling actions
      return ctx.wizard.next();
    },

    // Step 3: Handle alert actions
    async (ctx) => {
      // This step handles actions like create/delete alerts
      return;
    }
  );
  
  // Handler for selecting a specific watchlist
  showWatchlistAlertsWizard.action(/^select_watchlist_(.+)$/, async (ctx) => {
    try {
      // Extract watchlist ID from callback data
      const match = /^select_watchlist_(.+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const watchlistId = match[1];
        logger.log(`Selected watchlist ID: ${watchlistId}`);
        
        // Get watchlist details
        const watchlists = ctx.wizard.state.parameters.watchlists || [];
        const selectedWatchlist = watchlists.find(w => w.id === watchlistId);
        
        if (!selectedWatchlist) {
          await ctx.answerCbQuery('Watchlist not found');
          return;
        }
        
        // Store selected watchlist
        ctx.wizard.state.parameters.selectedWatchlistId = watchlistId;
        ctx.wizard.state.parameters.selectedWatchlistName = selectedWatchlist.name;
        
        // Show alerts for this watchlist
        await displayWatchlistAlerts(ctx, alertService, watchlistId, selectedWatchlist.name);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling watchlist selection: ${error.message}`);
      await ctx.answerCbQuery('Error loading watchlist');
    }
  });
  
  // Handler for "All Watchlists" button
  showWatchlistAlertsWizard.action('all_watchlists', async (ctx) => {
    logger.log('All watchlists selected');
    
    try {
      // Show alerts for all watchlists
      await displayWatchlistAlerts(ctx, alertService);
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error showing all watchlist alerts: ${error.message}`);
      await ctx.answerCbQuery('Error loading alerts');
    }
  });
  
  // Handler for creating an alert
  showWatchlistAlertsWizard.action('create_alert', async (ctx) => {
    logger.log('Create alert action triggered');
    
    try {
      // Get the selected watchlist ID if any
      const watchlistId = ctx.wizard.state.parameters.selectedWatchlistId;
      
      // Leave this scene
      await ctx.scene.leave();
      
      // Enter create alert wizard with watchlist ID if available
      if (watchlistId) {
        await ctx.scene.enter('create-alert-wizard', { 
          watchlistId: watchlistId
        });
      } else {
        // If no watchlist selected, just enter the create alert wizard
        await ctx.scene.enter('create-alert-wizard');
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error transitioning to create alert wizard: ${error.message}`);
      await ctx.answerCbQuery('Error starting alert creation');
    }
  });

  // Handler for deleting an alert
  showWatchlistAlertsWizard.action('delete_alert', async (ctx) => {
    logger.log('Delete alert action triggered');
    
    try {
      // Leave this scene
      await ctx.scene.leave();
      
      // Enter delete alert wizard with filter set to watchlist
      await ctx.scene.enter('delete-alert-wizard', { 
        alertType: 'watchlist' 
      });
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error transitioning to delete alert wizard: ${error.message}`);
      await ctx.answerCbQuery('Error starting alert deletion');
    }
  });

  // Pagination handler for alerts
  showWatchlistAlertsWizard.action(/^alerts_page_(\d+)$/, async (ctx) => {
    try {
      // Extract page number from callback data
      const match = /^alerts_page_(\d+)$/.exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (match) {
        const page = parseInt(match[1], 10);
        logger.log(`Navigating to alerts page ${page}`);
        
        // Update current page in wizard state
        ctx.wizard.state.parameters.currentPage = page;
        
        // Get watchlist details
        const watchlistId = ctx.wizard.state.parameters.selectedWatchlistId;
        const watchlistName = ctx.wizard.state.parameters.selectedWatchlistName;
        
        // Display alerts for the requested page
        await displayWatchlistAlerts(ctx, alertService, watchlistId, watchlistName, page);
      }
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pagination: ${error.message}`);
      await ctx.answerCbQuery('Error loading page');
    }
  });

  // Handler for refreshing alerts
  showWatchlistAlertsWizard.action('refresh_alerts', async (ctx) => {
    try {
      logger.log('Refreshing alerts');
      
      // Get watchlist details
      const watchlistId = ctx.wizard.state.parameters.selectedWatchlistId;
      const watchlistName = ctx.wizard.state.parameters.selectedWatchlistName;
      
      // Get the current page from state or default to 1
      const currentPage = ctx.wizard.state.parameters?.currentPage || 1;
      
      // Refresh with current settings
      await displayWatchlistAlerts(ctx, alertService, watchlistId, watchlistName, currentPage);
      
      await ctx.answerCbQuery('Alerts refreshed');
    } catch (error) {
      logger.error(`Error refreshing alerts: ${error.message}`);
      await ctx.answerCbQuery('Error refreshing data');
    }
  });
  
  // Go back button handler
  showWatchlistAlertsWizard.action('go_back', async (ctx) => {
    logger.log('Leaving show watchlist alerts wizard');
    await ctx.scene.leave();
    
    // Return to the alerts menu
    await showAlertsMenu(ctx);
  });
  
  return showWatchlistAlertsWizard;
};

/**
 * Helper function to display watchlist alerts
 * @param ctx The context object
 * @param alertService The alert service
 * @param watchlistId Optional watchlist ID to filter alerts
 * @param watchlistName Optional watchlist name for display
 * @param page Optional page number for pagination
 */
async function displayWatchlistAlerts(
  ctx: CustomContext, 
  alertService: AlertService,
  watchlistId?: string,
  watchlistName?: string,
  page: number = 1
) {
  logger.log(`Displaying watchlist alerts${watchlistId ? ` for watchlist ${watchlistId}` : ' for all watchlists'} (page ${page})`);
  
  try {
    // Get the telegram ID
    const telegramId = String(ctx.from?.id || '');
    const isGroup = false; // Assume personal chat
    
    // Show loading message while fetching alerts
    await withLoading(
      ctx,
      async () => {
        // Get alerts for the selected watchlist or all watchlists
        const alerts = await alertService.getWatchlistAlerts(telegramId, watchlistId);
        
        // Check if we have any alerts
        if (alerts.length === 0) {
          const noAlertsText = watchlistId 
            ? `No alerts found for watchlist "${watchlistName}".` 
            : 'No watchlist alerts found.';
            
          const addAlertButton = Markup.button.callback('➕ Create Alert', 'create_alert');
          const keyboard = Markup.inlineKeyboard([
            [addAlertButton],
            [createGoBackButton()]
          ]);
          
          await ctx.reply(noAlertsText, {
            reply_markup: keyboard.reply_markup
          });
          return;
        }
        
        // Calculate pagination
        const PAGE_SIZE = 10; // Show 10 alerts per page
        const totalPages = Math.ceil(alerts.length / PAGE_SIZE);
        
        // Ensure page is within bounds
        const currentPage = Math.max(1, Math.min(page, totalPages));
        
        // Get alerts for current page
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, alerts.length);
        const pageAlerts = alerts.slice(startIdx, endIdx);
        
        // Prepare the alerts message
        let messageText = watchlistId 
          ? `🔔 *Alerts for "${watchlistName}"*\n\n` 
          : '🔔 *All Watchlist Alerts*\n\n';
        
        // Get alert limits
        const limits = alertService.getAlertsLimits();
        
        // Add alert limit info
        messageText += `Alert limit: ${alerts.length}/${limits.watchlistLimit} per watchlist\n\n`;
        
        // Add pagination info if needed
        if (totalPages > 1) {
          messageText += `Page ${currentPage} of ${totalPages}\n\n`;
        }
        
        // Group alerts by watchlist if showing all
        const alertsByWatchlist = {};
        
        pageAlerts.forEach(alert => {
          const watchlistName = alert.watchlistName || 'Unknown Watchlist';
          
          if (!alertsByWatchlist[watchlistName]) {
            alertsByWatchlist[watchlistName] = [];
          }
          
          alertsByWatchlist[watchlistName].push(alert);
        });
        
        // Format alerts
        if (!watchlistId) {
          // Show grouped by watchlist
          Object.keys(alertsByWatchlist).forEach(name => {
            messageText += `*${name}:*\n`;
            
            alertsByWatchlist[name].forEach(alert => {
              const typeName = AlertService.getAlertTypeName(alert.alertType);
              const timeframeName = AlertService.getTimeFrameName(alert.timeframe);
              
              messageText += `• ${alert.coinName || alert.coinIdentifier} (${alert.coinSymbol || '?'}) - ${typeName}: ${alert.threshold} (${timeframeName})\n`;
            });
            
            messageText += '\n';
          });
        } else {
          // Show alerts for single watchlist
          pageAlerts.forEach(alert => {
            const typeName = AlertService.getAlertTypeName(alert.alertType);
            const timeframeName = AlertService.getTimeFrameName(alert.timeframe);
            
            messageText += `• ${alert.coinName || alert.coinIdentifier} (${alert.coinSymbol || '?'}) - ${typeName}: ${alert.threshold} (${timeframeName})\n`;
          });
        }
        
        // Create buttons for alert management and pagination
        const manageButtons = [
          [
            Markup.button.callback('➕ Add Alert', 'create_alert'),
            Markup.button.callback('🗑️ Delete Alert', 'delete_alert')
          ]
        ];
        
        // Add pagination buttons if needed
        if (totalPages > 1) {
          const paginationButtons: any[] = [];
          
          if (currentPage > 1) {
            paginationButtons.push(Markup.button.callback('◀️ Previous', `alerts_page_${currentPage - 1}`));
          }
          
          if (currentPage < totalPages) {
            paginationButtons.push(Markup.button.callback('Next ▶️', `alerts_page_${currentPage + 1}`));
          }
          
          manageButtons.push(paginationButtons);
        }
        
        // Add refresh button
        manageButtons.push([
          Markup.button.callback('🔄 Refresh', 'refresh_alerts')
        ]);
        
        // Add back button
        manageButtons.push([createGoBackButton()]);
        
        const keyboard = Markup.inlineKeyboard(manageButtons.flat());
        
        // Send the formatted message
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown'
        });
      },
      {
        messages: [
          'Loading your alerts...',
          'Fetching alert data...',
          'Getting your alert information...'
        ],
        emoji: '🔔'
      }
    );
  } catch (error) {
    logger.error(`Error displaying watchlist alerts: ${error.message}`);
    throw error; // Rethrow to be caught by the action handler
  }
}