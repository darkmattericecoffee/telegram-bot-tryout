// src/telegram/wizards/discovery/discovery-wizards.module.ts
import { Module } from '@nestjs/common';
import { DiscoveryWizard
import { DiscoveryService } from '../../services/discovery.service';
import { ChartImageService } from '../../services/chart-image.service';

@Module({
  providers: [
    // Register services
    DiscoveryService,
    ChartImageService,
    
    // Register wizards as providers
    {
      provide: 'DISCOVERY_WIZARD',
      useValue: DiscoveryWizard,
    }
  ],
  exports: [
    // Export the wizards for use in the TelegramService
    'DISCOVERY_WIZARD'
  ]
})
export class DiscoveryWizardsModule {}