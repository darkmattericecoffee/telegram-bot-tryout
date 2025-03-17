// src/telegram/components/action-buttons.component.ts
import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { CustomContext } from '../interfaces/custom-context.interface';
import { Logger } from '@nestjs/common';
import { ParseMode } from 'telegraf/typings/core/types/typegram';
import { createGoBackButton } from '../constants/buttons.constant';

// Create logger for action buttons
const logger = new Logger('ActionButtonsComponent');

// Define button types
export enum ActionButtonType {
  DEFAULT = 'default',
  TRADING = 'trading',
  NEWS = 'news',
  CUSTOM = 'custom',
  ALERTS = 'alerts'
}

// Define button configuration interface
export interface ActionButton {
  label: string;
  action: string;
  url?: string; // Optional URL for web links
}

// Configuration for the action buttons component
export interface ActionButtonsConfig {
  type: ActionButtonType;
  identifier?: string; // Coin ID, news ID, etc.
  customButtons?: ActionButton[]; // For custom button setups
  showBackButton?: boolean; // Whether to show the back button
}

/**
 * Component for adding action buttons to messages
 */
export class ActionButtonsComponent {
  /**
   * Generate buttons based on the specified type and identifier
   */
  generateButtons(config: ActionButtonsConfig): ActionButton[] {
    const { type, identifier } = config;
    const buttons: ActionButton[] = [];
    
    switch (type) {
      case ActionButtonType.DEFAULT:
        // Default set includes CoinGecko and Watchlist
        if (identifier) {
          buttons.push({
            label: '🦎 View on CoinGecko',
            action: `view_coingecko_${identifier}`,
            url: `https://www.coingecko.com/en/coins/${identifier}`
          });
          buttons.push({
            label: '⭐ Add to Watchlist',
            action: `add_watchlist_${identifier}`
          });
        }
        break;
        
      case ActionButtonType.TRADING:
        // Trading-specific buttons
        if (identifier) {
          buttons.push({
            label: '🦎 View on CoinGecko',
            action: `view_coingecko_${identifier}`,
            url: `https://www.coingecko.com/en/coins/${identifier}`
          });
          buttons.push({
            label: '⭐ Add to Watchlist',
            action: `add_watchlist_${identifier}`
          });
          buttons.push({
            label: '🚨 Set Alert',
            action: `set_alert_${identifier}`
          });
        }
        break;
        
      case ActionButtonType.NEWS:
        // News-specific buttons
        if (identifier) {
          buttons.push({
            label: '📰 Full Article',
            action: `view_article_${identifier}`,
            url: `https://crypto.news/article/${identifier}`
          });
          buttons.push({
            label: '🔔 Follow Source',
            action: `follow_source_${identifier}`
          });
        }
        break;
        
      case ActionButtonType.CUSTOM:
        // Custom buttons from configuration
        if (config.customButtons && config.customButtons.length > 0) {
          return config.customButtons;
        }
        break;
    }
    
    return buttons;
  }
  
  /**
   * Create the inline keyboard markup with the buttons
   */
  createMarkup(config: ActionButtonsConfig) {
    const buttons = this.generateButtons(config);
    const keyboard: any[] = [];
    
    // Create rows of buttons (2 per row)
    for (let i = 0; i < buttons.length; i += 2) {
      const row: any[] = [];
      
      // Add first button in the row
      if (buttons[i].url && typeof buttons[i].url === 'string') {
        row.push(Markup.button.url(buttons[i].label, buttons[i].url as string));
      } else {
        row.push(Markup.button.callback(buttons[i].label, buttons[i].action));
      }
      
      // Add second button if it exists
      if (i + 1 < buttons.length) {
        if (buttons[i + 1].url && typeof buttons[i + 1].url === 'string') {
          row.push(Markup.button.url(buttons[i + 1].label, buttons[i + 1].url as string));
        } else {
          row.push(Markup.button.callback(buttons[i + 1].label, buttons[i + 1].action));
        }
      }
      
      keyboard.push(row);
    }
    
    // Add back button if needed
    if (config.showBackButton) {
      keyboard.push([createGoBackButton()]);
    }
    
    return Markup.inlineKeyboard(keyboard);
  }
  
  /**
   * Add action buttons to a photo with caption
   */
  async addButtonsToPhoto(
    ctx: CustomContext,
    imageBuffer: Buffer,
    caption: string,
    config: ActionButtonsConfig
  ): Promise<void> {
    try {
      logger.log(`Adding ${config.type} buttons to photo`);
      const markup = this.createMarkup(config);
      const extra = { caption, parse_mode: 'Markdown' as ParseMode, reply_markup: markup.reply_markup as any };
      
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageMedia(
            {
              type: 'photo',
              media: { source: imageBuffer },
              caption
            },
            { reply_markup: markup.reply_markup as any }
          );
        } catch (error) {
          logger.error(`Failed to edit message: ${error.message}`);
          await ctx.replyWithPhoto(
            { source: imageBuffer },
            extra
          );
        }
      } else {
        await ctx.replyWithPhoto(
          { source: imageBuffer },
          extra
        );
      }
      
      logger.log('Successfully added buttons to photo');
    } catch (error) {
      logger.error(`Error adding buttons to photo: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add action buttons to a text message
   */
  async addButtonsToMessage(
    ctx: CustomContext,
    text: string,
    config: ActionButtonsConfig
  ): Promise<void> {
    try {
      logger.log(`Adding ${config.type} buttons to message`);
      
      const markup = this.createMarkup(config);
      const extra = { parse_mode: 'Markdown' as const, reply_markup: markup.reply_markup as any };
      
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(text, extra);
        } catch (error) {
          logger.error(`Failed to edit message: ${error.message}`);
          await ctx.reply(text, extra);
        }
      } else {
        await ctx.reply(text, extra);
      }
      
      logger.log('Successfully added buttons to message');
    } catch (error) {
      logger.error(`Error adding buttons to message: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Handler for button click actions
 */
export class ActionButtonsHandler {
  /**
   * Handle button click callbacks
   */
  async handleCallback(ctx: CustomContext, action: string): Promise<void> {
    logger.log(`Handling action button callback: ${action}`);
    
    try {
      // Extract action type and identifier
      const [actionType, actionName, ...rest] = action.split('_');
      const identifier = rest.join('_');
      
      if (actionType === 'add' && actionName === 'watchlist') {
        await this.handleAddToWatchlist(ctx, identifier);
      } else if (actionType === 'set' && actionName === 'alert') {
        await this.handleSetAlert(ctx, identifier);
      } else if (actionType === 'follow' && actionName === 'source') {
        await this.handleFollowSource(ctx, identifier);
      } else {
        logger.warn(`Unknown action: ${action}`);
        await ctx.answerCbQuery('This feature is not implemented yet.');
      }
    } catch (error) {
      logger.error(`Error handling callback: ${error.message}`);
      await ctx.answerCbQuery('An error occurred. Please try again.');
    }
  }
  
  /**
   * Handle adding a coin to the watchlist
   */
  private async handleAddToWatchlist(ctx: CustomContext, coinId: string): Promise<void> {
    logger.log(`Adding ${coinId} to watchlist`);
    
    // Here you would add the coin to the user's watchlist in your database
    // This is just a placeholder implementation
    
    // Show a success message
    await ctx.answerCbQuery(`Added ${coinId} to your watchlist!`);
  }
  
  /**
   * Handle setting a price alert
   */
  private async handleSetAlert(ctx: CustomContext, coinId: string): Promise<void> {
    logger.log(`Setting alert for ${coinId}`);
    
    // Placeholder implementation
    await ctx.answerCbQuery(`Price alert feature coming soon!`);
  }
  
  /**
   * Handle following a news source
   */
  private async handleFollowSource(ctx: CustomContext, sourceId: string): Promise<void> {
    logger.log(`Following source ${sourceId}`);
    
    // Placeholder implementation
    await ctx.answerCbQuery(`You are now following this news source!`);
  }
}