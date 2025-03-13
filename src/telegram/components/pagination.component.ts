// src/telegram/components/pagination.component.ts
import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';

/**
 * Interface for pagination configuration
 */
export interface PaginationConfig {
  /**
   * Total number of items across all pages
   */
  totalItems: number;
  
  /**
   * Number of items to display per page
   */
  itemsPerPage: number;
  
  /**
   * Current page number (1-based)
   */
  currentPage: number;
  
  /**
   * Prefix for callback actions (e.g., 'watchlist', 'search', etc.)
   */
  callbackPrefix: string;
  
  /**
   * Whether to show item counts in pagination
   */
  showCounts?: boolean;
  
  /**
   * Maximum number of page buttons to show
   */
  maxPageButtons?: number;
  
  /**
   * Custom label for the current page button
   */
  currentPageLabel?: string;
}

@Injectable()
export class PaginationComponent {
  private readonly logger = new Logger(PaginationComponent.name);

  /**
   * Simple render function for pagination buttons
   * 
   * @param prefix - Prefix for callback data
   * @param currentPage - Current page number
   * @param totalPages - Total number of pages
   * @returns Array of buttons for pagination
   */
  public render(
    prefix: string,
    currentPage: number,
    totalPages: number
  ): Array<ReturnType<typeof Markup.button.callback>> {
    const buttons: Array<ReturnType<typeof Markup.button.callback>> = [];
    
    // Only show pagination if there's more than one page
    if (totalPages <= 1) {
      return buttons;
    }
    
    // Add "Previous" button if not on first page
    if (currentPage > 1) {
      buttons.push(
        Markup.button.callback(
          '« Previous',
          `${prefix}_page_${currentPage - 1}`
        )
      );
    }
    
    // Add page indicator
    buttons.push(
      Markup.button.callback(
        `Page ${currentPage}/${totalPages}`,
        `${prefix}_page_current`
      )
    );
    
    // Add "Next" button if not on last page
    if (currentPage < totalPages) {
      buttons.push(
        Markup.button.callback(
          'Next »',
          `${prefix}_page_${currentPage + 1}`
        )
      );
    }
    
    return buttons;
  }

  /**
   * Generate pagination buttons based on configuration
   * 
   * @param config - Pagination configuration
   * @returns Array of button rows for an inline keyboard
   */
  public generateButtons(config: PaginationConfig): Array<any[]> {
    try {
      const {
        totalItems,
        itemsPerPage,
        currentPage,
        callbackPrefix,
        showCounts = true,
        maxPageButtons = 5
      } = config;
      
      // Calculate total pages
      const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
      
      // Safety check - ensure current page is within bounds
      const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
      
      this.logger.log(`Generating pagination: page ${validCurrentPage}/${totalPages} (${totalItems} items)`);
      
      const buttons: any[] = [];
      
      // If we only have one page, no need for pagination
      if (totalPages <= 1) {
        return buttons;
      }
      
      // Create row for Previous, Page Indicator, Next
      const navigationRow: any[] = [];
      
      // Add Previous button if not on first page
      if (validCurrentPage > 1) {
        navigationRow.push(
          Markup.button.callback(
            '« Previous', 
            `${callbackPrefix}_page_${validCurrentPage - 1}`
          )
        );
      }
      
      // Add page indicator or current page button
      if (config.currentPageLabel) {
        navigationRow.push(
          Markup.button.callback(
            config.currentPageLabel,
            `${callbackPrefix}_page_current`
          )
        );
      } else {
        // Create an informational button about current position
        const countInfo = showCounts
          ? ` (${(validCurrentPage - 1) * itemsPerPage + 1}-${Math.min(validCurrentPage * itemsPerPage, totalItems)}/${totalItems})`
          : '';
          
        navigationRow.push(
          Markup.button.callback(
            `Page ${validCurrentPage}/${totalPages}${countInfo}`,
            `${callbackPrefix}_page_current`
          )
        );
      }
      
      // Add Next button if not on last page
      if (validCurrentPage < totalPages) {
        navigationRow.push(
          Markup.button.callback(
            'Next »', 
            `${callbackPrefix}_page_${validCurrentPage + 1}`
          )
        );
      }
      
      // Add navigation row
      buttons.push(navigationRow);
      
      // Add page number buttons if we have many pages and maxPageButtons > 0
      if (totalPages > 3 && maxPageButtons > 0) {
        // Calculate which page buttons to show
        const pageButtons: any[] = [];
        
        // Determine the range of pages to show
        let startPage = Math.max(1, validCurrentPage - Math.floor(maxPageButtons / 2));
        let endPage = startPage + maxPageButtons - 1;
        
        // Adjust if we're near the end
        if (endPage > totalPages) {
          endPage = totalPages;
          startPage = Math.max(1, endPage - maxPageButtons + 1);
        }
        
        // Add first page button if not included in range
        if (startPage > 1) {
          pageButtons.push(
            Markup.button.callback('1', `${callbackPrefix}_page_1`)
          );
          
          // Add ellipsis if there's a gap
          if (startPage > 2) {
            pageButtons.push(
              Markup.button.callback('...', `${callbackPrefix}_page_ellipsis_start`)
            );
          }
        }
        
        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
          pageButtons.push(
            Markup.button.callback(
              i === validCurrentPage ? `[${i}]` : `${i}`,
              `${callbackPrefix}_page_${i}`
            )
          );
        }
        
        // Add last page button if not included in range
        if (endPage < totalPages) {
          // Add ellipsis if there's a gap
          if (endPage < totalPages - 1) {
            pageButtons.push(
              Markup.button.callback('...', `${callbackPrefix}_page_ellipsis_end`)
            );
          }
          
          pageButtons.push(
            Markup.button.callback(`${totalPages}`, `${callbackPrefix}_page_${totalPages}`)
          );
        }
        
        // Break page buttons into rows of 5 (or fewer)
        const maxButtonsPerRow = 5;
        for (let i = 0; i < pageButtons.length; i += maxButtonsPerRow) {
          buttons.push(pageButtons.slice(i, i + maxButtonsPerRow));
        }
      }
      
      return buttons;
    } catch (error) {
      this.logger.error(`Error generating pagination buttons: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Add pagination buttons to an existing keyboard
   * 
   * @param keyboard - Existing keyboard buttons
   * @param config - Pagination configuration
   * @returns Updated keyboard with pagination buttons
   */
  public addToKeyboard(keyboard: any[][], config: PaginationConfig): any[][] {
    const paginationButtons = this.generateButtons(config);
    return [...keyboard, ...paginationButtons];
  }
  
  /**
   * Create a complete keyboard with pagination
   * 
   * @param config - Pagination configuration
   * @returns Markup with pagination buttons
   */
  public createKeyboard(config: PaginationConfig): any {
    const buttons = this.generateButtons(config);
    return Markup.inlineKeyboard(buttons);
  }
}

/**
 * Interface for pagination state
 */
export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

/**
 * Register pagination handlers on a scene or wizard
 * 
 * @param scene - The scene or wizard to register handlers on
 * @param callbackPrefix - Prefix for callback data matching
 * @param onPageChange - Function to call when page changes
 */
export function registerPaginationHandlers(
  scene: any,
  callbackPrefix: string,
  onPageChange: (ctx: CustomContext, page: number) => Promise<void>
): void {
  const logger = new Logger('PaginationHandlers');
  
  // Handle page changes
  scene.action(new RegExp(`^${callbackPrefix}_page_(\\d+)$`), async (ctx: CustomContext) => {
    try {
      // Extract page number from callback data
      const match = new RegExp(`^${callbackPrefix}_page_(\\d+)$`).exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (!match) return;
      
      const page = parseInt(match[1], 10);
      logger.log(`Pagination: navigating to page ${page}`);
      
      // Call the page change handler
      await onPageChange(ctx, page);
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pagination: ${error.message}`);
      await ctx.answerCbQuery('Error changing page');
    }
  });
  
  // Handle "current page" button click (do nothing)
  scene.action(`${callbackPrefix}_page_current`, async (ctx: CustomContext) => {
    await ctx.answerCbQuery();
  });
  
  // Handle ellipsis clicks (do nothing)
  scene.action(`${callbackPrefix}_page_ellipsis_start`, async (ctx: CustomContext) => {
    await ctx.answerCbQuery();
  });
  
  scene.action(`${callbackPrefix}_page_ellipsis_end`, async (ctx: CustomContext) => {
    await ctx.answerCbQuery();
  });
  
  // Add compatibility with the simpler prev/next pattern
  scene.action(new RegExp(`^${callbackPrefix}_prev_(\\d+)$`), async (ctx: CustomContext) => {
    try {
      // Extract current page from callback data
      const match = new RegExp(`^${callbackPrefix}_prev_(\\d+)$`).exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (!match) return;
      
      const currentPage = parseInt(match[1], 10);
      const prevPage = currentPage - 1;
      
      logger.log(`Pagination: navigating to previous page ${prevPage}`);
      
      // Call the page change handler
      await onPageChange(ctx, prevPage);
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pagination: ${error.message}`);
      await ctx.answerCbQuery('Error changing page');
    }
  });
  
  scene.action(new RegExp(`^${callbackPrefix}_next_(\\d+)$`), async (ctx: CustomContext) => {
    try {
      // Extract current page from callback data
      const match = new RegExp(`^${callbackPrefix}_next_(\\d+)$`).exec(
        ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : ''
      );
      
      if (!match) return;
      
      const currentPage = parseInt(match[1], 10);
      const nextPage = currentPage + 1;
      
      logger.log(`Pagination: navigating to next page ${nextPage}`);
      
      // Call the page change handler
      await onPageChange(ctx, nextPage);
      
      await ctx.answerCbQuery();
    } catch (error) {
      logger.error(`Error handling pagination: ${error.message}`);
      await ctx.answerCbQuery('Error changing page');
    }
  });
}

/**
 * Calculate pagination values for a data array
 * 
 * @param data - Array of items to paginate
 * @param page - Current page number (1-based)
 * @param itemsPerPage - Number of items per page
 * @returns Object with paginated data and pagination state
 */
export function paginateData<T>(
  data: T[],
  page: number = 1,
  itemsPerPage: number = 5
): { 
  items: T[]; 
  pagination: PaginationState;
} {
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const validPage = Math.max(1, Math.min(page, totalPages));
  
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  return {
    items: data.slice(startIndex, endIndex),
    pagination: {
      currentPage: validPage,
      itemsPerPage,
      totalItems
    }
  };
}