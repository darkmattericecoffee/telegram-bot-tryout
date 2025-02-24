// src/telegram/interfaces/custom-context.interface.ts
import { Context, Scenes } from 'telegraf';

export interface WizardState {
  step?: number;
}

export interface WizardSessionData extends Scenes.WizardSessionData {
  cursor: number;
}

export interface CustomContext extends Context, Omit<Scenes.WizardContext<WizardSessionData>, 'scene'> {
  scene: Scenes.SceneContextScene<CustomContext, WizardSessionData>;
  wizard: Scenes.WizardContextWizard<CustomContext> & { state: WizardState };
  toast: (message: string) => Promise<void>; // Add toast method
}