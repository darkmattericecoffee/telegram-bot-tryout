// src/telegram/telegram.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, session, Scenes } from 'telegraf';
import { CustomContext } from './interfaces/custom-context.interface';
import { Message } from 'telegraf/types';
import { showMainMenu } from './menus/main.menu/main.menu';
import { showSubMenu } from './menus/sub.menu/sub.menu';
import { exampleWizard } from './wizards/example.wizard/example.wizard';
import { ChartingWizard } from './wizards/charting.wizard';
@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf<CustomContext>;

  constructor(private configService: ConfigService) {
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
  }
  

  async onModuleInit() {
    // Use session middleware and stage for wizard scenes
    this.bot.use(session());
    const stage = new Scenes.Stage<CustomContext>([exampleWizard, ChartingWizard]);
    this.bot.use(stage.middleware());

    await this.setupCommands();

    this.bot.launch({
      dropPendingUpdates: true,
    });

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private async setupCommands() {
    // Start command shows the Main Menu
    this.bot.command('start', async (ctx) => {
      await ctx.reply('Welcome to TrendSniper Bot!');
      await showMainMenu(ctx);
    });

    // Default text handler (optional)
    this.bot.on('text', async (ctx) => {
      await ctx.reply(`Received message: ${ctx.message.text}`);
    });

    // Menu Actions:
    this.bot.action('sub_menu', async (ctx) => {
      await showSubMenu(ctx);
    });

    // Start wizard: entering the example wizard scene.
    this.bot.action('start_wizard', async (ctx) => {
      await ctx.scene.enter('example-wizard');
    });

    this.bot.action('charting_wizard', async (ctx) => {
      await ctx.scene.enter('charting-wizard');
    });

    // Handle general "Other Action"
    this.bot.action('other_action', async (ctx) => {
      await ctx.reply('Other action selected. Returning to Main Menu.');
      await showMainMenu(ctx);
    });

    // Global "Go Back" for non-wizard context:
    this.bot.action('go_back', async (ctx) => {
      // If not in a wizard scene, return to the main menu.
      if (!ctx.scene || !ctx.scene.current) {
        return await showMainMenu(ctx);
      }
      // When in the wizard, the 'go_back' action is handled within the wizard itself.
    });

    // Set bot commands for Telegram client UI
    await this.bot.telegram.setMyCommands([
      {
        command: 'start',
        description: 'Start the TrendSniper Bot',
      },
    ]);
  }

  async sendMessage(chatId: number, message: string): Promise<Message.TextMessage> {
    return this.bot.telegram.sendMessage(chatId, message);
  }
}