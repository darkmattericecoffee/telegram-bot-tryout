// src/telegram/interfaces/custom-context.interface.ts
import { Context, Scenes } from 'telegraf';
import { CoinSearchState } from '../components/coin-search.component';
import { PickerState } from '../components/pair-time-picker.component';

export interface WizardState {
  step?: number;
  parameters: Record<string, any>; // Store collected parameters
  coinSearchState?: CoinSearchState; // Added for coin search results
  pickerState?: PickerState;         // Added for the pair/time picker state
  discoveryService?: any; // or type it as DiscoveryService if you import it here
}

export interface WizardSessionData extends Scenes.WizardSessionData {
  cursor: number;
}

export interface CustomContext
  extends Context,
    Omit<Scenes.WizardContext<WizardSessionData>, 'scene'> {
  scene: Scenes.SceneContextScene<CustomContext, WizardSessionData>;
  wizard: Scenes.WizardContextWizard<CustomContext> & { state: WizardState };
  toast: (message: string) => Promise<void>; // Add toast method
}