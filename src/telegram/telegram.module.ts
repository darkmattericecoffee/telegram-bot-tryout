// src/telegram/telegram.module.ts
import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';

// Internal modules
import { MenusModule } from './menus/menus.module';
import { WizardsModule } from './wizards/wizards.module';
import { ComponentsModule } from './components/components.module';

// Services and components
import { CoinSearchService } from './services/coin-search.service';
import { OptionsService } from './services/options.service';
import { ChartImageService } from './services/chart-image.service';
import { WatchlistService } from './services/watchlist.service';
import { AlertService } from './services/alert.service';
import { MultiPickerComponent } from './components/multi-picker.component';

@Module({
  imports: [MenusModule, WizardsModule, ComponentsModule],
  providers: [
    TelegramService,
    CoinSearchService,
    OptionsService,
    ChartImageService,
    WatchlistService,
    AlertService,
    MultiPickerComponent,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}