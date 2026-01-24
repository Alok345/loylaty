"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Edit2, Save, X, RefreshCw, AlertCircle, CheckCircle2, Filter, Search, User, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";

export default function UsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // Transaction popup state
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [searchQuery, startDate, endDate, currentPage]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check current session to understand user context
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session user:", session?.user?.id);

      // Fetch ALL profiles without any filters - RLS policies will control access
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply date range filter
      if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
      }

      // Apply pagination
      query = query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        throw fetchError;
      }

      console.log(`Fetched ${data?.length || 0} profiles from database`);
      console.log("Profile IDs:", data?.map(p => p.id));

      // Apply search filter client-side
      let filteredData = data || [];
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredData = filteredData.filter(p =>
          (p.full_name && p.full_name.toLowerCase().includes(query)) ||
          (p.mobile && p.mobile.includes(query))
        );
      }

      setProfiles(filteredData);
      setTotalCount(searchQuery.trim() ? filteredData.length : (count || 0));

      // If we got fewer profiles than expected, it's likely an RLS issue
      if (data && data.length > 0 && data.length < 4) {
        console.warn(`Only ${data.length} profiles returned. If you have 4 records, check RLS policies.`);
      }
    } catch (err) {
      console.error("Error fetching profiles:", err);
      let errorMessage = err.message || "Failed to fetch profiles";

      // Check for RLS policy violations
      if (errorMessage.includes("row-level security policy") ||
        errorMessage.includes("RLS") ||
        errorMessage.includes("permission denied") ||
        errorMessage.includes("new row violates")) {
        errorMessage = `Row-level security policy violation: ${errorMessage}. Please check your Supabase RLS policies for the 'profiles' table. You may need to allow SELECT for all authenticated users or users with admin role.`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (profile) => {
    setEditingId(profile.id);
    setEditData({
      is_active: profile.is_active ?? true,
      points_balance: profile.points_balance || 0,
    });
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setUpdateError(null);
    setUpdateSuccess(false);
  };

  const handleSaveEdit = async (id) => {
    try {
      setUpdateError(null);
      setUpdateSuccess(false);

      // Validate ID
      if (!id) {
        throw new Error("Profile ID is required");
      }

      // Check session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be logged in to update profiles. Please refresh the page and log in again.");
      }

      // Prepare update data - only status and points
      const updateData = {};

      if (editData.is_active !== undefined) updateData.is_active = editData.is_active;
      if (editData.points_balance !== undefined) {
        const points = parseInt(editData.points_balance);
        updateData.points_balance = isNaN(points) ? 0 : points;
      }

      console.log("Updating profile:", id, "with data:", updateData);

      // Perform the update
      const { data, error: updateErr } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", id)
        .select();

      if (updateErr) {
        console.error("Supabase update error:", updateErr);
        throw updateErr;
      }

      // Check if update was successful
      if (!data || data.length === 0) {
        throw new Error("Update completed but no data was returned. The profile may not exist or RLS policy prevented the update.");
      }

      console.log("Profile updated successfully:", data);
      setUpdateSuccess(true);

      // Refresh the profiles list and close edit mode after a short delay
      setTimeout(() => {
        setEditingId(null);
        setEditData({});
        setUpdateSuccess(false);
        fetchProfiles();
      }, 1000);
    } catch (err) {
      console.error("Error updating profile:", err);

      // Handle different error types
      let errorMessage = "Failed to update profile";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err && typeof err === "object") {
        // Handle Supabase error structure
        const errMsg = err.message || err.details || err.hint;

        if (errMsg) {
          errorMessage = errMsg;

          // Check for network errors
          if (errMsg.includes("Failed to fetch") || errMsg.includes("ERR_CONNECTION_CLOSED")) {
            errorMessage = "Network error: Could not connect to database. Please check your internet connection, refresh the page, and try again. If the issue persists, check your Supabase project status.";
          }
          // Check for timeout errors
          else if (errMsg.includes("timeout") || errMsg.includes("timed out")) {
            errorMessage = "Request timed out. The database may be slow or unreachable. Please try again.";
          }
          // Check for RLS policy violations
          else if (
            errMsg.includes("row-level security policy") ||
            errMsg.includes("RLS") ||
            errMsg.includes("permission denied") ||
            errMsg.includes("new row violates") ||
            errMsg.toLowerCase().includes("violates row-level security")
          ) {
            errorMessage = `Row-level security policy violation: ${errMsg}. You may need to update your RLS policies in Supabase to allow UPDATE operations on the profiles table.`;
          }
        } else {
          // If no message, try to stringify the error
          try {
            errorMessage = JSON.stringify(err);
          } catch {
            errorMessage = "An unknown error occurred. Please check the browser console for details.";
          }
        }
      }

      setUpdateError(errorMessage);
    }
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

  const handleRowClick = async (profile) => {
    setSelectedUser(profile);
    setTransactionsDialogOpen(true);
    await fetchTransactions(profile.id);
  };

  const fetchTransactions = async (userId) => {
    try {
      setTransactionsLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        setTransactions([]);
      } else {
        setTransactions(data || []);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatTransactionDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <PageLayout title="Users">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Users Management</CardTitle>
                <CardDescription>Manage user profiles from profiles table</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchProfiles} disabled={loading}>
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
              <div className="text-center py-8 text-muted-foreground">Loading profiles...</div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-muted-foreground">No profiles found</div>
                {!error && (
                  <div className="text-sm text-muted-foreground">
                    If you have profiles in your database, this might be due to RLS policies restricting access.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Aadhar</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Nearest Store</TableHead>
                        <TableHead>Occupation</TableHead>
                        <TableHead>Points Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow
                          key={profile.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(profile)}
                        >
                          {editingId === profile.id ? (
                            <>
                              <TableCell className="font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                                {profile.id?.substring(0, 8)}...
                              </TableCell>
                              <TableCell className="font-medium">
                                {profile.full_name || "N/A"}
                              </TableCell>
                              <TableCell>{profile.mobile || "N/A"}</TableCell>
                              <TableCell className="capitalize">{profile.gender || "N/A"}</TableCell>
                              <TableCell className="text-sm">{profile.aadhar || "N/A"}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">
                                {profile.address || "N/A"}
                              </TableCell>
                              <TableCell className="text-sm">{profile.nearest_store || "N/A"}</TableCell>
                              <TableCell className="text-sm">{profile.occupation || "N/A"}</TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Input
                                  type="number"
                                  value={editData.points_balance}
                                  onChange={(e) =>
                                    setEditData({ ...editData, points_balance: e.target.value })
                                  }
                                  className="h-8 min-w-[100px]"
                                  placeholder="Points"
                                />
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={editData.is_active}
                                  onChange={(e) =>
                                    setEditData({ ...editData, is_active: e.target.value === "true" })
                                  }
                                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm min-w-[90px]"
                                >
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(profile.created_at)}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 flex-col">
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleSaveEdit(profile.id)}
                                      className="h-7 px-2"
                                    >
                                      <Save className="size-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelEdit}
                                      className="h-7 px-2"
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
                                        Saved!
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-mono text-xs">
                                {profile.id?.substring(0, 8)}...
                              </TableCell>
                              <TableCell className="font-medium">
                                {profile.full_name || "N/A"}
                              </TableCell>
                              <TableCell>{profile.mobile || "N/A"}</TableCell>
                              <TableCell className="capitalize">{profile.gender || "N/A"}</TableCell>
                              <TableCell className="text-sm">{profile.aadhar || "N/A"}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">
                                {profile.address || "N/A"}
                              </TableCell>
                              <TableCell className="text-sm">{profile.nearest_store || "N/A"}</TableCell>
                              <TableCell className="text-sm">{profile.occupation || "N/A"}</TableCell>
                              <TableCell className="font-medium">
                                {profile.points_balance?.toLocaleString() || 0}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${profile.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                    }`}
                                >
                                  {profile.is_active ? "Active" : "Inactive"}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(profile.created_at)}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(profile)}
                                  className="gap-1"
                                >
                                  <Edit2 className="size-3" />
                                  Edit
                                </Button>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {profiles.length > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} users
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Transactions Popup */}
        <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="size-5" />
                Transaction History
              </DialogTitle>
              <DialogDescription>
                {selectedUser?.full_name || "User"} ({selectedUser?.mobile || "N/A"})
              </DialogDescription>
            </DialogHeader>
            {transactionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No transactions found for this user</div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Total: {transactions.length} transaction(s)
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {tx.type.toLowerCase() === "earn" ? (
                                <ArrowUpCircle className="size-4 text-green-500" />
                              ) : (
                                <ArrowDownCircle className="size-4 text-red-500" />
                              )}
                              <span className={`font-medium capitalize ${tx.type.toLowerCase() === "earn"
                                ? "text-green-600"
                                : "text-red-600"
                                }`}>
                                {tx.type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${tx.type.toLowerCase() === "earn"
                              ? "text-green-600"
                              : "text-red-600"
                              }`}>
                              {tx.type.toLowerCase() === "earn" ? "+" : "-"}{tx.amount}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {tx.description || "N/A"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTransactionDate(tx.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
