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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Trash2, RefreshCw, AlertCircle, Save, X, CheckCircle2 } from "lucide-react";

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session user:", session?.user?.id);
      
      // Fetch ALL redemptions without any filters
      const { data, error: fetchError } = await supabase
        .from("redemptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        let errorMessage = fetchError.message || "Failed to fetch redemptions";
        if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
          errorMessage = `Row-level security policy violation: ${errorMessage}. Please check your RLS policies for the 'redemptions' table.`;
        }
        throw new Error(errorMessage);
      }

      console.log(`Fetched ${data?.length || 0} redemptions from database`);
      console.log("Redemption IDs:", data?.map(r => r.id));

      // Fetch related data separately and merge
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
        const rewardIds = [...new Set(data.map(r => r.reward_id).filter(Boolean))];
        const storeIds = [...new Set(data.map(r => r.store_id).filter(Boolean))];

        console.log("Fetching related data - User IDs:", userIds, "Reward IDs:", rewardIds, "Store IDs:", storeIds);

        const [profilesData, rewardsData, storesData] = await Promise.all([
          userIds.length > 0 ? supabase.from("profiles").select("id, full_name, mobile").in("id", userIds) : Promise.resolve({ data: [], error: null }),
          rewardIds.length > 0 ? supabase.from("rewards").select("id, name, cost").in("id", rewardIds) : Promise.resolve({ data: [], error: null }),
          storeIds.length > 0 ? supabase.from("stores").select("id, name, location").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
        ]);

        const profileMap = new Map((profilesData.data || []).map(p => [p.id, { name: p.full_name, mobile: p.mobile }]));
        const rewardMap = new Map((rewardsData.data || []).map(r => [r.id, { name: r.name, cost: r.cost }]));
        const storeMap = new Map((storesData.data || []).map(s => [s.id, { name: s.name, location: s.location }]));

        data.forEach(redemption => {
          const profile = profileMap.get(redemption.user_id);
          redemption.userName = profile?.name || null;
          redemption.userMobile = profile?.mobile || null;
          
          const reward = rewardMap.get(redemption.reward_id);
          redemption.rewardName = reward?.name || null;
          redemption.rewardCost = reward?.cost || null;
          
          const store = storeMap.get(redemption.store_id);
          redemption.storeName = store?.name || null;
          redemption.storeLocation = store?.location || null;
        });
      }

      setRedemptions(data || []);
      
      // Warn if fewer records than expected
      if (data && data.length > 0 && data.length < 1) {
        console.warn(`Only ${data.length} redemptions returned. If you have more records, check RLS policies.`);
      }
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be logged in to update redemptions. Please refresh the page and log in again.");
      }

      console.log("Updating redemption status:", id, "to", editStatus);

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
        throw new Error("Update completed but no data was returned. The redemption may not exist or RLS policy prevented the update.");
      }

      console.log("Redemption status updated successfully:", data);
      setUpdateSuccess(true);
      
      // Refresh the redemptions list and close edit mode after a short delay
      setTimeout(() => {
        setEditingId(null);
        setEditStatus("");
        setUpdateSuccess(false);
        fetchRedemptions();
      }, 1000);
    } catch (err) {
      console.error("Error updating redemption status:", err);
      
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
            errorMessage = "Network error: Could not connect to database. Please check your internet connection, refresh the page, and try again.";
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
            errorMessage = "An unknown error occurred. Please check the browser console for details.";
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
      const { error: deleteError } = await supabase
        .from("redemptions")
        .delete()
        .eq("id", id);

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
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Error: {error}</div>
                  {error.includes("Row-level security") && (
                    <div className="text-sm mt-2 space-y-1">
                      <p>This is likely due to Row-Level Security (RLS) policies in Supabase.</p>
                      <p className="font-semibold">To fix this, update your RLS policies in Supabase:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Go to Supabase Dashboard → Table Editor → redemptions table → Policies</li>
                        <li>Create or update a SELECT policy that allows authenticated users to read all redemptions</li>
                        <li>Example policy: <code className="bg-muted px-1 rounded">CREATE POLICY "Allow authenticated users to read all redemptions" ON redemptions FOR SELECT TO authenticated USING (true);</code></li>
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : redemptions.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-muted-foreground">No redemptions found</div>
                {!error && (
                  <div className="text-sm text-muted-foreground">
                    If you have redemptions in your database, this might be due to RLS policies restricting access.
                  </div>
                )}
              </div>
            ) : (
              <>
                {redemptions.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                      Showing <strong>{redemptions.length}</strong> redemption(s) from the database.
                    </div>
                  </div>
                )}
                <div className="rounded-md border overflow-x-auto">
                  {/* <div className="p-4 border-b bg-muted/50">
                    <div className="font-semibold text-sm">Table: redemptions</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Columns: id, user_id, reward_id, store_id, points_spent, status, contact_name, contact_mobile, created_at
                    </div>
                  </div> */}
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
                    <TableRow key={redemption.id}>
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
                      <TableCell>
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
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            redemption.status?.toUpperCase() === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                            redemption.status?.toUpperCase() === "COMPLETED" ? "bg-green-100 text-green-800" :
                            redemption.status?.toUpperCase() === "APPROVED" ? "bg-blue-100 text-blue-800" :
                            redemption.status?.toUpperCase() === "REJECTED" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {redemption.status || "N/A"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {redemption.contact_name || "N/A"} {redemption.contact_mobile && `(${redemption.contact_mobile})`}
                      </TableCell>
                      <TableCell>{formatDate(redemption.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
