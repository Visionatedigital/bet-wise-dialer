import { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Download, Users, TrendingUp, Phone, Target, AlertCircle } from 'lucide-react';
import { useAdminReports } from '@/hooks/useAdminReports';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const AdminReports = () => {
  const [dateRange, setDateRange] = useState('30d');
  const { metrics, loading } = useAdminReports(dateRange);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Reports</h1>
            <p className="text-muted-foreground">Comprehensive system-wide analytics and reports</p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.totalAgents} agents, {metrics.activeAgents} active
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.activeAgents}</div>
                  <p className="text-xs text-muted-foreground">
                    of {metrics.totalAgents} total agents
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalCallsThisMonth}</div>
                  <p className="text-xs text-muted-foreground">
                    This month ({metrics.totalCalls} in period)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalLeads}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all segments
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lead Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Segments Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge className="bg-yellow-500">VIP</Badge>
                    <span className="font-medium">VIP Customers</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{metrics.leadsBySegment.vip}</div>
                    <p className="text-xs text-muted-foreground">
                      {((metrics.leadsBySegment.vip / metrics.totalLeads) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge className="bg-blue-500">Semi-Active</Badge>
                    <span className="font-medium">Semi-Active Users</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{metrics.leadsBySegment.semiActive}</div>
                    <p className="text-xs text-muted-foreground">
                      {((metrics.leadsBySegment.semiActive / metrics.totalLeads) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">Dormant</Badge>
                    <span className="font-medium">Dormant Users</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{metrics.leadsBySegment.dormant}</div>
                    <p className="text-xs text-muted-foreground">
                      {((metrics.leadsBySegment.dormant / metrics.totalLeads) * 100).toFixed(1)}% of total
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Call Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.callsByStatus.connected}</div>
                  <p className="text-xs text-muted-foreground">
                    {((metrics.callsByStatus.connected / metrics.totalCalls) * 100).toFixed(1)}% success rate
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium">Converted</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.callsByStatus.converted}</div>
                  <p className="text-xs text-muted-foreground">
                    {((metrics.callsByStatus.converted / metrics.callsByStatus.connected) * 100).toFixed(1)}% conversion rate
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Failed</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.callsByStatus.failed}</div>
                  <p className="text-xs text-muted-foreground">
                    {((metrics.callsByStatus.failed / metrics.totalCalls) * 100).toFixed(1)}% failure rate
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
