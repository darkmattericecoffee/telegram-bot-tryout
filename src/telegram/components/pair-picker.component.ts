import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { CustomContext } from '../interfaces/custom-context.interface';
@Injectable()
export class PairPickerComponent {
  private readonly logger = new Logger(PairPickerComponent.name);

  /**
   * Render an inline keyboard for user to pick a currency pairing.
   * @param {string} prefix - a short prefix for your callback data (e.g. "pairpicker")
   * @param {string | null} selectedPairing - the currently selected pairing (if any)
   */
  public render(prefix = 'pairpicker', selectedPairing: string | null = null): any {
    const buttons = [
      [
        Markup.button.callback(
          selectedPairing === 'USD' ? '✅ USD' : 'USD',
          `${prefix}_USD`
        ),
        Markup.button.callback(
          selectedPairing === 'BTC' ? '✅ BTC' : 'BTC',
          `${prefix}_BTC`
        ),
        Markup.button.callback(
          selectedPairing === 'ETH' ? '✅ ETH' : 'ETH',
          `${prefix}_ETH`
        ),
      ],
      [
        Markup.button.callback(
          selectedPairing === 'ALL' ? '✅ All Pairs' : 'All Pairs',
          `${prefix}_ALL`
        ),
      ],
    ];

    // Add "Choose" button if a pairing is selected
    if (selectedPairing) {
      buttons.push([Markup.button.callback('Choose ✅', `${prefix}_CHOOSE`)]);
    }

    return Markup.inlineKeyboard(buttons);
  }
}

@Injectable()
export class PairPickerCallbackHandler {
  private readonly logger = new Logger(PairPickerCallbackHandler.name);

  /**
   * Processes the callback data, updates the state, and handles the "Choose" action.
   */
  public async handleCallback(
    ctx: CustomContext,
    data: string,
    currentState: { selectedPairing: string | null }
  ): Promise<{ selectedPairing: string | null; proceed: boolean }> {
    const [prefix, action] = data.split('_');

    if (prefix !== 'pairpicker') {
      return { selectedPairing: null, proceed: false }; // not for us
    }

    if (action === 'CHOOSE') {
      // User clicked "Choose", proceed to the next step
      this.logger.log(`Proceeding with pairing: ${currentState.selectedPairing}`);
      await ctx.answerCbQuery(`Proceeding with ${currentState.selectedPairing}`);
      return { selectedPairing: currentState.selectedPairing, proceed: true };
    }

    // Update the selected pairing
    currentState.selectedPairing = action;
    this.logger.log(`Selected pairing: ${action}`);
    await ctx.answerCbQuery(`Selected pairing: ${action}`);

    return { selectedPairing: action, proceed: false };
  }
}