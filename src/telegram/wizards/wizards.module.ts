// src/telegram/wizards/wizards.module.ts
import { Module } from '@nestjs/common';
import { WatchlistWizardsModule } from './watchlist-wizards.module';
import { AlertWizardsModule } from './alerts/alert-wizards.module';

@Module({
  imports: [WatchlistWizardsModule, AlertWizardsModule],
  exports: [WatchlistWizardsModule, AlertWizardsModule],
})
export class WizardsModule {}