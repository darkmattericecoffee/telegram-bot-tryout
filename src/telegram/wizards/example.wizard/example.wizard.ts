import { Scenes } from 'telegraf';
import { CustomContext, WizardState } from 'src/telegram/interfaces/custom-context.interface';
import { pickerComponent } from 'src/telegram/components/picker.component/picker.component';
import { optionsComponent } from 'src/telegram/components/options.component/options.component';
import { responseComponent } from 'src/telegram/components/response.component/response.component';
import { showSubMenu } from 'src/telegram/menus/sub.menu/sub.menu';

// Step 1: Picker Component
async function step1(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 1;

  const pickerConfig = {
    text: 'Please pick an option:',
    options: [
      { label: 'Option 1', action: 'picker_option_1' },
      { label: 'Option 2', action: 'picker_option_2' },
    ],
  };

  await pickerComponent(ctx, pickerConfig);
}

// Step 2: Options Component
async function step2(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 2;

  const optionsConfig = {
    text: 'Choose an action:',
    buttons: [
      { label: 'Route A', action: 'route_a' },
      { label: 'Route B', action: 'route_b' },
    ],
  };

  await optionsComponent(ctx, optionsConfig);
}

// Step 3: Response Component
async function step3(ctx: CustomContext) {
  (ctx.wizard.state as WizardState).step = 3;

  const responseConfig = {
    text: 'Wizard completed. Here are the collected parameters:',
    parameters: ctx.wizard.state.parameters, // Pass collected parameters
  };

  await responseComponent(ctx, responseConfig);
  await ctx.scene.leave();
}

// Create the wizard scene
export const exampleWizard = new Scenes.WizardScene<CustomContext>(
  'example-wizard',
  step1
);

// Picker callbacks in step 1
exampleWizard.action('picker_option_1', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, picker: 'Option 1' };
  await ctx.toast('Selected Option 1');
  return step2(ctx);
});

exampleWizard.action('picker_option_2', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, picker: 'Option 2' };
  await ctx.toast('Selected Option 2');
  return step2(ctx);
});

// Option callbacks in step 2
exampleWizard.action('route_a', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, route: 'Route A' };
  await ctx.toast('Route A chosen');
  return step3(ctx);
});

exampleWizard.action('route_b', async (ctx) => {
  ctx.wizard.state.parameters = { ...ctx.wizard.state.parameters, route: 'Route B' };
  await ctx.toast('Route B chosen');
  return step3(ctx);
});

// "Go Back" action
exampleWizard.action('go_back', async (ctx) => {
  const wizardState = ctx.wizard.state as WizardState;
  if (wizardState.step && wizardState.step > 1) {
    wizardState.step = wizardState.step - 1;
    if (wizardState.step === 1) {
      return step1(ctx);
    } else if (wizardState.step === 2) {
      return step2(ctx);
    }
  } else {
    await ctx.scene.leave();
    return showSubMenu(ctx);
  }
});