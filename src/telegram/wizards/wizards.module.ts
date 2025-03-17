import { Module } from '@nestjs/common';
import { WatchlistWizardsModule } from './watchlist-wizards.module';
import { AlertWizardsModule } from './alerts/alert-wizards.module';
import { DiscoveryWizardsModule } from './discovery/discovery-wizard.module';

@Module({
  imports: [WatchlistWizardsModule, AlertWizardsModule, DiscoveryWizardsModule], 
  exports: [WatchlistWizardsModule, AlertWizardsModule, DiscoveryWizardsModule], 
})
export class WizardsModule {}