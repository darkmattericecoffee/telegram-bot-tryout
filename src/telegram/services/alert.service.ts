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

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alerts: Map<string, AlertConfig> = new Map();
  private alertCounter = 1;

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