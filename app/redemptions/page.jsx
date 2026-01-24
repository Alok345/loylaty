"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Trash2, RefreshCw, AlertCircle, Save, X, CheckCircle2, Filter, Search, User, Gift, MapPin, Package, Truck, CheckCircle, Clock } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // Popup dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState(null);
  const [fullRewardDetails, setFullRewardDetails] = useState(null);

  useEffect(() => {
    fetchRedemptions();
  }, [statusFilter, startDate, endDate, currentPage, searchQuery]);

  // Reset page when filters change
  const handleStatusChange = (value) => {
    setCurrentPage(1);
    setStatusFilter(value);
  };

  const handleDateApply = (start, end) => {
    setCurrentPage(1);
    setStartDate(start);
    setEndDate(end);
  };

  const handleDateClear = () => {
    setCurrentPage(1);
    setStartDate("");
    setEndDate("");
  };

  const handleSearchChange = (value) => {
    setCurrentPage(1);
    setSearchQuery(value);
  };

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check session first
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Build query with filters and pagination
      let query = supabase
        .from("redemptions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter.toUpperCase());
      }

      // Apply date range filter
      if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        let errorMessage = fetchError.message || "Failed to fetch redemptions";
        if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
          errorMessage = `Row-level security policy violation: ${errorMessage}. Please check your RLS policies for the 'redemptions' table.`;
        }
        throw new Error(errorMessage);
      }

      console.log(`Fetched ${data?.length || 0} redemptions from database`);
      console.log(
        "Redemption IDs:",
        data?.map((r) => r.id),
      );

      // Fetch related data separately and merge
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
        const rewardIds = [...new Set(data.map((r) => r.reward_id).filter(Boolean))];
        const storeIds = [...new Set(data.map((r) => r.store_id).filter(Boolean))];

        console.log(
          "Fetching related data - User IDs:",
          userIds,
          "Reward IDs:",
          rewardIds,
          "Store IDs:",
          storeIds,
        );

        const [profilesData, rewardsData, storesData] = await Promise.all([
          userIds.length > 0
            ? supabase.from("profiles").select("id, full_name, mobile").in("id", userIds)
            : Promise.resolve({ data: [], error: null }),
          rewardIds.length > 0
            ? supabase.from("rewards").select("id, name, cost, image_url, description").in("id", rewardIds)
            : Promise.resolve({ data: [], error: null }),
          storeIds.length > 0
            ? supabase.from("stores").select("id, name, location").in("id", storeIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const profileMap = new Map(
          (profilesData.data || []).map((p) => [p.id, { name: p.full_name, mobile: p.mobile }]),
        );
        const rewardMap = new Map(
          (rewardsData.data || []).map((r) => [r.id, { name: r.name, cost: r.cost, image_url: r.image_url, description: r.description }]),
        );
        const storeMap = new Map(
          (storesData.data || []).map((s) => [s.id, { name: s.name, location: s.location }]),
        );

        // Filter by search query if provided
        let filteredData = data;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchingUserIds = new Set();
          profileMap.forEach((profile, id) => {
            if ((profile.name && profile.name.toLowerCase().includes(query)) ||
              (profile.mobile && profile.mobile.includes(query))) {
              matchingUserIds.add(id);
            }
          });
          filteredData = data.filter(redemption => matchingUserIds.has(redemption.user_id));
        }

        filteredData.forEach((redemption) => {
          const profile = profileMap.get(redemption.user_id);
          redemption.userName = profile?.name || null;
          redemption.userMobile = profile?.mobile || null;

          const reward = rewardMap.get(redemption.reward_id);
          redemption.rewardName = reward?.name || null;
          redemption.rewardCost = reward?.cost || null;
          redemption.rewardImageUrl = reward?.image_url || null;
          redemption.rewardDescription = reward?.description || null;

          const store = storeMap.get(redemption.store_id);
          redemption.storeName = store?.name || null;
          redemption.storeLocation = store?.location || null;
        });

        setRedemptions(filteredData || []);
        setTotalCount(searchQuery.trim() ? filteredData.length : (count || 0));
        return;
      }

      setRedemptions(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching redemptions:", err);
      let errorMessage = err.message || err.toString() || "Failed to fetch redemptions";
      if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
        errorMessage = `Row-level security policy violation: ${errorMessage}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (redemption) => {
    setEditingId(redemption.id);
    setEditStatus(redemption.status || "PENDING");
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditStatus("");
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  const handleSaveStatus = async (id) => {
    try {
      setUpdateError(null);
      setUpdateSuccess(false);

      if (!id) {
        throw new Error("Redemption ID is required");
      }

      // Check session first
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(
          "You must be logged in to update redemptions. Please refresh the page and log in again.",
        );
      }

      const { data, error: updateErr } = await supabase
        .from("redemptions")
        .update({ status: editStatus.toUpperCase() })
        .eq("id", id)
        .select();

      if (updateErr) {
        console.error("Supabase update error:", updateErr);
        throw updateErr;
      }

      // Check if update was successful
      if (!data || data.length === 0) {
        throw new Error(
          "Update completed but no data was returned. The redemption may not exist or RLS policy prevented the update.",
        );
      }

      setUpdateSuccess(true);

      // Refresh the redemptions list and close edit mode after a short delay
      setTimeout(() => {
        setEditingId(null);
        setEditStatus("");
        setUpdateSuccess(false);
        fetchRedemptions();
      }, 1000);
    } catch (err) {

      // Handle different error types
      let errorMessage = "Failed to update redemption status";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err && typeof err === "object") {
        const errMsg = err.message || err.details || err.hint;

        if (errMsg) {
          errorMessage = errMsg;

          // Check for network errors
          if (errMsg.includes("Failed to fetch") || errMsg.includes("ERR_CONNECTION_CLOSED")) {
            errorMessage =
              "Network error: Could not connect to database. Please check your internet connection, refresh the page, and try again.";
          }
          // Check for RLS policy violations
          else if (
            errMsg.includes("row-level security policy") ||
            errMsg.includes("RLS") ||
            errMsg.includes("permission denied") ||
            errMsg.includes("new row violates") ||
            errMsg.toLowerCase().includes("violates row-level security")
          ) {
            errorMessage = `Row-level security policy violation: ${errMsg}. You may need to update your RLS policies in Supabase to allow UPDATE operations on the redemptions table.`;
          }
        } else {
          try {
            errorMessage = JSON.stringify(err);
          } catch {
            errorMessage =
              "An unknown error occurred. Please check the browser console for details.";
          }
        }
      }

      setUpdateError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this redemption?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase.from("redemptions").delete().eq("id", id);

      if (deleteError) throw deleteError;
      fetchRedemptions();
    } catch (err) {
      console.error("Error deleting redemption:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const addDays = (dateString, days) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date;
  };

  const isDatePassed = (dateString, days) => {
    if (!dateString) return false;
    const targetDate = addDays(dateString, days);
    return new Date() >= targetDate;
  };

  const handleRowClick = (redemption) => {
    setSelectedRedemption(redemption);
    setDetailsDialogOpen(true);
  };

  return (
    <PageLayout title="Redemptions">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Redemptions Management</CardTitle>
                <CardDescription>Manage reward redemptions</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchRedemptions} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onApply={handleDateApply}
                onClear={handleDateClear}
              />
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or mobile..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-64 h-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : redemptions.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-muted-foreground">No redemptions found</div>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Points Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((redemption) => (
                      <TableRow
                        key={redemption.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(redemption)}
                      >
                        <TableCell>
                          <div className="font-medium">
                            {redemption.userName || redemption.user_id || "N/A"}
                          </div>
                          {redemption.userMobile && (
                            <div className="text-xs text-muted-foreground">
                              {redemption.userMobile}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {redemption.rewardName || redemption.reward_id || "N/A"}
                          </div>
                          {redemption.rewardCost && (
                            <div className="text-xs text-muted-foreground">
                              Cost: {redemption.rewardCost} pts
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {redemption.storeName || redemption.store_id || "N/A"}
                          </div>
                          {redemption.storeLocation && (
                            <div className="text-xs text-muted-foreground">
                              {redemption.storeLocation}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{redemption.points_spent}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {editingId === redemption.id ? (
                            <div className="flex flex-col gap-1">
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm min-w-[120px]"
                              >
                                <option value="PENDING">Pending</option>
                                {/* <option value="APPROVED">Approved</option>
                              <option value="REJECTED">Rejected</option> */}
                                <option value="COMPLETED">Completed</option>
                              </select>
                              <div className="flex gap-1 mt-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleSaveStatus(redemption.id)}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Save className="size-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  className="h-6 px-2 text-xs"
                                >
                                  <X className="size-3" />
                                </Button>
                              </div>
                              {updateError && (
                                <Alert variant="destructive" className="mt-1 p-1">
                                  <AlertCircle className="size-2" />
                                  <AlertDescription className="text-xs">
                                    {updateError}
                                  </AlertDescription>
                                </Alert>
                              )}
                              {updateSuccess && (
                                <Alert className="mt-1 p-1 border-green-500 bg-green-50">
                                  <CheckCircle2 className="size-2 text-green-600" />
                                  <AlertDescription className="text-xs text-green-800">
                                    Status updated!
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${redemption.status?.toUpperCase() === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : redemption.status?.toUpperCase() === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : redemption.status?.toUpperCase() === "APPROVED"
                                    ? "bg-blue-100 text-blue-800"
                                    : redemption.status?.toUpperCase() === "REJECTED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {redemption.status || "N/A"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {redemption.contact_name || "N/A"}{" "}
                          {redemption.contact_mobile && `(${redemption.contact_mobile})`}
                        </TableCell>
                        <TableCell>{formatDate(redemption.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            {editingId !== redemption.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(redemption)}
                              >
                                <Edit className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(redemption.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
            )}

          {/* Pagination */}
          {redemptions.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} redemptions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage * pageSize >= totalCount || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redemption Details Popup */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redemption Details</DialogTitle>
            <DialogDescription>
              Order #{selectedRedemption?.id?.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          {selectedRedemption && (
            <div className="space-y-6">
              {/* Reward Information */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="size-5 text-primary" />
                  <h3 className="font-semibold">Reward Details</h3>
                </div>
                <div className="flex gap-4">
                  {selectedRedemption.rewardImageUrl && (
                    <img
                      src={selectedRedemption.rewardImageUrl}
                      alt={selectedRedemption.rewardName}
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-lg">{selectedRedemption.rewardName || "N/A"}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRedemption.rewardDescription || "No description available"}
                    </p>
                    <p className="text-sm font-medium mt-2">
                      Cost: {selectedRedemption.rewardCost || selectedRedemption.points_spent} points
                    </p>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="size-5 text-primary" />
                  <h3 className="font-semibold">User Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedRedemption.userName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Mobile</p>
                    <p className="font-medium">{selectedRedemption.userMobile || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Store Information */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="size-5 text-primary" />
                  <h3 className="font-semibold">Store Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Store Name</p>
                    <p className="font-medium">{selectedRedemption.storeName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{selectedRedemption.storeLocation || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Order Timeline */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="size-5 text-primary" />
                  <h3 className="font-semibold">Order Timeline</h3>
                </div>
                <div className="relative pl-6 space-y-6">
                  {/* Timeline Line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

                  {/* Order Placed */}
                  <div className="relative flex items-start gap-4">
                    <div className="absolute -left-6 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Package className="size-3 text-white" />
                    </div>
                    <div className="pt-0.5">
                      <p className="font-medium text-green-700">Order Placed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateOnly(selectedRedemption.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Order Shipped */}
                  <div className="relative flex items-start gap-4">
                    <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center ${isDatePassed(selectedRedemption.created_at, 1) ? "bg-green-500" : "bg-gray-300"
                      }`}>
                      <Truck className="size-3 text-white" />
                    </div>
                    <div className="pt-0.5">
                      <p className={`font-medium ${isDatePassed(selectedRedemption.created_at, 1) ? "text-green-700" : "text-muted-foreground"}`}>
                        Order Shipped
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateOnly(addDays(selectedRedemption.created_at, 1))}
                      </p>
                    </div>
                  </div>

                  {/* Ready to Pickup */}
                  <div className="relative flex items-start gap-4">
                    <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center ${isDatePassed(selectedRedemption.created_at, 2) ? "bg-green-500" : "bg-gray-300"
                      }`}>
                      <MapPin className="size-3 text-white" />
                    </div>
                    <div className="pt-0.5">
                      <p className={`font-medium ${isDatePassed(selectedRedemption.created_at, 2) ? "text-green-700" : "text-muted-foreground"}`}>
                        Ready to Pickup
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateOnly(addDays(selectedRedemption.created_at, 2))}
                      </p>
                    </div>
                  </div>

                  {/* Delivered */}
                  <div className="relative flex items-start gap-4">
                    <div className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center ${selectedRedemption.status?.toUpperCase() === "COMPLETED" ? "bg-green-500" : "bg-gray-300"
                      }`}>
                      <CheckCircle className="size-3 text-white" />
                    </div>
                    <div className="pt-0.5">
                      <p className={`font-medium ${selectedRedemption.status?.toUpperCase() === "COMPLETED" ? "text-green-700" : "text-muted-foreground"}`}>
                        Delivered
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRedemption.status?.toUpperCase() === "COMPLETED"
                          ? "Completed"
                          : "Pending completion"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                <span className="text-sm font-medium">Current Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${selectedRedemption.status?.toUpperCase() === "PENDING"
                    ? "bg-yellow-100 text-yellow-800"
                    : selectedRedemption.status?.toUpperCase() === "COMPLETED"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {selectedRedemption.status || "N/A"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PageLayout >
  );
}
