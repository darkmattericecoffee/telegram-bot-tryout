import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { MenusModule } from './menus/menus.module';
import { WizardsModule } from './wizards/wizards.module';
import { ComponentsModule } from './components/components.module';
import { CoinSearchService } from './services/coin-search.service';
import { OptionsService } from './services/options.service';
import { ChartImageService } from './services/chart-image.service';
import { WatchlistService } from './services/watchlist.service';
import { AlertService } from './services/alert.service';
import { MultiPickerComponent } from './components/multi-picker.component';
import { DiscoveryService } from './services/discovery.service';
import { DiscoveryChartService } from './services/discovery-chart.service';

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
    DiscoveryService,
    DiscoveryChartService
  ],
  exports: [TelegramService],
})
export class TelegramModule {}