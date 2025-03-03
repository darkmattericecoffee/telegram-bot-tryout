// src/telegram/wizards/watchlist-wizards.module.ts
import { Module } from '@nestjs/common';
import { WatchlistService } from '../services/watchlist.service';
import { createShowWatchlistWizard } from './watchlist/show-watchlist.wizard';
import { createRenameWatchlistWizard } from './watchlist/rename-watchlist.wizard';
import { createCreateWatchlistWizard } from './watchlist/create-watchlist.wizard';
import { createDeleteWatchlistWizard } from './watchlist/delete-watchlist.wizard';
@Module({
  providers: [
    WatchlistService,
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
    }
  ],
  exports: [
    'SHOW_WATCHLIST_WIZARD',
    'CREATE_WATCHLIST_WIZARD',
    'RENAME_WATCHLIST_WIZARD',
    'DELETE_WATCHLIST_WIZARD',
    WatchlistService
  ]
})
export class WatchlistWizardsModule {}