// src/telegram/wizards/watchlist-wizards.module.ts
import { Module } from '@nestjs/common';
import { WatchlistService } from '../services/watchlist.service';
import { CoinSearchService } from '../services/coin-search.service';
import { createShowWatchlistWizard } from './watchlist/show-watchlist.wizard';
import { createRenameWatchlistWizard } from './watchlist/rename-watchlist.wizard';
import { createCreateWatchlistWizard } from './watchlist/create-watchlist.wizard';
import { createDeleteWatchlistWizard } from './watchlist/delete-watchlist.wizard';
import { createAddToWatchlistWizard } from './watchlist/add-to-watchlist.wizard';
import { AlertWizardsModule } from './alerts/alert-wizards.module';

@Module({
  providers: [
    WatchlistService,
    CoinSearchService,
    {
      provide: 'SHOW_WATCHLIST_WIZARD',
      useFactory: (watchlistService: WatchlistService) => {
        return createShowWatchlistWizard(watchlistService);
      },
      inject: [WatchlistService]
    },
    {
      provide: 'CREATE_WATCHLIST_WIZARD',
      useFactory: (watchlistService: WatchlistService) => {
        return createCreateWatchlistWizard(watchlistService);
      },
      inject: [WatchlistService]
    },
    {
      provide: 'RENAME_WATCHLIST_WIZARD',
      useFactory: (watchlistService: WatchlistService) => {
        return createRenameWatchlistWizard(watchlistService);
      },
      inject: [WatchlistService]
    },
    {
      provide: 'DELETE_WATCHLIST_WIZARD',
      useFactory: (watchlistService: WatchlistService) => {
        return createDeleteWatchlistWizard(watchlistService);
      },
      inject: [WatchlistService]
    },
    {
      provide: 'ADD_TO_WATCHLIST_WIZARD',
      useFactory: (watchlistService: WatchlistService, coinSearchService: CoinSearchService) => {
        return createAddToWatchlistWizard(watchlistService, coinSearchService);
      },
      inject: [WatchlistService, CoinSearchService]
    }
  ],
  exports: [
    'SHOW_WATCHLIST_WIZARD',
    'CREATE_WATCHLIST_WIZARD',
    'RENAME_WATCHLIST_WIZARD',
    'DELETE_WATCHLIST_WIZARD',
    'ADD_TO_WATCHLIST_WIZARD',
    WatchlistService,
    CoinSearchService
  ],
  imports: [AlertWizardsModule]
})
export class WatchlistWizardsModule {}