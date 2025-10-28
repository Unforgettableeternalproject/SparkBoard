import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertCircle, Activity, TrendingUp, TrendingDown, RefreshCw, Shield } from 'lucide-react';

interface MetricData {
  timestamp: number;
  value: number;
}

interface Metric {
  label: string;
  datapoints: MetricData[];
}

interface Metrics {
  api: {
    requestCount: Metric;
    errorRate4xx: Metric;
    errorRate5xx: Metric;
    latency: Metric;
  };
  lambda: {
    [functionName: string]: {
      duration: Metric;
      errors: Metric;
      throttles: Metric;
    };
  };
  dynamodb: {
    readCapacity: Metric;
    writeCapacity: Metric;
  };
}

interface TraceSummary {
  Id: string;
  Duration: number;
  ResponseTime: number;
  Http?: {
    HttpURL?: string;
    HttpStatus?: number;
    HttpMethod?: string;
  };
}

interface Trace {
  Id: string;
  Duration: number;
  Segments: any[];
}

interface Traces {
  summaries: TraceSummary[];
  traces: Trace[];
}

interface AlarmState {
  AlarmName: string;
  StateValue: string;
  StateReason: string;
  StateUpdatedTimestamp: string;
}

interface Alarms {
  alarms: AlarmState[];
  summary: {
    ok: number;
    alarm: number;
    insufficient: number;
  };
}

export function MonitoringDashboard() {
  const { user, idToken } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [traces, setTraces] = useState<Traces | null>(null);
  const [alarms, setAlarms] = useState<Alarms | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Check if user is admin
  useEffect(() => {
    if (user) {
      const groups = user['cognito:groups'] || [];
      setIsAdmin(groups.includes('Admin'));
    }
  }, [user]);

  // Fetch monitoring data
  const fetchMonitoringData = async () => {
    if (!idToken) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch metrics
      const metricsResponse = await fetch(`${API_URL}/monitoring/metrics`, {
        headers: {
          Authorization: idToken,
        },
      });
      if (!metricsResponse.ok) throw new Error(`Metrics: ${metricsResponse.statusText}`);
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);

      // Fetch traces
      const tracesResponse = await fetch(`${API_URL}/monitoring/traces`, {
        headers: {
          Authorization: idToken,
        },
      });
      if (!tracesResponse.ok) throw new Error(`Traces: ${tracesResponse.statusText}`);
      const tracesData = await tracesResponse.json();
      setTraces(tracesData);

      // Fetch alarms
      const alarmsResponse = await fetch(`${API_URL}/monitoring/alarms`, {
        headers: {
          Authorization: idToken,
        },
      });
      if (!alarmsResponse.ok) throw new Error(`Alarms: ${alarmsResponse.statusText}`);
      const alarmsData = await alarmsResponse.json();
      setAlarms(alarmsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && idToken) {
      fetchMonitoringData();
      // Auto-refresh every 60 seconds
      const interval = setInterval(fetchMonitoringData, 60000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, idToken]);

  // Helper function to get latest metric value
  const getLatestValue = (metric?: Metric): string => {
    if (!metric || !metric.datapoints || metric.datapoints.length === 0) {
      return 'N/A';
    }
    const latest = metric.datapoints[metric.datapoints.length - 1];
    return latest.value.toFixed(2);
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: number | string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Helper function to get alarm badge variant
  const getAlarmBadgeVariant = (state: string): 'default' | 'destructive' | 'secondary' => {
    switch (state) {
      case 'ALARM':
        return 'destructive';
      case 'OK':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please log in to access the monitoring dashboard.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need administrator privileges to access this dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring Dashboard</h1>
          <p className="text-muted-foreground">Real-time system metrics and alerts</p>
        </div>
        <Button onClick={fetchMonitoringData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Alarms Overview */}
      {alarms && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">OK Alarms</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{alarms.summary.ok}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alarms</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{alarms.summary.alarm}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Insufficient Data</CardTitle>
              <Activity className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{alarms.summary.insufficient}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="traces">Traces</TabsTrigger>
          <TabsTrigger value="alarms">Alarms</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          {/* API Metrics */}
          {metrics?.api && (
            <Card>
              <CardHeader>
                <CardTitle>API Gateway Metrics</CardTitle>
                <CardDescription>Last 1 hour API performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Request Count</p>
                    <p className="text-2xl font-bold">{getLatestValue(metrics.api.requestCount)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">4xx Error Rate</p>
                    <p className="text-2xl font-bold">{getLatestValue(metrics.api.errorRate4xx)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">5xx Error Rate</p>
                    <p className="text-2xl font-bold text-red-600">
                      {getLatestValue(metrics.api.errorRate5xx)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Latency (ms)</p>
                    <p className="text-2xl font-bold">{getLatestValue(metrics.api.latency)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lambda Metrics */}
          {metrics?.lambda && (
            <Card>
              <CardHeader>
                <CardTitle>Lambda Functions</CardTitle>
                <CardDescription>Function performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(metrics.lambda).map(([functionName, functionMetrics]) => (
                    <div key={functionName} className="border-b pb-4 last:border-0">
                      <h4 className="font-semibold mb-2">{functionName}</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Duration (ms)</p>
                          <p className="text-xl font-bold">
                            {getLatestValue(functionMetrics.duration)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Errors</p>
                          <p className="text-xl font-bold text-red-600">
                            {getLatestValue(functionMetrics.errors)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Throttles</p>
                          <p className="text-xl font-bold text-orange-600">
                            {getLatestValue(functionMetrics.throttles)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* DynamoDB Metrics */}
          {metrics?.dynamodb && (
            <Card>
              <CardHeader>
                <CardTitle>DynamoDB Table</CardTitle>
                <CardDescription>Capacity utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Read Capacity</p>
                    <p className="text-2xl font-bold">
                      {getLatestValue(metrics.dynamodb.readCapacity)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Write Capacity</p>
                    <p className="text-2xl font-bold">
                      {getLatestValue(metrics.dynamodb.writeCapacity)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="traces" className="space-y-4">
          {traces && (
            <Card>
              <CardHeader>
                <CardTitle>X-Ray Traces</CardTitle>
                <CardDescription>Recent request traces (last 10 minutes)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {traces.summaries.length === 0 ? (
                    <p className="text-muted-foreground">No traces found</p>
                  ) : (
                    traces.summaries.map((trace) => (
                      <div
                        key={trace.Id}
                        className="flex items-center justify-between border-b pb-2 last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-mono text-sm">{trace.Id.substring(0, 20)}...</p>
                          {trace.Http && (
                            <p className="text-sm text-muted-foreground">
                              {trace.Http.HttpMethod} {trace.Http.HttpURL}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {trace.Http?.HttpStatus && (
                            <Badge
                              variant={
                                trace.Http.HttpStatus >= 500
                                  ? 'destructive'
                                  : trace.Http.HttpStatus >= 400
                                  ? 'secondary'
                                  : 'default'
                              }
                            >
                              {trace.Http.HttpStatus}
                            </Badge>
                          )}
                          <span className="text-sm font-medium">{trace.Duration.toFixed(2)}s</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alarms" className="space-y-4">
          {alarms && (
            <Card>
              <CardHeader>
                <CardTitle>CloudWatch Alarms</CardTitle>
                <CardDescription>Current alarm states</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alarms.alarms.map((alarm) => (
                    <div
                      key={alarm.AlarmName}
                      className="flex items-center justify-between border-b pb-3 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{alarm.AlarmName}</p>
                        <p className="text-sm text-muted-foreground">{alarm.StateReason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated: {formatTimestamp(alarm.StateUpdatedTimestamp)}
                        </p>
                      </div>
                      <Badge variant={getAlarmBadgeVariant(alarm.StateValue)}>
                        {alarm.StateValue}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
