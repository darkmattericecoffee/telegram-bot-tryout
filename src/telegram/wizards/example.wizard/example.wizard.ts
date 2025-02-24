// src/telegram/wizards/example.wizard/example.wizard.ts
import { Scenes } from 'telegraf';
import { CustomContext, WizardState } from 'src/telegram/interfaces/custom-context.interface';
import { pickerComponent } from 'src/telegram/components/picker.component/picker.component';
import { optionsComponent } from 'src/telegram/components/options.component/options.component';
import { responseComponent } from 'src/telegram/components/response.component/response.component';
import { showSubMenu } from 'src/telegram/menus/sub.menu/sub.menu';

/**
 * Step 1: Display picker component.
 */
async function step1(ctx: CustomContext) {
  // Set wizard state to step 1
  (ctx.wizard.state as WizardState).step = 1;
  await pickerComponent(ctx);
}

/**
 * Step 2: Display options component.
 */
async function step2(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;
  await optionsComponent(ctx);
}

/**
 * Step 3: Display response component and exit the wizard.
 */
async function step3(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;
  await responseComponent(ctx);
  await ctx.reply('Wizard completed. Returning to Main Menu.');
  return ctx.scene.leave();
}

/**
 * Create the wizard scene.
 * In this example we use only one entry step because the navigation is handled
 * by the callback actions.
 */
export const exampleWizard = new Scenes.WizardScene<CustomContext>(
  'example-wizard',
  async (ctx) => {
    // When the wizard is entered, always start at step 1.
    return step1(ctx);
  }
);

// Register scene-scoped callback actions:

// Picker callbacks in step 1
exampleWizard.action('picker_option_1', async (ctx) => {
  await ctx.reply('You picked Option 1 in the picker component.');
  // Move to step 2 by calling step2 directly
  return step2(ctx);
});

exampleWizard.action('picker_option_2', async (ctx) => {
  await ctx.reply('You picked Option 2 in the picker component.');
  return step2(ctx);
});

// Option callbacks in step 2
exampleWizard.action('route_a', async (ctx) => {
  await ctx.reply('You chose Route A.');
  return step3(ctx);
});

exampleWizard.action('route_b', async (ctx) => {
  await ctx.reply('You chose Route B.');
  return step3(ctx);
});

// "Go Back" action – works in both the wizard and outside it.
exampleWizard.action('go_back', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  if (wizardState.step && wizardState.step > 1) {
    // If we're in step 2 or 3, decrement step and re-render that step.
    wizardState.step = wizardState.step - 1;
    if (wizardState.step === 1) {
      return step1(ctx);
    } else if (wizardState.step === 2) {
      return step2(ctx);
    }
  } else {
    // At step 1 (or if step is not set): exit wizard and go to sub-menu.
    await ctx.scene.leave();
    return showSubMenu(ctx);
  }
});