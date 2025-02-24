// src/telegram/telegram.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { CustomContext } from './interfaces/custom-context.interface/custom-context.interface.interface';
import { Message } from 'telegraf/types';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf<CustomContext>;

  constructor(private configService: ConfigService) {
    this.bot = new Telegraf<CustomContext>(
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
    );
  }

  async onModuleInit() {
    await this.setupCommands();

    this.bot.launch({
      dropPendingUpdates: true,
    });

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private async setupCommands() {
    this.bot.command('start', async (ctx: CustomContext) => {
      await ctx.reply('Welcome to the bot!');
    });

    this.bot.on('text', async (ctx: CustomContext) => {
      await ctx.reply(`Received message: ${ctx.message.text}`);
    });

    await this.bot.telegram.setMyCommands([
      {
        command: 'start',
        description: 'Start the bot',
      },
    ]);
  }

  async sendMessage(chatId: number, message: string): Promise<Message.TextMessage> {
    return this.bot.telegram.sendMessage(chatId, message);
  }
}