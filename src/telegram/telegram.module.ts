// src/telegram/telegram.module.ts
import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { MenusModule } from './menus/menus.module';
import { WizardsModule } from './wizards/wizards.module';
import { ComponentsModule } from './components/components.module';

@Module({
  providers: [TelegramService],
  exports: [TelegramService],
  imports: [MenusModule, WizardsModule, ComponentsModule],
})
export class TelegramModule {}