// src/telegram/menus/menus.module.ts
import { Module } from '@nestjs/common';
import { AlertModule } from './alert.module';

@Module({
  imports: [AlertModule],
  providers: [],
  exports: []
})
export class MenusModule {}