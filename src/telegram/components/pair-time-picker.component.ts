import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';

export interface PickerState {
  selectedPairing: string | null;
  selectedTimeframe: string | null;
}

@Injectable()
export class PairTimePickerComponent {
  private readonly logger = new Logger(PairTimePickerComponent.name);


  /**
   * Render an inline keyboard for user to pick a currency pairing and timeframe.
   * @param {string} prefix - a short prefix for your callback data (e.g. "cmbpicker")
   * @param {PickerState} state - the currently selected values
   */
  public render(prefix = 'cmbpicker', state: PickerState = { selectedPairing: 'USD', selectedTimeframe: '1D' }): any {
    // Set defaults if not provided
    const selectedPairing = state.selectedPairing || 'USD';
    const selectedTimeframe = state.selectedTimeframe || '1D';
    
    const buttons = [
      // Currency pair section - all on one row
      [
        Markup.button.callback(
          selectedPairing === 'USD' ? '✅ USD' : 'USD',
          `${prefix}_pair_USD`
        ),
        Markup.button.callback(
          selectedPairing === 'BTC' ? '✅ BTC' : 'BTC',
          `${prefix}_pair_BTC`
        ),
        Markup.button.callback(
          selectedPairing === 'ETH' ? '✅ ETH' : 'ETH',
          `${prefix}_pair_ETH`
        ),
        Markup.button.callback(
          selectedPairing === 'ALL' ? '✅ ALL' : 'ALL',
          `${prefix}_pair_ALL`
        ),
      ],
      
      
      // Timeframe section - all on one row
      [
        Markup.button.callback(
          selectedTimeframe === '6h' ? '✅ 6h' : '6h',
          `${prefix}_time_6h`
        ),
        Markup.button.callback(
          selectedTimeframe === '12h' ? '✅ 12h' : '12h',
          `${prefix}_time_12h`
        ),
        Markup.button.callback(
          selectedTimeframe === '1D' ? '✅ 1D' : '1D',
          `${prefix}_time_1D`
        ),
        Markup.button.callback(
          selectedTimeframe === '1W' ? '✅ 1W' : '1W',
          `${prefix}_time_1W`
        ),
        Markup.button.callback(
          selectedTimeframe === '1M' ? '✅ 1M' : '1M',
          `${prefix}_time_1M`
        ),
      ],
      
      // Navigation buttons row with back and next
      [
        Markup.button.callback('← Back', 'go_back'),
        Markup.button.callback('Next →', `${prefix}_CHOOSE`)
      ],
    ];

    return Markup.inlineKeyboard(buttons);
  }
}

@Injectable()
export class PairTimePickerComponentCallbackHandler {
  private readonly logger = new Logger(PairTimePickerComponentCallbackHandler.name);

  /**
   * Processes the callback data and updates the state.
   */
  public async handleCallback(
    ctx: CustomContext,
    data: string,
    currentState: PickerState
  ): Promise<{ state: PickerState; proceed: boolean }> {
    // Extract prefix, type, and value from callback data (e.g., "cmbpicker_pair_USD")
    const parts = data.split('_');
    
    if (parts.length < 2 || parts[0] !== 'cmbpicker') {
      return { state: currentState, proceed: false }; // not for us
    }

    // Handle the "Choose" action
    if (parts[1] === 'CHOOSE') {
      this.logger.log(`Proceeding with selections: ${currentState.selectedPairing} / ${currentState.selectedTimeframe}`);
      await ctx.answerCbQuery(`Selection confirmed: ${currentState.selectedPairing}/${currentState.selectedTimeframe}`);
      return { state: currentState, proceed: true };
    }
    
    // Ignore clicks on the separator
    if (parts[1] === 'separator' || data === 'ignore') {
      await ctx.answerCbQuery('');
      return { state: currentState, proceed: false };
    }

    // Handle pair selection
    if (parts[1] === 'pair' && parts[2]) {
      const newPairing = parts[2];
      this.logger.log(`Selected pairing: ${newPairing}`);
      await ctx.answerCbQuery(`Selected pairing: ${newPairing}`);
      return { 
        state: { ...currentState, selectedPairing: newPairing }, 
        proceed: false 
      };
    }

    // Handle timeframe selection
    if (parts[1] === 'time' && parts[2]) {
      const newTimeframe = parts[2];
      this.logger.log(`Selected timeframe: ${newTimeframe}`);
      await ctx.answerCbQuery(`Selected timeframe: ${newTimeframe}`);
      return { 
        state: { ...currentState, selectedTimeframe: newTimeframe }, 
        proceed: false 
      };
    }

    // If we reached here, something unexpected happened
    return { state: currentState, proceed: false };
  }
}