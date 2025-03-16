// src/telegram/telegram.service.ts - Fully refactored alert functionality
import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from './interfaces/custom-context.interface';
import { Message } from 'telegraf/types';
import { showMainMenu } from './menus/main.menu/main.menu';
import { showWatchlistMenu, registerWatchlistMenuHandlers } from './menus/submenus/watchlist.menu';
import { showAnalysisMenu, registerAnalysisMenuHandlers } from './menus/submenus/analysis.menu';
import { showDiscoverMenu, registerDiscoverMenuHandlers } from './menus/submenus/discover.menu';
import { showAlertsMenu, registerAlertsMenuHandlers } from './menus/submenus/alerts.menu';
import { showSubMenu, registerSubMenuHandlers } from './menus/submenus/sub.menu';
import { exampleWizard } from './wizards/example.wizard/example.wizard';
import { ChartingWizard } from './wizards/charting.wizard';
import { ActionButtonsHandler } from './components/action-buttons.component';
import { CoinSearchService } from './services/coin-search.service';
import { AlertService } from './services/alert.service';
import { WatchlistService } from './services/watchlist.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf<CustomContext>;
  private readonly logger = new Logger(TelegramService.name);
  private readonly actionButtonsHandler = new ActionButtonsHandler();
  
  constructor(
    private configService: ConfigService,
    private coinSearchService: CoinSearchService,
    private alertService: AlertService,
    private watchlistService: WatchlistService,
    // Watchlist wizard injections
    @Inject('SHOW_WATCHLIST_WIZARD') private readonly showWatchlistWizard: any,
    @Inject('CREATE_WATCHLIST_WIZARD') private readonly createWatchlistWizard: any,
    @Inject('RENAME_WATCHLIST_WIZARD') private readonly renameWatchlistWizard: any,
    @Inject('DELETE_WATCHLIST_WIZARD') private readonly deleteWatchlistWizard: any,
    @Inject('ADD_TO_WATCHLIST_WIZARD') private readonly addToWatchlistWizard: any,
    // Alert wizard injections - refactored
    @Inject('CREATE_ALERT_WIZARD') private readonly createAlertWizard: any,
    @Inject('SHOW_ALL_ALERTS_WIZARD') private readonly showAllAlertsWizard: any,
  ) {
    this.bot = new Telegraf<CustomContext>(
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
    );
    
    // Add middleware to handle toast
    this.bot.use(async (ctx: CustomContext, next) => {
      ctx.toast = async (message: string) => {
        if (ctx.callbackQuery) {
          try {
            await ctx.answerCbQuery(message, { show_alert: false });
          } catch (error) {
            console.error('Toast error:', error);
          }
        }
      };
      await next();
    });
    this.bot.use((ctx: CustomContext, next) => {
      // First ensure session exists
      if (!ctx.session) {
        ctx.session = {}; // Initialize empty session object if it doesn't exist
      }
      
      // Store injected services in session to ensure they persist between wizard steps
      if ((ctx as any).alertService && !(ctx.session as any).alertService) {
        this.logger.log('Storing alertService in session');
        (ctx.session as any).alertService = (ctx as any).alertService;
      }
      
      if ((ctx as any).watchlistService && !(ctx.session as any).watchlistService) {
        this.logger.log('Storing watchlistService in session');
        (ctx.session as any).watchlistService = (ctx as any).watchlistService;
      }
      
      // Restore services from session if they were previously stored
      if (!(ctx as any).alertService && (ctx.session as any).alertService) {
        this.logger.log('Restoring alertService from session');
        (ctx as any).alertService = (ctx.session as any).alertService;
      }
      
      if (!(ctx as any).watchlistService && (ctx.session as any).watchlistService) {
        this.logger.log('Restoring watchlistService from session');
        (ctx as any).watchlistService = (ctx.session as any).watchlistService;
      }
      
      return next();
    });
  }

  
  
  async onModuleInit() {
    this.logger.log('Initializing Telegram bot');
    
    // Use session middleware and stage for wizard scenes
    this.bot.use(session());
    
    // Add all wizards to the stage
    const stage = new Scenes.Stage<CustomContext>([
      // Example and chart wizards
      exampleWizard, 
      ChartingWizard,
      // Watchlist wizards
      this.showWatchlistWizard,
      this.createWatchlistWizard,
      this.renameWatchlistWizard,
      this.deleteWatchlistWizard,
      this.addToWatchlistWizard,
      // Alert wizards - refactored
      this.createAlertWizard,
      this.showAllAlertsWizard,
    ]);
    
    // Add these new stage exit and enter middleware handlers after creating the stage
    stage.use((ctx, next) => {
      // Ensure session exists
      if (!ctx.session) {
        ctx.session = {};
      }
      
      // When entering a wizard scene, check if we need to restore services
      if (ctx.scene.current) {
        this.logger.log(`Entering scene: ${ctx.scene.current.id}`);
        
        // Services might have been lost during scene transitions - restore them if needed
        if (!(ctx as any).alertService) {
          if ((ctx.session as any).alertService) {
            this.logger.log('Restoring alertService during scene enter');
            (ctx as any).alertService = (ctx.session as any).alertService;
          } else if (this.alertService) {
            this.logger.log('Injecting alertService during scene enter');
            (ctx as any).alertService = this.alertService;
            (ctx.session as any).alertService = this.alertService;
          }
        }
        
        if (!(ctx as any).watchlistService) {
          if ((ctx.session as any).watchlistService) {
            this.logger.log('Restoring watchlistService during scene enter');
            (ctx as any).watchlistService = (ctx.session as any).watchlistService;
          } else if (this.watchlistService) {
            this.logger.log('Injecting watchlistService during scene enter');
            (ctx as any).watchlistService = this.watchlistService;
            (ctx.session as any).watchlistService = this.watchlistService;
          }
        }
      }
      
      return next();
    });
    
    this.bot.use(stage.middleware());
    
    await this.setupCommands();
    
    this.logger.log('Launching bot');
    this.bot.launch({
      dropPendingUpdates: true,
    });
    
    this.logger.log('Bot launched successfully');
    
    process.once('SIGINT', () => {
      this.logger.log('Received SIGINT signal, stopping bot');
      this.bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      this.logger.log('Received SIGTERM signal, stopping bot');
      this.bot.stop('SIGTERM');
    });
  }

  private async setupCommands() {
    this.logger.log('Setting up bot commands and handlers');
    
    // Start command shows the Main Menu
    this.bot.command('start', async (ctx) => {
      await ctx.scene.leave();
      this.logger.log('Start command received');
      await ctx.reply('Welcome to TrendSniper Bot!');
      await showMainMenu(ctx);
    });

    // Direct commands to show specific menus
    this.bot.command('watchlist', async (ctx) => {
      this.logger.log('Watchlist command received');
      await showWatchlistMenu(ctx);
    });
    
    this.bot.command('analysis', async (ctx) => {
      this.logger.log('Analysis command received');
      await showAnalysisMenu(ctx);
    });
    
    this.bot.command('discover', async (ctx) => {
      this.logger.log('Discover command received');
      await showDiscoverMenu(ctx);
    });
    
    this.bot.command('alerts', async (ctx) => {
      this.logger.log('Alerts command received');
      await showAlertsMenu(ctx);
    });
    
    // Add to watchlist command
    this.bot.command('addcoin', async (ctx) => {
      this.logger.log('Add coin command received');
      // Enter the add to watchlist wizard without a predefined coin
      await ctx.scene.enter('add-to-watchlist-wizard');
    });
    
    // Add alert command
    this.bot.command('addalert', async (ctx) => {
      this.logger.log('Add alert command received');
      
      // Inject necessary services
      (ctx as any).alertService = this.alertService;
      (ctx as any).watchlistService = this.watchlistService;
      
      // Enter the create alert wizard
      await ctx.scene.enter('create-alert-wizard');
    });
    
    // Default text handler (optional)
    this.bot.on('text', async (ctx) => {
      await ctx.reply(`Received message: ${ctx.message.text}`);
    });
    
    // Register all menu handlers
    this.logger.log('Registering menu handlers');
    registerWatchlistMenuHandlers(this.bot);
    registerAnalysisMenuHandlers(this.bot);
    registerDiscoverMenuHandlers(this.bot);
    registerSubMenuHandlers(this.bot); // Legacy sub-menu handler
    registerAlertsMenuHandlers(this.bot, this.alertService); // Alert menu handler
    
    // Start wizard: entering the example wizard scene
    this.bot.action('start_wizard', async (ctx) => {
      this.logger.log('Starting example wizard');
      await ctx.scene.enter('example-wizard');
    });
    
    // Charting wizard action
    this.bot.action('charting_wizard', async (ctx) => {
      this.logger.log('Starting charting wizard');
      await ctx.scene.enter('charting-wizard');
    });
    
    // Add coin to watchlist action
    this.bot.action('add_coin_to_watchlist', async (ctx) => {
      this.logger.log('Add coin to watchlist action triggered');
      await ctx.scene.enter('add-to-watchlist-wizard');
    });
    
    // Alert wizard actions - refactored
    this.bot.action('create_alert', async (ctx) => {
      this.logger.log('Create alert action triggered');
      
      // Inject necessary services
      (ctx as any).alertService = this.alertService;
      (ctx as any).watchlistService = this.watchlistService;
      
      await ctx.scene.enter('create-alert-wizard');
    });
    
    this.bot.action('show_all_alerts', async (ctx) => {
      this.logger.log('Show all alerts action triggered');
      
      // Inject alert service
      (ctx as any).alertService = this.alertService;
      
      await ctx.scene.enter('show-all-alerts-wizard');
    });
    
    // Placeholder actions for future alert types
    this.bot.action('create_market_transition_alert', async (ctx) => {
      this.logger.log('Create market transition alert triggered');
      await ctx.answerCbQuery('Market transition alerts coming soon!');
      await ctx.reply('Market transition alert creation is coming soon!');
    });
    
    this.bot.action('create_level_break_alert', async (ctx) => {
      this.logger.log('Create level break alert triggered');
      await ctx.answerCbQuery('Level break alerts coming soon!');
      await ctx.reply('Level break alert creation is coming soon!');
    });
    
    // Handle "Add to Watchlist" button from action buttons
    this.bot.action(/^add_watchlist_(.+)$/, async (ctx) => {
      try {
        // Extract coin ID from the callback data
        const match = /^add_watchlist_(.+)$/.exec(
          ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
        );
        
        if (match) {
          const coinId = match[1];
          this.logger.log(`Add to watchlist action triggered for coin: ${coinId}`);
          
          // Enter the wizard with the coin ID as parameter
          await ctx.answerCbQuery('Opening watchlist selection...');
          
          // Prepare the scene state before entering
          await ctx.scene.enter('add-to-watchlist-wizard', { coinId });
        } else {
          await ctx.answerCbQuery('Invalid coin ID');
        }
      } catch (error) {
        this.logger.error(`Error handling add to watchlist action: ${error.message}`);
        await ctx.answerCbQuery('Error adding to watchlist');
      }
    });
    
    // Handle "Set Alert" button from action buttons
    this.bot.action(/^set_alert_(.+)$/, async (ctx) => {
      try {
        // Extract coin ID from the callback data
        const match = /^set_alert_(.+)$/.exec(
          ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
        );
        
        if (match) {
          const coinId = match[1];
          this.logger.log(`Set alert action triggered for coin: ${coinId}`);
          
          // Inject necessary services
          (ctx as any).alertService = this.alertService;
          (ctx as any).watchlistService = this.watchlistService;
          
          // Search for coin details
          const coin = await this.coinSearchService.getCoinById(coinId);
          
          if (!coin) {
            await ctx.answerCbQuery('Coin not found');
            return;
          }
          
          // Enter the create alert wizard with pre-selected coin
          await ctx.answerCbQuery('Opening alert creation...');
          
          // Prepare parameters for the wizard
          const params = {
            alertType: 'discovery',
            selectedCoin: coin
          };
          
          await ctx.scene.enter('create-alert-wizard', params);
        } else {
          await ctx.answerCbQuery('Invalid coin ID');
        }
      } catch (error) {
        this.logger.error(`Error handling set alert action: ${error.message}`);
        await ctx.answerCbQuery('Error setting up alert');
      }
    });
    
    // Global "Go Back" for non-wizard context
    this.bot.action('go_back', async (ctx) => {
      this.logger.log('Go back action received');
      // If not in a wizard scene, return to the main menu
      if (!ctx.scene || !ctx.scene.current) {
        return await showMainMenu(ctx);
      }
      // When in the wizard, the 'go_back' action is handled within the wizard itself
    });
    
    // Set bot commands for Telegram client UI
    await this.bot.telegram.setMyCommands([
      {
        command: 'start',
        description: 'Start the TrendSniper Bot',
      },
      {
        command: 'watchlist',
        description: 'Manage your watchlists',
      },
      {
        command: 'analysis',
        description: 'Analyze cryptocurrency data',
      },
      {
        command: 'alerts',
        description: 'Manage your price and indicator alerts',
      },
      {
        command: 'discover',
        description: 'Discover new features and coins',
      },
      {
        command: 'addcoin',
        description: 'Add a coin to your watchlist',
      },
      {
        command: 'addalert',
        description: 'Create a new alert',
      },
    ]);
  }

  async sendMessage(chatId: number, message: string): Promise<Message.TextMessage> {
    return this.bot.telegram.sendMessage(chatId, message);
  }
}