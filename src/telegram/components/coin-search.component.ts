import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
import { createGoBackButton } from '../constants/buttons.constant';
import { CoinSearchService, SearchResult, Coin } from '../services/coin-search.service';

export interface CoinSearchConfig {
  promptText: string;
  confidenceThreshold?: number;
  fieldName: string;
  searchCallbackPrefix?: string;
}

export interface CoinSearchState {
  searchQuery: string;
  results: SearchResult[];
  selectedCoin: Coin | null;
  page: number;
}

@Injectable()
export class CoinSearchComponent {
  private readonly logger = new Logger(CoinSearchComponent.name);

  constructor(private readonly coinSearchService: CoinSearchService) {}

  /**
   * Displays the search prompt to the user
   * @param ctx The Telegram context
   * @param config Configuration for the coin search
   */
  public async prompt(ctx: CustomContext, config: CoinSearchConfig): Promise<void> {
    const { promptText } = config;
    
    // Create buttons
    const buttons = [
      [createGoBackButton()]
    ];
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    // Send the prompt
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(promptText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      } catch (error) {
        await ctx.reply(promptText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
    } else {
      await ctx.reply(promptText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    }
    
    this.logger.log(`Prompted user for coin search: ${promptText}`);
  }

  /**
   * Displays a list of search results for the user to choose from
   * @param ctx The Telegram context
   * @param state The current search state
   * @param prefix Callback prefix for pagination and selection
   */
  public async showResults(
    ctx: CustomContext, 
    state: CoinSearchState,
    prefix: string = 'coinsearch'
  ): Promise<void> {
    // Safety check - if no results, show empty state
    if (!state.results || state.results.length === 0) {
      const noResultsText = `
*No results found for "${state.searchQuery}"*

Please try another search term.
      `;
      
      const keyboard = Markup.inlineKeyboard([
        [createGoBackButton()]
      ]);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(noResultsText, {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown',
          });
        } catch (error) {
          await ctx.reply(noResultsText, {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown',
          });
        }
      } else {
        await ctx.reply(noResultsText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
      return;
    }
    
    const { results, page } = state;
    const resultsPerPage = 5;
    const startIdx = (page - 1) * resultsPerPage;
    const endIdx = Math.min(startIdx + resultsPerPage, results.length);
    const pageResults = results.slice(startIdx, endIdx);
    
    // Create result buttons
    const resultButtons = pageResults.map((result, idx) => {
      const { coin } = result;
      const rank = coin.dynamicMetadata?.market_cap_rank 
        ? `#${coin.dynamicMetadata.market_cap_rank} ` 
        : '';
      const buttonText = `${rank}${coin.name} (${coin.symbol})`;
      return [Markup.button.callback(
        buttonText, 
        `${prefix}_select_${coin.id}`
      )];
    });
    
    // Add pagination buttons if needed
    const paginationButtons: Array<ReturnType<typeof Markup.button.callback>> = [];
    
    if (page > 1) {
      paginationButtons.push(
        Markup.button.callback('« Previous', `${prefix}_prev_${page}`)
      );
    }
    
    if (endIdx < results.length) {
      paginationButtons.push(
        Markup.button.callback('Next »', `${prefix}_next_${page}`)
      );
    }
    
    if (paginationButtons.length > 0) {
      resultButtons.push(paginationButtons);
    }
    
    // Add back button
    resultButtons.push([createGoBackButton()]);
    
    const keyboard = Markup.inlineKeyboard(resultButtons);
    
    // Create message text
    const messageText = `
*Search results for "${state.searchQuery}"*

Please select a coin from the list below:
    `;
    
    // Send or edit message
    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      } catch (error) {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
    } else {
      await ctx.reply(messageText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    }
    
    this.logger.log(`Showed search results for "${state.searchQuery}" (${results.length} results, page ${page})`);
  }

  /**
   * Process a text search query
   * @param ctx The Telegram context
   * @param query The search query string
   * @param config The search configuration
   */
  public async processSearch(
    ctx: CustomContext,
    query: string,
    config: CoinSearchConfig
  ): Promise<CoinSearchState> {
    this.logger.log(`Processing search query: "${query}"`);
    const confidenceThreshold = config.confidenceThreshold || 0.5;
    
    // Search for coins
    const searchResponse = await this.coinSearchService.searchCoins(query);
    this.logger.log(`Found ${searchResponse.data.length} results for "${query}"`);
    
    // Initialize the state
    const state: CoinSearchState = {
      searchQuery: query,
      results: searchResponse.data,
      selectedCoin: null,
      page: 1
    };
    
    // Check if we have a high confidence match
    if (searchResponse.data.length > 0) {
      const topResult = searchResponse.data[0];
      this.logger.log(`Top result: ${topResult.coin.name} (${topResult.coin.symbol}) with score ${topResult.score}`);
      
      if (topResult.score >= confidenceThreshold) {
        // High confidence match - auto-select and notify
        state.selectedCoin = topResult.coin;
        this.logger.log(`Auto-selected high confidence match: ${topResult.coin.name}`);
        
        // Show toast notification
        await ctx.toast(`Found ${topResult.coin.name} (${topResult.coin.symbol})`);
      }
    }
    
    return state;
  }
}

/**
 * Creates a handler for text input that processes coin searches
 * @param component The CoinSearchComponent instance
 * @param config The search configuration
 * @param nextStep Function to call after a successful search
 * @param showResultsStep Function to call to show search results
 */
export function createCoinSearchHandler(
  component: CoinSearchComponent,
  config: CoinSearchConfig,
  nextStep: (ctx: CustomContext) => Promise<void>,
  showResultsStep: (ctx: CustomContext) => Promise<void>
) {
  return async (ctx: CustomContext) => {
    // Only process if this is a text message
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }
    
    const query = ctx.message.text;
    const logger = new Logger('CoinSearchHandler');
    logger.log(`Received search query: "${query}"`);
    
    try {
      // Process the search
      const state = await component.processSearch(ctx, query, config);
      
      // Store the search state in the wizard state
      ctx.wizard.state.parameters = {
        ...ctx.wizard.state.parameters,
        coinSearchState: state
      };
      
      // If we have a high confidence selection, store it and proceed
      if (state.selectedCoin) {
        logger.log(`High confidence match found, proceeding to next step`);
        ctx.wizard.state.parameters[config.fieldName] = state.selectedCoin;
        return nextStep(ctx);
      }
      
      // Otherwise, show results for user to choose
      logger.log(`No high confidence match, showing results`);
      return showResultsStep(ctx);
    } catch (error) {
      logger.error(`Error processing search: ${error.message}`);
      // In case of error, stay at the search prompt
      await ctx.reply('An error occurred while searching. Please try again.');
      await component.prompt(ctx, config);
    }
  };
}