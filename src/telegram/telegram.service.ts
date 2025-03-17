// src/telegram/telegram.service.ts - Fully refactored service with Discovery updates
import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from './interfaces/custom-context.interface';
import { Message } from 'telegraf/types';

import { showMainMenu } from './menus/main.menu/main.menu';
import { showWatchlistMenu, registerWatchlistMenuHandlers } from './menus/submenus/watchlist.menu';
import { showAnalysisMenu, registerAnalysisMenuHandlers } from './menus/submenus/analysis.menu';
import { showAlertsMenu, registerAlertsMenuHandlers } from './menus/submenus/alerts.menu';
import { showSubMenu, registerSubMenuHandlers } from './menus/submenus/sub.menu';
import { exampleWizard } from './wizards/example.wizard/example.wizard';
import { ChartingWizard } from './wizards/charting.wizard';
import { ActionButtonsHandler } from './components/action-buttons.component';
import { CoinSearchService } from './services/coin-search.service';
import { AlertService } from './services/alert.service';
import { WatchlistService } from './services/watchlist.service';

// Discovery related imports
import { showDiscoverMenu, registerDiscoveryMenuHandlers } from './menus/submenus/discover.menu';
import { DiscoveryService } from './services/discovery.service';

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
    private discoveryService: DiscoveryService,

    // Watchlist wizard injections
    @Inject('SHOW_WATCHLIST_WIZARD') private readonly showWatchlistWizard: any,
    @Inject('CREATE_WATCHLIST_WIZARD') private readonly createWatchlistWizard: any,
    @Inject('RENAME_WATCHLIST_WIZARD') private readonly renameWatchlistWizard: any,
    @Inject('DELETE_WATCHLIST_WIZARD') private readonly deleteWatchlistWizard: any,
    @Inject('ADD_TO_WATCHLIST_WIZARD') private readonly addToWatchlistWizard: any,
    
    // Alert wizard injections - refactored
    @Inject('CREATE_ALERT_WIZARD') private readonly createAlertWizard: any,
    @Inject('SHOW_ALL_ALERTS_WIZARD') private readonly showAllAlertsWizard: any,
    
    // Discovery wizard injections
    @Inject('STRENGTH_WIZARD') private readonly strengthWizard: any,
    @Inject('LATEST_SIGNALS_WIZARD') private readonly latestSignalsWizard: any,
  ) {
    this.bot = new Telegraf<CustomContext>(
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
    );
    
    // Global middleware for toast notifications and session initialization
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
      if (!ctx.session) {
        ctx.session = {};
      }
      
      // Persist alertService and watchlistService in session
      if ((ctx as any).alertService && !(ctx.session as any).alertService) {
        this.logger.log('Storing alertService in session');
        (ctx.session as any).alertService = (ctx as any).alertService;
      }
      
      if ((ctx as any).watchlistService && !(ctx.session as any).watchlistService) {
        this.logger.log('Storing watchlistService in session');
        (ctx.session as any).watchlistService = (ctx as any).watchlistService;
      }
      
      // Restore services if missing
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
  
    // 1. Ensure session middleware is added first.
    this.bot.use(session());
  
    // 2. Create a stage with all wizard scenes.
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
      // Alert wizards
      this.createAlertWizard,
      this.showAllAlertsWizard,
      // Discovery wizards
      this.strengthWizard,
      this.latestSignalsWizard,
    ]);
  
    // 3. Middleware to restore/inject services when entering a scene.
    stage.use((ctx, next) => {
      // Ensure session exists.
      if (!ctx.session) {
        ctx.session = {};
      }
      if (ctx.scene.current) {
        this.logger.log(`Entering scene: ${ctx.scene.current.id}`);
  
        // Restore alertService if missing.
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
  
        // Restore watchlistService if missing.
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
  
        // Restore discoveryService if missing.
        if (!(ctx as any).discoveryService) {
          if ((ctx.session as any).discoveryService) {
            this.logger.log('Restoring discoveryService during scene enter');
            (ctx as any).discoveryService = (ctx.session as any).discoveryService;
          } else if (this.discoveryService) {
            this.logger.log('Injecting discoveryService during scene enter');
            (ctx as any).discoveryService = this.discoveryService;
            (ctx.session as any).discoveryService = this.discoveryService;
          }
        }
      }
      return next();
    });
  
    // 4. Use the stage middleware.
    this.bot.use(stage.middleware());
  
    // 5. Setup commands and other handlers.
    await this.setupCommands();
  
    // 6. Launch the bot.
    this.logger.log('Launching bot');
    await this.bot.launch({
      dropPendingUpdates: true,
    });
    this.logger.log('Bot launched successfully');
  
    // 7. Handle graceful shutdown.
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
    
    // Main menu command
    this.bot.command('start', async (ctx) => {
      await ctx.scene.leave();
      this.logger.log('Start command received');
      await ctx.reply('Welcome to TrendSniper Bot!');
      await showMainMenu(ctx);
    });

    // Watchlist, Analysis, and Alerts commands
    this.bot.command('watchlist', async (ctx) => {
      this.logger.log('Watchlist command received');
      await showWatchlistMenu(ctx);
    });
    
    this.bot.command('analysis', async (ctx) => {
      this.logger.log('Analysis command received');
      await showAnalysisMenu(ctx);
    });
    
    this.bot.command('alerts', async (ctx) => {
      this.logger.log('Alerts command received');
      await showAlertsMenu(ctx);
    });
    
    // Add coin and alert commands
    this.bot.command('addcoin', async (ctx) => {
      this.logger.log('Add coin command received');
      await ctx.scene.enter('add-to-watchlist-wizard');
    });
    
    this.bot.command('addalert', async (ctx) => {
      this.logger.log('Add alert command received');
      (ctx as any).alertService = this.alertService;
      (ctx as any).watchlistService = this.watchlistService;
      await ctx.scene.enter('create-alert-wizard');
    });
    
    // Discovery command and handlers
    registerDiscoveryMenuHandlers(this.bot, this.discoveryService);
    
    this.bot.action('strength_wizard', async (ctx) => {
      this.logger.log('Strength wizard action triggered');
      (ctx as any).discoveryService = this.discoveryService;
      await ctx.scene.enter('strength-wizard');
    });
    
    this.bot.action('latest_signals_wizard', async (ctx) => {
      this.logger.log('Latest signals wizard action triggered');
      (ctx as any).discoveryService = this.discoveryService;
      await ctx.scene.enter('latest-signals-wizard');
    });
    
    this.bot.command('discover', async (ctx) => {
      this.logger.log('Discover command received');
      await showDiscoverMenu(ctx);
    });
    
    // Default text handler
    this.bot.on('text', async (ctx) => {
      await ctx.reply(`Received message: ${ctx.message.text}`);
    });
    
    // Register remaining menu handlers
    this.logger.log('Registering additional menu handlers');
    registerWatchlistMenuHandlers(this.bot);
    registerAnalysisMenuHandlers(this.bot);
    registerSubMenuHandlers(this.bot);
    registerAlertsMenuHandlers(this.bot, this.alertService);
    
    // Additional wizard actions
    this.bot.action('start_wizard', async (ctx) => {
      this.logger.log('Starting example wizard');
      await ctx.scene.enter('example-wizard');
    });
    
    this.bot.action('charting_wizard', async (ctx) => {
      this.logger.log('Starting charting wizard');
      await ctx.scene.enter('charting-wizard');
    });
    
    this.bot.action('add_coin_to_watchlist', async (ctx) => {
      this.logger.log('Add coin to watchlist action triggered');
      await ctx.scene.enter('add-to-watchlist-wizard');
    });
    
    this.bot.action('create_alert', async (ctx) => {
      this.logger.log('Create alert action triggered');
      (ctx as any).alertService = this.alertService;
      (ctx as any).watchlistService = this.watchlistService;
      await ctx.scene.enter('create-alert-wizard');
    });
    
    this.bot.action('show_all_alerts', async (ctx) => {
      this.logger.log('Show all alerts action triggered');
      (ctx as any).alertService = this.alertService;
      await ctx.scene.enter('show-all-alerts-wizard');
    });
    
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
    
    // Handle "Add to Watchlist" action with dynamic coinId extraction
    this.bot.action(/^add_watchlist_(.+)$/, async (ctx) => {
      try {
        const match = /^add_watchlist_(.+)$/.exec(
          ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
        );
        
        if (match) {
          const coinId = match[1];
          this.logger.log(`Add to watchlist action triggered for coin: ${coinId}`);
          await ctx.answerCbQuery('Opening watchlist selection...');
          await ctx.scene.enter('add-to-watchlist-wizard', { coinId });
        } else {
          await ctx.answerCbQuery('Invalid coin ID');
        }
      } catch (error) {
        this.logger.error(`Error handling add to watchlist action: ${error.message}`);
        await ctx.answerCbQuery('Error adding to watchlist');
      }
    });
    
    // Handle "Set Alert" action with dynamic coinId extraction
    this.bot.action(/^set_alert_(.+)$/, async (ctx) => {
      try {
        const match = /^set_alert_(.+)$/.exec(
          ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
        );
        
        if (match) {
          const coinId = match[1];
          this.logger.log(`Set alert action triggered for coin: ${coinId}`);
          (ctx as any).alertService = this.alertService;
          (ctx as any).watchlistService = this.watchlistService;
          const coin = await this.coinSearchService.getCoinById(coinId);
          
          if (!coin) {
            await ctx.answerCbQuery('Coin not found');
            return;
          }
          
          await ctx.answerCbQuery('Opening alert creation...');
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
    
    // Global "Go Back" action for returning to main menu
    this.bot.action('go_back', async (ctx) => {
      this.logger.log('Go back action received');
      if (!ctx.scene || !ctx.scene.current) {
        return await showMainMenu(ctx);
      }
    });
    
    // Set bot commands for Telegram client UI
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the TrendSniper Bot' },
      { command: 'watchlist', description: 'Manage your watchlists' },
      { command: 'analysis', description: 'Analyze cryptocurrency data' },
      { command: 'alerts', description: 'Manage your price and indicator alerts' },
      { command: 'discover', description: 'Discover new features and coins' },
      { command: 'addcoin', description: 'Add a coin to your watchlist' },
      { command: 'addalert', description: 'Create a new alert' },
    ]);
  }

  async sendMessage(chatId: number, message: string): Promise<Message.TextMessage> {
    return this.bot.telegram.sendMessage(chatId, message);
  }
}