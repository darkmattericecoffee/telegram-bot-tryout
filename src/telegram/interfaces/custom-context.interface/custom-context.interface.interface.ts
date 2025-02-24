// src/telegram/interfaces/custom-context.interface.ts
import { Context } from 'telegraf';
import { Update } from 'telegraf/types';
import { Message } from 'telegraf/types';

export interface CustomContext extends Context {
  message: Update.New & Update.NonChannel & Message.TextMessage;
}