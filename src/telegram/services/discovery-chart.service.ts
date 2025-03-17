// src/telegram/services/discovery-chart.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CustomContext } from '../interfaces/custom-context.interface';
import { ChartImageService } from './chart-image.service';
import { Markup } from 'telegraf';
import { ActionButtonType } from '../components/action-buttons.component';

@Injectable()
export class DiscoveryChartService {
  private readonly logger = new Logger(DiscoveryChartService.name);
  private readonly chartImageService: ChartImageService;
  
  constructor() {
    this.chartImageService = new ChartImageService();
  }
  
  /**
   * Sends multiple chart responses for discovery results as completely separate messages
   * @param ctx The Telegram context
   * @param coins Array of coin data to display
   * @param additionalInfo Optional string to add to each caption
   */
  async sendMultipleCharts(
    ctx: CustomContext, 
    coins: any[], 
    additionalInfo: string = ''
  ): Promise<void> {
    this.logger.log(`Sending ${coins.length} charts as separate individual messages`);
    
    // Limit to maximum 5 coins to prevent spam
    const coinsToDisplay = coins.slice(0, 5);
    
    for (const coin of coinsToDisplay) {
      try {
        // Generate chart image
        const imageBuffer = await this.chartImageService.generateMockChart(
          coin.name,
          coin.pairing,
          coin.timeframe
        );
        
        // Create caption with score and additional info
        let caption = `📊 *${coin.name} (${coin.symbol})*\n`;
        caption += `Score: \`${coin.score.toFixed(2)}\`\n`;
        caption += `Pair: ${coin.pairing} | TF: ${coin.timeframe}\n`;
        
        if (coin.direction) {
          caption += `Direction: ${coin.direction}\n`;
        }
        
        if (additionalInfo) {
          caption += `\n${additionalInfo}`;
        }
        
        // Create action buttons for the coin based on ActionButtonType
        const actionButtons = this.createActionButtons(coin.id, ActionButtonType.TRADING);
        
        // Send a completely new message with chart for each coin
        await ctx.replyWithPhoto(
          { source: imageBuffer },
          {
            caption,
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup
          }
        );
        
        // Add a delay between messages to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        this.logger.error(`Error generating chart for ${coin.name}: ${error.message}`);
        await ctx.reply(`❌ Error generating chart for ${coin.name}`);
      }
    }
  }
  
  /**
   * Creates appropriate action buttons based on the type
   * @param coinId The ID of the coin
   * @param buttonType The type of action buttons to create
   * @returns Array of button rows
   */
  private createActionButtons(coinId: string, buttonType: ActionButtonType): any[][] {
    switch (buttonType) {
      case ActionButtonType.TRADING:
        return [
          [
            Markup.button.callback('📈 View Chart', `chart_${coinId}`),
            Markup.button.callback('⭐ Add to Watchlist', `watchlist_add_${coinId}`)
          ]
        ];
      case ActionButtonType.ALERTS:
        return [
          [
            Markup.button.callback('🔔 Set Alert', `alert_set_${coinId}`),
            Markup.button.callback('📈 View Chart', `chart_${coinId}`)
          ]
        ];
      default:
        return [
          [Markup.button.callback('📈 View Chart', `chart_${coinId}`)]
        ];
    }
  }
}