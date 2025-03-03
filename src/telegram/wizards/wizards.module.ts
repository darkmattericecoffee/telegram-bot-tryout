// src/telegram/wizards/wizards.module.ts
import { Module } from '@nestjs/common';
import { WatchlistWizardsModule } from './watchlist-wizards.module';

@Module({
  imports: [WatchlistWizardsModule],
  exports: [WatchlistWizardsModule]
})
export class WizardsModule {}