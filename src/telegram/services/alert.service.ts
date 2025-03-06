// src/telegram/services/alert.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

// Enums for alert types and other parameters
export enum AlertType {
  PRICE_UP = 'PRICE_UP',
  PRICE_DOWN = 'PRICE_DOWN',
  PRICE_PERCENTAGE_UP = 'PRICE_PERCENTAGE_UP',
  PRICE_PERCENTAGE_DOWN = 'PRICE_PERCENTAGE_DOWN',
  VOLUME_UP = 'VOLUME_UP',
  VOLUME_DOWN = 'VOLUME_DOWN',
  RSI_OVERBOUGHT = 'RSI_OVERBOUGHT',
  RSI_OVERSOLD = 'RSI_OVERSOLD',
  MACD_CROSSOVER = 'MACD_CROSSOVER',
  MACD_CROSSUNDER = 'MACD_CROSSUNDER',
  MOVING_AVERAGE_CROSSOVER = 'MOVING_AVERAGE_CROSSOVER',
  MOVING_AVERAGE_CROSSUNDER = 'MOVING_AVERAGE_CROSSUNDER',
  LEVEL_BREAK = 'LEVEL_BREAK',
  MARKET_TRANSITION = 'MARKET_TRANSITION'
}

export enum TimeFrame {
  H1 = 'H1', // 1 hour
  H4 = 'H4', // 4 hours
  H6 = 'H6', // 4 hours
  H12 = 'H12', // 12 hours
  D1 = 'D1', // 1 day
  D3 = 'D3', // 3 days
  W1 = 'W1',
  M1 = 'M1'
}

export enum Pairing {
  USD = 'USD',
  BTC = 'BTC',
  ETH = 'ETH',
  ALL = 'ALL'
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  TRIGGERED = 'TRIGGERED',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
}

export interface Alert {
  id: string;
  name?: string;
  userId: string;
  telegramUserId?: string;
  telegramGroupId?: string;
  coinIdentifier: string;
  coinName?: string;
  coinSymbol?: string;
  watchlistId?: string;
  watchlistName?: string;
  alertType: AlertType;
  threshold: number;
  timeframe: TimeFrame;
  pairing: Pairing;
  message: string;
  status: AlertStatus;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  isDiscoveryAlert: boolean;
}

export interface CreateAlertDto {
  userId: string;
  telegramUserId?: string;
  telegramGroupId?: string;
  coinIdentifier?: string;
  watchlistId?: string;
  alertType: AlertType;
  threshold: number;
  timeframe: TimeFrame;
  pairing: Pairing;
  message: string;
  isDiscoveryAlert?: boolean;
}

export interface UpdateAlertDto {
  alertId: string;
  name?: string;
  threshold?: number;
  message?: string;
  status?: AlertStatus;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alerts: Alert[] = [];
  private readonly ALERTS_PER_WATCHLIST_LIMIT = 3;
  private readonly DISCOVERY_ALERTS_LIMIT = 5;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    // Initialize some mock alerts
    this.alerts = [
      {
        id: uuidv4(),
        userId: '1',
        telegramUserId: '12345',
        coinIdentifier: 'bitcoin',
        coinName: 'Bitcoin',
        coinSymbol: 'BTC',
        watchlistId: 'watch1',
        watchlistName: 'Top DeFi',
        alertType: AlertType.PRICE_UP,
        threshold: 50000,
        timeframe: TimeFrame.H12,
        pairing: Pairing.USD,
        message: 'Bitcoin price reached $50,000!',
        status: AlertStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDiscoveryAlert: false
      },
      {
        id: uuidv4(),
        userId: '1',
        telegramUserId: '12345',
        coinIdentifier: 'ethereum',
        coinName: 'Ethereum',
        coinSymbol: 'ETH',
        watchlistId: 'watch1',
        watchlistName: 'Top DeFi',
        alertType: AlertType.PRICE_DOWN,
        threshold: 2500,
        timeframe: TimeFrame.H12,
        pairing: Pairing.USD,
        message: 'Ethereum dropped below $2,500!',
        status: AlertStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDiscoveryAlert: false
      },
      {
        id: uuidv4(),
        userId: '1',
        telegramUserId: '12345',
        coinIdentifier: 'all',
        alertType: AlertType.RSI_OVERBOUGHT,
        threshold: 70,
        timeframe: TimeFrame.H12,
        pairing: Pairing.USD,
        message: 'RSI Overbought detected!',
        status: AlertStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDiscoveryAlert: true
      }
    ];
  }

  async getAllAlerts(telegramId: string): Promise<Alert[]> {
    this.logger.log(`Getting all alerts for user ${telegramId}`);
    return this.alerts.filter(alert => alert.telegramUserId === telegramId || alert.telegramGroupId === telegramId);
  }

  async getWatchlistAlerts(telegramId: string, watchlistId?: string): Promise<Alert[]> {
    this.logger.log(`Getting watchlist alerts for user ${telegramId}${watchlistId ? ` and watchlist ${watchlistId}` : ''}`);
    return this.alerts.filter(alert => 
      (alert.telegramUserId === telegramId || alert.telegramGroupId === telegramId) && 
      !alert.isDiscoveryAlert &&
      (watchlistId ? alert.watchlistId === watchlistId : true)
    );
  }

  async getDiscoveryAlerts(telegramId: string): Promise<Alert[]> {
    this.logger.log(`Getting discovery alerts for user ${telegramId}`);
    return this.alerts.filter(alert => 
      (alert.telegramUserId === telegramId || alert.telegramGroupId === telegramId) && 
      alert.isDiscoveryAlert
    );
  }

  async getAlertById(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.find(a => a.id === alertId);
    return alert || null;
  }

  async createAlert(createAlertDto: CreateAlertDto): Promise<Alert> {
    this.logger.log(`Creating new alert: ${JSON.stringify(createAlertDto)}`);
    
    // Check limits
    if (createAlertDto.isDiscoveryAlert) {
      const userDiscoveryAlerts = this.alerts.filter(alert => 
        (alert.telegramUserId === createAlertDto.telegramUserId || 
         alert.telegramGroupId === createAlertDto.telegramGroupId) && 
        alert.isDiscoveryAlert
      );
      
      if (userDiscoveryAlerts.length >= this.DISCOVERY_ALERTS_LIMIT) {
        throw new Error(`Discovery alerts limit reached (max: ${this.DISCOVERY_ALERTS_LIMIT})`);
      }
    } else if (createAlertDto.watchlistId) {
      const watchlistAlerts = this.alerts.filter(alert => 
        alert.watchlistId === createAlertDto.watchlistId
      );
      
      if (watchlistAlerts.length >= this.ALERTS_PER_WATCHLIST_LIMIT) {
        throw new Error(`Watchlist alerts limit reached (max: ${this.ALERTS_PER_WATCHLIST_LIMIT})`);
      }
    }
    
    // Create new alert
    const newAlert: Alert = {
      id: uuidv4(),
      userId: createAlertDto.userId,
      telegramUserId: createAlertDto.telegramUserId,
      telegramGroupId: createAlertDto.telegramGroupId,
      coinIdentifier: createAlertDto.coinIdentifier || 'all',
      watchlistId: createAlertDto.watchlistId,
      alertType: createAlertDto.alertType,
      threshold: createAlertDto.threshold,
      timeframe: createAlertDto.timeframe,
      pairing: createAlertDto.pairing,
      message: createAlertDto.message,
      status: AlertStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDiscoveryAlert: createAlertDto.isDiscoveryAlert || false
    };
    
    // Add mock coin data if not a discovery alert
    if (!newAlert.isDiscoveryAlert && newAlert.coinIdentifier !== 'all') {
      // In a real implementation, you would fetch this data from a service
      if (newAlert.coinIdentifier === 'bitcoin') {
        newAlert.coinName = 'Bitcoin';
        newAlert.coinSymbol = 'BTC';
      } else if (newAlert.coinIdentifier === 'ethereum') {
        newAlert.coinName = 'Ethereum';
        newAlert.coinSymbol = 'ETH';
      } else {
        // Generic mock data
        newAlert.coinName = newAlert.coinIdentifier.charAt(0).toUpperCase() + newAlert.coinIdentifier.slice(1);
        newAlert.coinSymbol = newAlert.coinIdentifier.substring(0, 3).toUpperCase();
      }
    }
    
    // Add mock watchlist data if specified
    if (newAlert.watchlistId) {
      // Mock watchlist lookup
      if (newAlert.watchlistId === 'watch1') {
        newAlert.watchlistName = 'Top DeFi';
      } else if (newAlert.watchlistId === 'watch2') {
        newAlert.watchlistName = 'Market Leaders';
      } else {
        newAlert.watchlistName = `Watchlist ${newAlert.watchlistId.substring(0, 4)}`;
      }
    }
    
    this.alerts.push(newAlert);
    return newAlert;
  }

  async updateAlert(updateAlertDto: UpdateAlertDto): Promise<Alert> {
    this.logger.log(`Updating alert ${updateAlertDto.alertId}`);
    
    const alertIndex = this.alerts.findIndex(a => a.id === updateAlertDto.alertId);
    
    if (alertIndex === -1) {
      throw new Error(`Alert with ID ${updateAlertDto.alertId} not found`);
    }
    
    const alert = this.alerts[alertIndex];
    
    // Update fields
    if (updateAlertDto.name !== undefined) {
      alert.name = updateAlertDto.name;
    }
    
    if (updateAlertDto.threshold !== undefined) {
      alert.threshold = updateAlertDto.threshold;
    }
    
    if (updateAlertDto.message !== undefined) {
      alert.message = updateAlertDto.message;
    }
    
    if (updateAlertDto.status !== undefined) {
      alert.status = updateAlertDto.status;
    }
    
    alert.updatedAt = new Date();
    
    this.alerts[alertIndex] = alert;
    
    return alert;
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    this.logger.log(`Deleting alert ${alertId}`);
    
    const initialLength = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.id !== alertId);
    
    return this.alerts.length < initialLength;
  }

  getAlertsLimits() {
    return {
      watchlistLimit: this.ALERTS_PER_WATCHLIST_LIMIT,
      discoveryLimit: this.DISCOVERY_ALERTS_LIMIT
    };
  }

  // Helper to get user-friendly name of alert type
  static getAlertTypeName(type: AlertType): string {
    const names = {
      [AlertType.PRICE_UP]: 'Price Above',
      [AlertType.PRICE_DOWN]: 'Price Below',
      [AlertType.PRICE_PERCENTAGE_UP]: 'Price Up %',
      [AlertType.PRICE_PERCENTAGE_DOWN]: 'Price Down %',
      [AlertType.VOLUME_UP]: 'Volume Above',
      [AlertType.VOLUME_DOWN]: 'Volume Below',
      [AlertType.RSI_OVERBOUGHT]: 'RSI Overbought',
      [AlertType.RSI_OVERSOLD]: 'RSI Oversold',
      [AlertType.MACD_CROSSOVER]: 'MACD Crossover',
      [AlertType.MACD_CROSSUNDER]: 'MACD Crossunder',
      [AlertType.MOVING_AVERAGE_CROSSOVER]: 'MA Crossover',
      [AlertType.MOVING_AVERAGE_CROSSUNDER]: 'MA Crossunder',
    };
    
    return names[type] || type;
  }

  // Helper to get user-friendly name of timeframe
  static getTimeFrameName(timeframe: TimeFrame): string {
    const names = {

      [TimeFrame.H1]: '1h',
      [TimeFrame.H4]: '4h',
      [TimeFrame.H6]: '6h',
      [TimeFrame.H12]: '12h',
      [TimeFrame.D1]: '1d',
      [TimeFrame.D3]: '1w',
      [TimeFrame.W1]: '1w',
      [TimeFrame.M1]: '1m',
    };
    
    return names[timeframe] || timeframe;
  }
}