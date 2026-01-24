"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import {
  QrCode,
  Coins,
  Gift,
  Users,
  Store,
  TrendingUp,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQRCodes: 0,
    totalPointsCreated: 0,
    pointsEarned: 0,
    activePoints: 0,
    totalPointsRedeemed: 0,
    totalRewardsRedeemed: 0,
    totalRewards: 0,
    totalUsers: 0,
    pendingRedemptions: 0,
    completedRedemptions: 0,
  });
  const [storeActivity, setStoreActivity] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all stats in parallel
      const [
        qrCodesResult,
        redemptionsResult,
        rewardsResult,
        usersResult,
        storeScansResult,
        recentTxResult,
      ] = await Promise.all([
        // Total QR codes and points with active status
        supabase.from("qr_codes").select("id, points, active"),
        // Redemptions stats
        supabase.from("redemptions").select("id, points_spent, status"),
        // Total rewards
        supabase.from("rewards").select("id", { count: "exact" }),
        // Total users
        supabase.from("profiles").select("id", { count: "exact" }),
        // Store-wise activity (join with stores)
        supabase.from("qr_scan_logs").select("store_id, id"),
        // Recent transactions
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      // Calculate QR stats
      const qrCodes = qrCodesResult.data || [];
      const totalQRCodes = qrCodes.length;
      const totalPointsCreated = qrCodes.reduce((sum, qr) => sum + (qr.points || 0), 0);

      // Points earned = QR codes with active=false (scanned/used)
      const pointsEarned = qrCodes
        .filter(qr => qr.active === false)
        .reduce((sum, qr) => sum + (qr.points || 0), 0);

      // Active points = QR codes with active=true (not yet scanned)
      const activePoints = qrCodes
        .filter(qr => qr.active === true)
        .reduce((sum, qr) => sum + (qr.points || 0), 0);

      // Calculate redemption stats
      const redemptions = redemptionsResult.data || [];
      const totalPointsRedeemed = redemptions.reduce((sum, r) => sum + (r.points_spent || 0), 0);
      const totalRewardsRedeemed = redemptions.length;
      const pendingRedemptions = redemptions.filter(r => r.status?.toUpperCase() === "PENDING").length;
      const completedRedemptions = redemptions.filter(r => r.status?.toUpperCase() === "COMPLETED").length;

      // Set basic stats
      setStats({
        totalQRCodes,
        totalPointsCreated,
        pointsEarned,
        activePoints,
        totalPointsRedeemed,
        totalRewardsRedeemed,
        totalRewards: rewardsResult.count || 0,
        totalUsers: usersResult.count || 0,
        pendingRedemptions,
        completedRedemptions,
      });

      // Calculate store-wise activity
      const scanLogs = storeScansResult.data || [];
      const storeScans = {};
      scanLogs.forEach(log => {
        if (log.store_id) {
          storeScans[log.store_id] = (storeScans[log.store_id] || 0) + 1;
        }
      });

      // Fetch store names for the activity
      const storeIds = Object.keys(storeScans);
      if (storeIds.length > 0) {
        const storesResult = await supabase
          .from("stores")
          .select("id, name, location")
          .in("id", storeIds);

        const storeMap = new Map((storesResult.data || []).map(s => [s.id, s]));
        const activityData = storeIds.map(storeId => ({
          id: storeId,
          name: storeMap.get(storeId)?.name || "Unknown Store",
          location: storeMap.get(storeId)?.location || "",
          scans: storeScans[storeId],
        })).sort((a, b) => b.scans - a.scans);

        setStoreActivity(activityData);
      }

      // Set recent transactions
      setRecentTransactions(recentTxResult.data || []);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const StatCard = ({ title, value, description, icon: Icon, color = "text-primary", loading }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`size-5 ${color}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 animate-pulse bg-muted rounded" />
        ) : (
          <>
            <div className="text-2xl font-bold">{formatNumber(value)}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <PageLayout title="Dashboard" breadcrumbItems={[
      { label: "Dashboard", href: "/dashboard" },
      { label: "Overview" }
    ]}>
      <div className="space-y-6">
        {/* Header with Refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Analytics Overview</h2>
            <p className="text-muted-foreground">Key metrics and performance indicators</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid - Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total QR Codes"
            value={stats.totalQRCodes}
            description="QR codes created"
            icon={QrCode}
            color="text-blue-500"
            loading={loading}
          />
          <StatCard
            title="Total Points Created"
            value={stats.totalPointsCreated}
            description="Points value in QR codes"
            icon={Coins}
            color="text-yellow-500"
            loading={loading}
          />
          <StatCard
            title="Points Earned"
            value={stats.pointsEarned}
            description="Points earned by users (scanned QR codes)"
            icon={ArrowDownCircle}
            color="text-orange-500"
            loading={loading}
          />
          <StatCard
            title="Active Points"
            value={stats.activePoints}
            description="Points available in unscanned QR codes"
            icon={TrendingUp}
            color="text-green-500"
            loading={loading}
          />
        </div>

        {/* Stats Grid - Row 2 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            description="Registered users"
            icon={Users}
            color="text-purple-500"
            loading={loading}
          />
          <StatCard
            title="Rewards Available"
            value={stats.totalRewards}
            description="Active rewards in catalog"
            icon={Gift}
            color="text-pink-500"
            loading={loading}
          />
          <StatCard
            title="Rewards Redeemed"
            value={stats.totalRewardsRedeemed}
            description={`${stats.pendingRedemptions} pending, ${stats.completedRedemptions} completed`}
            icon={CheckCircle2}
            color="text-green-500"
            loading={loading}
          />
          <StatCard
            title="Pending Redemptions"
            value={stats.pendingRedemptions}
            description="Awaiting processing"
            icon={Clock}
            color="text-orange-500"
            loading={loading}
          />
        </div>

        {/* Store Activity and Recent Transactions */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Store-wise Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-5" />
                Store-wise Scanning Activity
              </CardTitle>
              <CardDescription>QR code scans by store</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : storeActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No scanning activity found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Store</TableHead>
                        <TableHead className="text-right">Scans</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storeActivity.slice(0, 5).map((store) => (
                        <TableRow key={store.id}>
                          <TableCell>
                            <div className="font-medium">{store.name}</div>
                            {store.location && (
                              <div className="text-xs text-muted-foreground">{store.location}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatNumber(store.scans)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5" />
                Recent Transactions
              </CardTitle>
              <CardDescription>Latest point activities</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.slice(0, 5).map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {tx.type?.toLowerCase() === "earn" ? (
                                <ArrowUpCircle className="size-4 text-green-500" />
                              ) : (
                                <ArrowDownCircle className="size-4 text-red-500" />
                              )}
                              <span className="font-medium capitalize">{tx.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${tx.type?.toLowerCase() === "earn" ? "text-green-600" : "text-red-600"
                            }`}>
                            {tx.type?.toLowerCase() === "earn" ? "+" : "-"}{tx.amount}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
