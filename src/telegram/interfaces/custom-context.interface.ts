// src/telegram/interfaces/custom-context.interface/custom-context.interface.interface.ts
import { Context, Scenes } from 'telegraf';

export interface WizardState {
  step?: number; // Define the step property
}

export interface WizardSessionData extends Scenes.WizardSessionData {
  cursor: number;
  // Add other custom properties here
}

export interface CustomContext extends Context, Scenes.WizardContext<WizardSessionData> {
  wizard: Scenes.WizardContextWizard<CustomContext> & { state: WizardState }; // Add the state property
}