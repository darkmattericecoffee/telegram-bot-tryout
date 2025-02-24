import { Markup } from 'telegraf';

export function createGoBackButton() {
  return Markup.button.callback('← Go Back', 'go_back');
}