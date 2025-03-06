// src/telegram/wizards/alert-wizards.module.ts
import { Module } from '@nestjs/common';
import { AlertService } from '../../services/alert.service';
import { WatchlistService } from '../../services/watchlist.service';
import { CoinSearchService } from '../../services/coin-search.service';
import { createShowWatchlistAlertsWizard } from './show-watchlist-alerts.wizard';
import { createShowDiscoveryAlertsWizard } from './show-discovery-alerts.wizard';
import { createDeleteAlertWizard } from './delete-alert.wizard';
import { createCreateAlertWizard } from './create-alert.wizard';
import { createMarketTransitionsWizard } from './creation/market-transition-alert.wizard';
import { createLevelBreaksWizard } from './creation/level-break.wizard';
import { createDiscoveryAlertWizard } from './creation/create-discovery-alert.wizard';

@Module({
  providers: [
    AlertService,
    WatchlistService,
    CoinSearchService,
    {
      provide: 'SHOW_WATCHLIST_ALERTS_WIZARD',
      useFactory: (alertService: AlertService, watchlistService: WatchlistService) => {
        return createShowWatchlistAlertsWizard(alertService, watchlistService);
      },
      inject: [AlertService, WatchlistService]
    },
    {
      provide: 'SHOW_DISCOVERY_ALERTS_WIZARD',
      useFactory: (alertService: AlertService) => {
        return createShowDiscoveryAlertsWizard(alertService);
      },
      inject: [AlertService]
    },
    {
      provide: 'DELETE_ALERT_WIZARD',
      useFactory: (alertService: AlertService) => {
        return createDeleteAlertWizard(alertService);
      },
      inject: [AlertService]
    },
    {
      provide: 'CREATE_ALERT_WIZARD',
      useFactory: (alertService: AlertService, watchlistService: WatchlistService, coinSearchService: CoinSearchService) => {
        return createCreateAlertWizard(alertService, watchlistService, coinSearchService);
      },
      inject: [AlertService, WatchlistService, CoinSearchService]
    },
    // New specialized alert wizards
    {
      provide: 'MARKET_TRANSITIONS_WIZARD',
      useFactory: (alertService: AlertService, coinSearchService: CoinSearchService) => {
        return createMarketTransitionsWizard(alertService, coinSearchService);
      },
      inject: [AlertService, CoinSearchService]
    },
    {
      provide: 'LEVEL_BREAKS_WIZARD',
      useFactory: (alertService: AlertService) => {
        return createLevelBreaksWizard(alertService);
      },
      inject: [AlertService]
    },
    {
      provide: 'DISCOVERY_ALERT_WIZARD',
      useFactory: (alertService: AlertService, coinSearchService: CoinSearchService) => {
        return createDiscoveryAlertWizard(alertService, coinSearchService);
      },
      inject: [AlertService, CoinSearchService]
    }
  ],
  exports: [
    'SHOW_WATCHLIST_ALERTS_WIZARD',
    'SHOW_DISCOVERY_ALERTS_WIZARD',
    'DELETE_ALERT_WIZARD',
    'CREATE_ALERT_WIZARD',
    'MARKET_TRANSITIONS_WIZARD',
    'LEVEL_BREAKS_WIZARD',
    'DISCOVERY_ALERT_WIZARD',
    AlertService,
    WatchlistService,
    CoinSearchService
  ]
})
export class AlertWizardsModule {}