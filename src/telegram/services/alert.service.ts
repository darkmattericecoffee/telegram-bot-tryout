// src/telegram/services/alert.service.ts
import { Injectable, Logger } from '@nestjs/common';

// Simplified Alert type definitions
export interface AlertLimits {
  watchlistLimit: number;
  discoveryLimit: number;
  indicatorLimit: number;
  priceLevelLimit: number;
}

export enum AlertType {
  WATCHLIST = 'watchlist',
  DISCOVERY = 'discovery',
  PRICE_LEVEL = 'price_level'
}

export enum AlertNotificationType {
  HORIZON_SCORE = 'horizon_score',
  INDIVIDUAL_INDICATORS = 'individual_indicators',
  PRICE_BREAK = 'price_break'
}

export interface Coin {
  id: string;
  name: string;
  symbol: string;
}

export interface AlertConfig {
  id?: string;
  userId: string;
  name: string;
  type: AlertType;
  targetId: string; // Can be a coin ID or watchlist ID depending on type
  targetName: string; // Coin name or watchlist name
  notificationType: AlertNotificationType;
  indicators?: string[]; // Only used if notificationType is INDIVIDUAL_INDICATORS
  pairing: string; // USD, BTC, ETH, etc.
  timeframe: string; // 6h, 12h, 1D, 1W, 1M
  createdAt: Date;
  active: boolean;
}

export interface AlertsSummary {
  totalAlerts: number;
  watchlistAlerts: number;
  discoveryAlerts: number;
  priceLevelAlerts: number;
  remaining: {
    watchlist: number;
    discovery: number;
    priceLevel: number;
  };
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alerts: Map<string, AlertConfig> = new Map();
  private alertCounter = 1;

  constructor() {
    this.initializeMockAlerts();
  }

  private initializeMockAlerts(): void {
    const mockAlerts: AlertConfig[] = [
      {
        id: `alert_${this.alertCounter++}`,
        userId: "12345",
        name: "Bitcoin Alert",
        type: AlertType.DISCOVERY,
        targetId: "bitcoin",
        targetName: "Bitcoin (BTC)",
        notificationType: AlertNotificationType.INDIVIDUAL_INDICATORS,
        indicators: ["Trend Momentum", "Buying Pressure"],
        pairing: "USD",
        timeframe: "1D",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        active: true
      },
      {
        id: `alert_${this.alertCounter++}`,
        userId: "12345",
        name: "Ethereum Alert",
        type: AlertType.DISCOVERY,
        targetId: "ethereum",
        targetName: "Ethereum (ETH)",
        notificationType: AlertNotificationType.HORIZON_SCORE,
        pairing: "USD",
        timeframe: "6h",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        active: true
      },
      // Updated price level alerts with horizontal level breaks
      {
        id: `alert_${this.alertCounter++}`,
        userId: "12345",
        name: "BTC Price Breaks",
        type: AlertType.PRICE_LEVEL,
        targetId: "bitcoin",
        targetName: "Bitcoin (BTC)",
        notificationType: AlertNotificationType.PRICE_BREAK,
        pairing: "USD",
        timeframe: "1D",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        active: true
      },
      {
        id: `alert_${this.alertCounter++}`,
        userId: "12345",
        name: "ETH Price Breaks",
        type: AlertType.PRICE_LEVEL,
        targetId: "ethereum",
        targetName: "Ethereum (ETH)",
        notificationType: AlertNotificationType.PRICE_BREAK,
        pairing: "USD",
        timeframe: "1D",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        active: true
      }
    ];

    mockAlerts.forEach(alert => {
      this.alerts.set(alert.id!, alert);
    });

    this.logger.log(`Initialized ${mockAlerts.length} mock alerts`);
  }

  // Rest of the service methods remain the same
  async createAlert(config: Omit<AlertConfig, 'id' | 'createdAt'>): Promise<AlertConfig> {
    const alertId = `alert_${this.alertCounter++}`;
    
    const newAlert: AlertConfig = {
      ...config,
      id: alertId,
      createdAt: new Date(),
      active: true
    };
    
    this.alerts.set(alertId, newAlert);
    this.logger.log(`Created alert: ${alertId} - ${newAlert.name}`);
    
    await this.mockApiCall('createAlert', newAlert);
    
    return newAlert;
  }

  async getAlerts(userId: string, type?: AlertType): Promise<AlertConfig[]> {
    await this.mockApiCall('getAlerts', { userId, type });
    
    return Array.from(this.alerts.values()).filter(alert => 
      alert.userId === userId && 
      (type === undefined || alert.type === type)
    );
  }

  async getAlertsSummary(userId: string): Promise<AlertsSummary> {
    const userAlerts = await this.getAlerts(userId);
    
    const watchlistAlerts = userAlerts.filter(a => a.type === AlertType.WATCHLIST).length;
    const discoveryAlerts = userAlerts.filter(a => a.type === AlertType.DISCOVERY).length;
    const priceLevelAlerts = userAlerts.filter(a => a.type === AlertType.PRICE_LEVEL).length;
    
    const limits = this.getAlertsLimits();
    
    return {
      totalAlerts: userAlerts.length,
      watchlistAlerts,
      discoveryAlerts,
      priceLevelAlerts,
      remaining: {
        watchlist: limits.watchlistLimit - watchlistAlerts,
        discovery: limits.discoveryLimit - discoveryAlerts,
        priceLevel: limits.priceLevelLimit - priceLevelAlerts
      }
    };
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    await this.mockApiCall('deleteAlert', { alertId });
    
    const result = this.alerts.delete(alertId);
    if (result) {
      this.logger.log(`Deleted alert: ${alertId}`);
    } else {
      this.logger.warn(`Alert not found for deletion: ${alertId}`);
    }
    
    return result;
  }

  async toggleAlertStatus(alertId: string): Promise<AlertConfig | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      this.logger.warn(`Alert not found for toggle: ${alertId}`);
      return null;
    }
    
    alert.active = !alert.active;
    this.alerts.set(alertId, alert);
    this.logger.log(`Toggle alert status: ${alertId} - now ${alert.active ? 'active' : 'inactive'}`);
    
    await this.mockApiCall('toggleAlert', { alertId, active: alert.active });
    
    return alert;
  }

  getAlertsLimits(): AlertLimits {
    return {
      watchlistLimit: 10,
      discoveryLimit: 5,
      indicatorLimit: 3,
      priceLevelLimit: 15
    };
  }

  private async mockApiCall(endpoint: string, data: any): Promise<any> {
    this.logger.debug(`API call to ${endpoint} with data:`, data);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true, timestamp: new Date().toISOString() };
  }
}