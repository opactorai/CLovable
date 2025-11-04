'use client';

import { useState, useEffect } from 'react';
import { Users, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { clientLogger } from '@/lib/client-logger';

interface AnalyticsTabProps {
  projectId: string;
}

interface AnalyticsData {
  deployed: boolean;
  message?: string;
  deployedAt?: string;
  hostname: string | null;
  totals: {
    visitors: number;
  };
  timeseries: Array<{
    timestamp: string;
    visitors: number;
  }>;
  countryBreakdown?: Array<{
    country: string;
    visitors: number;
    percentage: number;
  }>;
  deviceBreakdown?: Array<{
    deviceType: string;
    visitors: number;
    percentage: number;
  }>;
}

export default function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsWindow, setAnalyticsWindow] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState<'visitors'>('visitors');

  const fetchAnalytics = async (skipCache: boolean = false) => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      const data = await apiClient.getProjectAnalytics(projectId, analyticsWindow, skipCache);

      clientLogger.debug('Analytics data received:', data);
      clientLogger.debug('Timeseries data:', data.timeseries);
      clientLogger.debug('Timeseries length:', data.timeseries?.length);

      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setAnalyticsError(error instanceof Error ? error.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics(true); // Skip cache on manual refresh
  };

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, analyticsWindow]);

  return (
    <div className="h-full bg-primary p-3 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          {analytics?.hostname && (
            <span className="text-xs text-tertiary">
              {analytics.hostname}
            </span>
          )}
          <span className="flex items-center gap-2 text-xs text-tertiary">
            <span className="w-2 h-2 rounded-full bg-interactive-primary"></span>
            0 current visitors
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={analyticsLoading}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${analyticsLoading ? 'animate-spin' : ''}`} />
          </button>
          <select
            value={analyticsWindow}
            onChange={(e) => setAnalyticsWindow(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-primary rounded-lg bg-white dark:bg-secondary text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-600"
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400"></div>
        </div>
      ) : analyticsError ? (
        <div
          className="p-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
        >
          <p className="text-sm text-red-600 dark:text-red-400">
            {analyticsError}
          </p>
        </div>
      ) : analytics && !analytics.deployed ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <img
                src="/assets/logo_svg/clink_logo_black.svg"
                alt="Clink Logo"
                className="w-full h-full object-contain dark:hidden"
              />
              <img
                src="/assets/logo_svg/clink_logo_white.svg"
                alt="Clink Logo"
                className="w-full h-full object-contain hidden dark:block"
              />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                Project has not been published yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Publish your project to start tracking analytics
              </p>
            </div>
          </div>
        </div>
      ) : analytics ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="pt-2 flex-shrink-0">
            <div className="text-left bg-white dark:bg-secondary rounded-lg border border-primary dark:border-primary p-2">
              <div className="text-xs font-medium mb-0.5 text-primary dark:text-secondary">
                Visitors
              </div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {(analytics.totals.visitors ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-primary p-3 mt-2 flex-shrink-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Note: Analytics data may have a delay of a few minutes.
            </div>
            <div className="relative h-48">
              {analytics.timeseries && analytics.timeseries.length > 0 ? (
                <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="0" x2="1000" y2="0" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                  <line x1="0" y1="50" x2="1000" y2="50" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                  <line x1="0" y1="100" x2="1000" y2="100" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                  <line x1="0" y1="150" x2="1000" y2="150" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                  <line x1="0" y1="200" x2="1000" y2="200" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />

                  {/* Data line - only show if more than 1 point */}
                  {analytics.timeseries.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      points={analytics.timeseries.map((point, index) => {
                        const x = (index / (analytics.timeseries.length - 1)) * 1000;
                        const value = point.visitors || 0;
                        const maxValue = Math.max(...analytics.timeseries.map(p => p.visitors || 0), 1);
                        const y = 200 - (value / maxValue) * 180;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                  )}

                  {/* Single point - show as circle if only 1 point */}
                  {analytics.timeseries.length === 1 && (
                    <circle
                      cx="500"
                      cy={200 - ((analytics.timeseries[0].visitors || 0) / Math.max(analytics.timeseries[0].visitors || 0, 1)) * 180}
                      r="6"
                      fill="#3b82f6"
                    />
                  )}

                  {/* Area fill - only show if more than 1 point */}
                  {analytics.timeseries.length > 1 && (
                    <polygon
                      fill="url(#gradient)"
                      opacity="0.2"
                      points={
                        analytics.timeseries.map((point, index) => {
                          const x = (index / (analytics.timeseries.length - 1)) * 1000;
                          const value = point.visitors || 0;
                          const maxValue = Math.max(...analytics.timeseries.map(p => p.visitors || 0), 1);
                          const y = 200 - (value / maxValue) * 180;
                          return `${x},${y}`;
                        }).join(' ') + ' 1000,200 0,200'
                      }
                    />
                  )}

                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No data for selected time period
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section with Tables */}
          <div className="grid grid-cols-2 gap-2 mt-2 flex-1 min-h-0">
            {/* Country */}
            <div className="bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-primary p-2">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100 dark:border-primary">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Country</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Visitors</span>
              </div>
              {analytics.countryBreakdown && analytics.countryBreakdown.length > 0 ? (
                <div className="space-y-2">
                  {analytics.countryBreakdown.slice(0, 2).map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{item.country}</span>
                        <span className="text-gray-500 dark:text-gray-400">{item.visitors.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-400 h-1 rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 py-2 text-center">No data found for this time period.</div>
              )}
            </div>

            {/* Device */}
            <div className="bg-white dark:bg-secondary rounded-lg border border-gray-200 dark:border-primary p-2">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-100 dark:border-primary">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Device</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Visitors</span>
              </div>
              {analytics.deviceBreakdown && analytics.deviceBreakdown.length > 0 ? (
                <div className="space-y-2">
                  {analytics.deviceBreakdown.slice(0, 2).map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 font-medium capitalize">{item.deviceType}</span>
                        <span className="text-gray-500 dark:text-gray-400">{item.visitors.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-400 h-1 rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 py-2 text-center">No data found for this time period.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
        >
          <p className="text-sm text-gray-700 dark:text-gray-300">
            No analytics data available yet.
          </p>
        </div>
      )}
    </div>
  );
}
