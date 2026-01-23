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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { Edit2, Save, X, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function UsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check current session to understand user context
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session user:", session?.user?.id);
      
      // Fetch ALL profiles without any filters - RLS policies will control access
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        throw fetchError;
      }
      
      console.log(`Fetched ${data?.length || 0} profiles from database`);
      console.log("Profile IDs:", data?.map(p => p.id));
      
      setProfiles(data || []);
      
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
      full_name: profile.full_name || "",
      mobile: profile.mobile || "",
      is_active: profile.is_active ?? true,
      role: profile.role || "",
      gender: profile.gender || "",
      aadhar: profile.aadhar || "",
      address: profile.address || "",
      nearest_store: profile.nearest_store || "",
      occupation: profile.occupation || "",
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

      // Prepare update data - only include fields that are defined
      const updateData = {};
      
      if (editData.full_name !== undefined) updateData.full_name = editData.full_name || null;
      if (editData.mobile !== undefined) updateData.mobile = editData.mobile || null;
      if (editData.is_active !== undefined) updateData.is_active = editData.is_active;
      if (editData.role !== undefined) updateData.role = editData.role || null;
      if (editData.gender !== undefined) updateData.gender = editData.gender || null;
      if (editData.aadhar !== undefined) updateData.aadhar = editData.aadhar || null;
      if (editData.address !== undefined) updateData.address = editData.address || null;
      if (editData.nearest_store !== undefined) updateData.nearest_store = editData.nearest_store || null;
      if (editData.occupation !== undefined) updateData.occupation = editData.occupation || null;
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
                        <li>Go to Supabase Dashboard → Authentication → Policies</li>
                        <li>Find the 'profiles' table</li>
                        <li>Create or update a SELECT policy that allows authenticated users to read all profiles</li>
                        <li>Example policy: <code className="bg-muted px-1 rounded">CREATE POLICY "Allow authenticated users to read all profiles" ON profiles FOR SELECT TO authenticated USING (true);</code></li>
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

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
                {/* {profiles.length < 4 && (
                  <Alert className="bg-blue-50 border-blue-200 mb-4">
                    <AlertDescription className="text-sm">
                      Showing <strong>{profiles.length}</strong> profile(s) from the database. 
                      {profiles.length < 4 && " If you have 4 records, check RLS policies in Supabase to allow access to all profiles."}
                    </AlertDescription>
                  </Alert>
                )} */}
              <div className="rounded-md border overflow-x-auto">
                {/* <div className="p-4 border-b bg-muted/50">
                  <div className="font-semibold text-sm">Table: profiles</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Columns: id, full_name, mobile, is_active, role, gender, aadhar, address, nearest_store, occupation, points_balance, created_at
                  </div>
                </div> */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Role</TableHead>
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
                      <TableRow key={profile.id}>
                        {editingId === profile.id ? (
                          <>
                            <TableCell className="font-mono text-xs">
                              {profile.id?.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.full_name}
                                onChange={(e) =>
                                  setEditData({ ...editData, full_name: e.target.value })
                                }
                                className="h-8 min-w-[120px]"
                                placeholder="Full Name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.mobile}
                                onChange={(e) =>
                                  setEditData({ ...editData, mobile: e.target.value })
                                }
                                className="h-8 min-w-[100px]"
                                placeholder="Mobile"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.role}
                                onChange={(e) =>
                                  setEditData({ ...editData, role: e.target.value })
                                }
                                className="h-8 min-w-[100px]"
                                placeholder="Role"
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                value={editData.gender}
                                onChange={(e) =>
                                  setEditData({ ...editData, gender: e.target.value })
                                }
                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm min-w-[100px]"
                              >
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.aadhar}
                                onChange={(e) =>
                                  setEditData({ ...editData, aadhar: e.target.value })
                                }
                                className="h-8 min-w-[120px]"
                                placeholder="Aadhar"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.address}
                                onChange={(e) =>
                                  setEditData({ ...editData, address: e.target.value })
                                }
                                className="h-8 min-w-[150px]"
                                placeholder="Address"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.nearest_store}
                                onChange={(e) =>
                                  setEditData({ ...editData, nearest_store: e.target.value })
                                }
                                className="h-8 min-w-[120px]"
                                placeholder="Nearest Store"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editData.occupation}
                                onChange={(e) =>
                                  setEditData({ ...editData, occupation: e.target.value })
                                }
                                className="h-8 min-w-[120px]"
                                placeholder="Occupation"
                              />
                            </TableCell>
                            <TableCell>
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
                            <TableCell>
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
                            <TableCell>
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
                            <TableCell className="capitalize">{profile.role || "N/A"}</TableCell>
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
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  profile.is_active
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
                            <TableCell>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
