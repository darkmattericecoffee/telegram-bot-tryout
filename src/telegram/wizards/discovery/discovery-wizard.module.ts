// src/telegram/wizards/discovery-wizards.module.ts
import { Module } from '@nestjs/common';
import { StrengthWizard } from './strength.wizard';
import { LatestSignalsWizard } from './latest-signals.wizard';

@Module({
  providers: [
    {
      provide: 'STRENGTH_WIZARD',
      useValue: StrengthWizard
    },
    {
      provide: 'LATEST_SIGNALS_WIZARD',
      useValue: LatestSignalsWizard
    }
  ],
  exports: [
    'STRENGTH_WIZARD',
    'LATEST_SIGNALS_WIZARD'
  ]
})
export class DiscoveryWizardsModule {}