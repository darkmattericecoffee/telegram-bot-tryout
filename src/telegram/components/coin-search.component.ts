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

  // Circuit breaker properties
  private searchFailureCount = 0;
  private circuitBreakerOpen = false;
  private lastCircuitBreakerTime = 0;
  private readonly circuitBreakerTimeout = 30000; // 30 seconds
  private readonly searchTimeout = 5000; // 5 seconds timeout for search call

  constructor(private readonly coinSearchService: CoinSearchService) {}

  /**
   * Displays the search prompt to the user
   * @param ctx The Telegram context
   * @param config Configuration for the coin search
   */
  public async prompt(ctx: CustomContext, config: CoinSearchConfig): Promise<void> {
    const { promptText } = config;
    
    // Create buttons - include a "Go Back" button
    const buttons = [[createGoBackButton()]];
    const keyboard = Markup.inlineKeyboard(buttons);
    
    // Send the prompt via edit or reply depending on context
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(promptText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      } else {
        await ctx.reply(promptText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
      this.logger.log(`Prompted user for coin search: ${promptText}`);
    } catch (error) {
      this.logger.error(`Error prompting user: ${error.message}`);
    }
  }

  /**
   * Displays a list of search results for the user to choose from.
   * If no results are found, offers a retry option.
   * @param ctx The Telegram context
   * @param state The current search state
   * @param prefix Callback prefix for pagination and selection
   */
  public async showResults(
    ctx: CustomContext, 
    state: CoinSearchState,
    prefix: string = 'coinsearch'
  ): Promise<void> {
    // Safety check - if no results, show an empty state with retry option
    if (!state.results || state.results.length === 0) {
      const noResultsText = `
*No results found for "${state.searchQuery}"*

Please try another search term.
      `;
      
      // Create a "Retry Search" button alongside the "Go Back" button
      const retryButton = Markup.button.callback('Retry Search', `${prefix}_retry`);
      const keyboard = Markup.inlineKeyboard([
        [retryButton, createGoBackButton()]
      ]);
      
      try {
        if (ctx.callbackQuery) {
          await ctx.editMessageText(noResultsText, {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown',
          });
        } else {
          await ctx.reply(noResultsText, {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown',
          });
        }
      } catch (error) {
        this.logger.error(`Error showing no results message: ${error.message}`);
      }
      return;
    }
    
    // Pagination logic for displaying results
    const { results, page } = state;
    const resultsPerPage = 5;
    const startIdx = (page - 1) * resultsPerPage;
    const endIdx = Math.min(startIdx + resultsPerPage, results.length);
    const pageResults = results.slice(startIdx, endIdx);
    
    // Create result buttons
    const resultButtons = pageResults.map((result) => {
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
    
    // Add a back button
    resultButtons.push([createGoBackButton()]);
    const keyboard = Markup.inlineKeyboard(resultButtons);
    
    const messageText = `
*Search results for "${state.searchQuery}"*

Please select a coin from the list below:
    `;
    
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      } else {
        await ctx.reply(messageText, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
      this.logger.log(`Displayed search results for "${state.searchQuery}" (${results.length} results, page ${page})`);
    } catch (error) {
      this.logger.error(`Error displaying search results: ${error.message}`);
    }
  }

  /**
   * Wraps the coin search call with a timeout.
   * @param query The search query string
   */
  private async searchCoinsWithTimeout(query: string): Promise<{ data: SearchResult[] }> {
    return new Promise((resolve, reject) => {
      // Create a timeout promise that rejects after a defined time period
      const timeout = setTimeout(() => {
        reject(new Error('Search timed out'));
      }, this.searchTimeout);

      // Call the search service
      this.coinSearchService.searchCoins(query)
        .then((response) => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Process a text search query with timeout, fallback, and circuit breaker.
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

    // Check if the circuit breaker is open
    if (this.circuitBreakerOpen) {
      const timeSinceOpen = Date.now() - this.lastCircuitBreakerTime;
      if (timeSinceOpen < this.circuitBreakerTimeout) {
        // Inform the user that the service is temporarily unavailable
        await ctx.reply('The search service is temporarily unavailable due to repeated errors. Please try again later.');
        throw new Error('Circuit breaker is open');
      } else {
        // Reset the circuit breaker after the timeout period
        this.circuitBreakerOpen = false;
        this.searchFailureCount = 0;
      }
    }

    let searchResponse;
    try {
      searchResponse = await this.searchCoinsWithTimeout(query);
      // Reset failure count on a successful call
      this.searchFailureCount = 0;
      this.logger.log(`Found ${searchResponse.data.length} results for "${query}"`);
    } catch (error) {
      this.searchFailureCount++;
      this.logger.error(`Search error: ${error.message}. Failure count: ${this.searchFailureCount}`);
      // Open circuit breaker if failures exceed threshold (e.g., 3)
      if (this.searchFailureCount >= 3) {
        this.circuitBreakerOpen = true;
        this.lastCircuitBreakerTime = Date.now();
        this.logger.error('Circuit breaker activated due to repeated search failures.');
      }
      // Inform the user of the error
      await ctx.reply('An error occurred while searching. Please try again later.');
      throw error;
    }

    // Initialize the search state
    const state: CoinSearchState = {
      searchQuery: query,
      results: searchResponse.data,
      selectedCoin: null,
      page: 1,
    };

    // Check if there is a high confidence match
    if (searchResponse.data.length > 0) {
      const topResult = searchResponse.data[0];
      this.logger.log(`Top result: ${topResult.coin.name} (${topResult.coin.symbol}) with score ${topResult.score}`);
      if (topResult.score >= confidenceThreshold) {
        // High confidence match - auto-select and notify the user
        state.selectedCoin = topResult.coin;
        this.logger.log(`Auto-selected high confidence match: ${topResult.coin.name}`);
        await ctx.toast(`Found ${topResult.coin.name} (${topResult.coin.symbol})`);
      }
    }
    return state;
  }
}

/**
 * Creates a handler for text input that processes coin searches.
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
    // Only process text messages
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }
    
    const query = ctx.message.text;
    const logger = new Logger('CoinSearchHandler');
    logger.log(`Received search query: "${query}"`);
    
    try {
      // Process the search with timeout and circuit breaker
      const state = await component.processSearch(ctx, query, config);
      
      // Store the search state in the wizard state for later steps
      ctx.wizard.state.parameters = {
        ...ctx.wizard.state.parameters,
        coinSearchState: state,
      };
      
      // If a high confidence selection was auto-detected, proceed immediately
      if (state.selectedCoin) {
        logger.log('High confidence match found, proceeding to next step.');
        ctx.wizard.state.parameters[config.fieldName] = state.selectedCoin;
        return nextStep(ctx);
      }
      
      // Otherwise, show the search results for user selection
      logger.log('No high confidence match, showing results.');
      return showResultsStep(ctx);
    } catch (error) {
      logger.error(`Error processing search: ${error.message}`);
      // On error, re-prompt the user to search again
      await ctx.reply('An error occurred while processing your search. Please try again.');
      await component.prompt(ctx, config);
    }
  };
}