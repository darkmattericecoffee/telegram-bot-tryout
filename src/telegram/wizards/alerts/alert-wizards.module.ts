// src/telegram/wizards/alerts/alert-wizards.module.ts
import { Module } from '@nestjs/common';
import { createAlertWizard } from './create-alert.wizard';
import { showAllAlertsWizard } from './show-alerts.wizard';
import { AlertService } from 'src/telegram/services/alert.service';
import { WatchlistService } from 'src/telegram/services/watchlist.service';
import { CoinSearchService } from 'src/telegram/services/coin-search.service';
import { OptionsService } from 'src/telegram/services/options.service';

@Module({
  imports: [],
  providers: [
    {
      provide: 'CREATE_ALERT_WIZARD',
      useValue: createAlertWizard,
    },
    {
      provide: 'SHOW_ALL_ALERTS_WIZARD',
      useValue: showAllAlertsWizard,
    },
    AlertService,
    WatchlistService,
    CoinSearchService,
    OptionsService,
  ],
  exports: ['CREATE_ALERT_WIZARD', 'SHOW_ALL_ALERTS_WIZARD', AlertService],
})
export class AlertWizardsModule {}