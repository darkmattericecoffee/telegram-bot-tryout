import { Module } from '@nestjs/common';
import { ChartingWizardService } from './charting.wizard';

@Module({
  providers: [ChartingWizardService]
})
export class WizardsModule {}
