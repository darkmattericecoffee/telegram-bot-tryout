// src/telegram/services/alert.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OptionsType } from './options.service';

// Alert type definitions
export interface AlertLimits {
  watchlistLimit: number;
  discoveryLimit: number;
  indicatorLimit: number;
}

export enum AlertType {
  WATCHLIST = 'watchlist',
  DISCOVERY = 'discovery'
}

export enum AlertNotificationType {
  HORIZON_SCORE = 'horizon_score',
  INDIVIDUAL_INDICATORS = 'individual_indicators'
}

export interface Coin {
  id: string;
  name: string;
  symbol: string;
}

export interface AlertConfig {
  id?: string; // Auto-generated if not provided
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
  remaining: {
    watchlist: number;
    discovery: number;
  };
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alerts: Map<string, AlertConfig> = new Map();
  private alertCounter = 1;

  constructor() {
    // Initialize with some mock alerts for demonstration
    this.initializeMockAlerts();
  }

  /**
   * Initialize some mock alerts for demonstration
   */
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
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
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
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        active: true
      },
      {
        id: `alert_${this.alertCounter++}`,
        userId: "12345",
        name: "Top 10 Watchlist Alert",
        type: AlertType.WATCHLIST,
        targetId: "watchlist_1",
        targetName: "Top 10",
        notificationType: AlertNotificationType.HORIZON_SCORE,
        pairing: "BTC",
        timeframe: "1W",
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        active: true
      }
    ];

    // Add mock alerts to the map
    mockAlerts.forEach(alert => {
      this.alerts.set(alert.id!, alert);
    });

    this.logger.log(`Initialized ${mockAlerts.length} mock alerts`);
  }

  /**
   * Create a new alert
   * @param config Alert configuration
   * @returns Created alert with generated ID
   */
  async createAlert(config: Omit<AlertConfig, 'id' | 'createdAt'>): Promise<AlertConfig> {
    // Generate unique ID if not provided
    const alertId = `alert_${this.alertCounter++}`;
    
    const newAlert: AlertConfig = {
      ...config,
      id: alertId,
      createdAt: new Date(),
      active: true
    };
    
    // Store the alert
    this.alerts.set(alertId, newAlert);
    this.logger.log(`Created alert: ${alertId} - ${newAlert.name}`);
    
    // Simulate API call
    await this.mockApiCall('createAlert', newAlert);
    
    return newAlert;
  }

  /**
   * Get all alerts for a user
   * @param userId User ID
   * @param type Optional filter by alert type
   * @returns Array of alerts
   */
  async getAlerts(userId: string, type?: AlertType): Promise<AlertConfig[]> {
    // Simulate API call
    await this.mockApiCall('getAlerts', { userId, type });
    
    // Filter alerts by userId and optional type
    return Array.from(this.alerts.values()).filter(alert => 
      alert.userId === userId && 
      (type === undefined || alert.type === type)
    );
  }

  /**
   * Get a summary of alerts for a user
   * @param userId User ID
   * @returns Summary of alerts counts and limits
   */
  async getAlertsSummary(userId: string): Promise<AlertsSummary> {
    // Get all alerts for the user
    const userAlerts = await this.getAlerts(userId);
    
    // Count watchlist and discovery alerts
    const watchlistAlerts = userAlerts.filter(a => a.type === AlertType.WATCHLIST).length;
    const discoveryAlerts = userAlerts.filter(a => a.type === AlertType.DISCOVERY).length;
    
    // Get limits
    const limits = this.getAlertsLimits();
    
    return {
      totalAlerts: userAlerts.length,
      watchlistAlerts,
      discoveryAlerts,
      remaining: {
        watchlist: limits.watchlistLimit - watchlistAlerts,
        discovery: limits.discoveryLimit - discoveryAlerts
      }
    };
  }

  /**
   * Delete an alert by ID
   * @param alertId Alert ID
   * @returns True if alert was deleted
   */
  async deleteAlert(alertId: string): Promise<boolean> {
    // Simulate API call
    await this.mockApiCall('deleteAlert', { alertId });
    
    const result = this.alerts.delete(alertId);
    if (result) {
      this.logger.log(`Deleted alert: ${alertId}`);
    } else {
      this.logger.warn(`Alert not found for deletion: ${alertId}`);
    }
    
    return result;
  }

  /**
   * Toggle alert active status
   * @param alertId Alert ID
   * @returns Updated alert or null if not found
   */
  async toggleAlertStatus(alertId: string): Promise<AlertConfig | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      this.logger.warn(`Alert not found for toggle: ${alertId}`);
      return null;
    }
    
    // Toggle status
    alert.active = !alert.active;
    this.alerts.set(alertId, alert);
    this.logger.log(`Toggle alert status: ${alertId} - now ${alert.active ? 'active' : 'inactive'}`);
    
    // Simulate API call
    await this.mockApiCall('toggleAlert', { alertId, active: alert.active });
    
    return alert;
  }

  /**
   * Remove a specific indicator from an alert
   * @param alertId Alert ID
   * @param indicator Indicator name to remove
   * @returns Updated alert or null if not found
   */
  async removeIndicator(alertId: string, indicator: string): Promise<AlertConfig | null> {
    const alert = this.alerts.get(alertId);
    if (!alert || !alert.indicators) {
      this.logger.warn(`Alert not found or no indicators for removal: ${alertId}`);
      return null;
    }
    
    // Remove the indicator
    alert.indicators = alert.indicators.filter(ind => ind !== indicator);
    
    // If no indicators left and type is INDIVIDUAL_INDICATORS, delete the alert
    if (alert.indicators.length === 0 && 
        alert.notificationType === AlertNotificationType.INDIVIDUAL_INDICATORS) {
      await this.deleteAlert(alertId);
      return null;
    }
    
    // Otherwise update the alert
    this.alerts.set(alertId, alert);
    this.logger.log(`Removed indicator ${indicator} from alert: ${alertId}`);
    
    // Simulate API call
    await this.mockApiCall('removeIndicator', { alertId, indicator });
    
    return alert;
  }

  /**
   * Get alert limits
   * @returns Alert limits configuration
   */
  getAlertsLimits(): AlertLimits {
    return {
      watchlistLimit: 10,
      discoveryLimit: 5,
      indicatorLimit: 3
    };
  }

  /**
   * Mock API call for testing
   * @param endpoint API endpoint
   * @param data Data to send
   * @returns Mock response
   */
  private async mockApiCall(endpoint: string, data: any): Promise<any> {
    this.logger.debug(`API call to ${endpoint} with data:`, data);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true, timestamp: new Date().toISOString() };
  }
}