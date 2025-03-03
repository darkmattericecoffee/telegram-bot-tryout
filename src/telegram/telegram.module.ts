// src/telegram/telegram.module.ts
import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { MenusModule } from './menus/menus.module';
import { WizardsModule } from './wizards/wizards.module';
import { ComponentsModule } from './components/components.module';
import { CoinSearchService } from './services/coin-search.service';
import { MultiPickerComponent } from './components/multi-picker.component';
import { OptionsService } from './services/options.service';
import { ChartImageService } from './services/chart-image.service';
import { WatchlistService } from './services/watchlist.service';

@Module({
  providers: [TelegramService, CoinSearchService, MultiPickerComponent, OptionsService, ChartImageService, WatchlistService],
  exports: [TelegramService],
  imports: [MenusModule, WizardsModule, ComponentsModule],
})
export class TelegramModule {}