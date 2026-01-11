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
import { User, Mail, Phone, CreditCard, Gift, Receipt, ScanLine, RefreshCw, TrendingUp, Award, Plus, Edit, Users as UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UserDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [qrScans, setQrScans] = useState([]);
  const [stats, setStats] = useState({
    totalPoints: 0,
    totalTransactions: 0,
    totalRedemptions: 0,
    totalScans: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // User management state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    mobile: "",
    role: "user",
    status: "active",
    gender: "",
    aadhar: "",
    address: "",
    nearest_store: "",
    
  });

  useEffect(() => {
    fetchUserData();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error: storesError } = await supabase
        .from("stores")
        .select("id, name")
        .order("name", { ascending: true });

      if (storesError) {
        console.error("Error fetching stores:", storesError);
      } else {
        setStores(data || []);
      }
    } catch (err) {
      console.error("Error fetching stores:", err);
    }
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // Fetch all users from users table
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Error fetching users:", usersError);
      } else {
        setUsers(usersData || []);
        setStats(prev => ({ ...prev, totalUsers: usersData?.length || 0 }));
      }

      // Fetch current user profile from users table
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error("Error fetching profile:", profileError);
      } else {
        setProfile(profileData || null);
      }

      // Fetch user's transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
      } else {
        setTransactions(transactionsData || []);
      }

      // Fetch user's redemptions
      const { data: redemptionsData, error: redemptionsError } = await supabase
        .from("redemptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (redemptionsError) {
        console.error("Error fetching redemptions:", redemptionsError);
      } else {
        // Fetch related data separately
        if (redemptionsData && redemptionsData.length > 0) {
          const rewardIds = [...new Set(redemptionsData.map(r => r.reward_id).filter(Boolean))];
          const storeIds = [...new Set(redemptionsData.map(r => r.store_id).filter(Boolean))];

          const [rewardsData, storesData] = await Promise.all([
            rewardIds.length > 0 ? supabase.from("rewards").select("id, name, cost").in("id", rewardIds) : Promise.resolve({ data: [], error: null }),
            storeIds.length > 0 ? supabase.from("stores").select("id, name").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
          ]);

          const rewardMap = new Map((rewardsData.data || []).map(r => [r.id, { name: r.name, cost: r.cost }]));
          const storeMap = new Map((storesData.data || []).map(s => [s.id, s.name]));

          const processedRedemptions = redemptionsData.map(r => ({
            ...r,
            rewardName: rewardMap.get(r.reward_id)?.name || null,
            rewardCost: rewardMap.get(r.reward_id)?.cost || null,
            storeName: storeMap.get(r.store_id) || null,
          }));
          setRedemptions(processedRedemptions);
        } else {
          setRedemptions([]);
        }
      }

      // Fetch user's QR scan logs
      const { data: qrScansData, error: qrScansError } = await supabase
        .from("qr_scan_logs")
        .select("*")
        .eq("user_id", userId)
        .order("scanned_at", { ascending: false })
        .limit(10);

      if (qrScansError) {
        console.error("Error fetching QR scans:", qrScansError);
      } else {
        // Fetch related data separately
        if (qrScansData && qrScansData.length > 0) {
          const qrCodeIds = [...new Set(qrScansData.map(s => s.qr_code_id).filter(Boolean))];
          const storeIds = [...new Set(qrScansData.map(s => s.store_id).filter(Boolean))];

          const [qrCodesData, storesData] = await Promise.all([
            qrCodeIds.length > 0 ? supabase.from("qr_codes").select("id, code, points").in("id", qrCodeIds) : Promise.resolve({ data: [], error: null }),
            storeIds.length > 0 ? supabase.from("stores").select("id, name").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
          ]);

          const qrCodeMap = new Map((qrCodesData.data || []).map(q => [q.id, { code: q.code, points: q.points }]));
          const storeMap = new Map((storesData.data || []).map(s => [s.id, s.name]));

          const processedQrScans = qrScansData.map(s => ({
            ...s,
            qrCode: qrCodeMap.get(s.qr_code_id)?.code || null,
            pointsEarned: qrCodeMap.get(s.qr_code_id)?.points || null,
            storeName: storeMap.get(s.store_id) || null,
          }));
          setQrScans(processedQrScans);
        } else {
          setQrScans([]);
        }
      }

      // Calculate stats
      const totalPoints = profileData?.points_balance || 0;
      const totalTransactions = transactionsData?.length || 0;
      const totalRedemptions = redemptionsData?.length || 0;
      const totalScans = qrScansData?.length || 0;

      setStats({
        totalPoints,
        totalTransactions,
        totalRedemptions,
        totalScans,
      });

    } catch (err) {
      console.error("Error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email || "",
        password: "",
        full_name: user.full_name || "",
        mobile: user.mobile || "",
        role: user.role || "user",
        status: user.status || "active",
        gender: user.gender || "",
        aadhar: user.aadhar || "",
        address: user.address || "",
        nearest_store: user.nearest_store || "",
        
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: "",
        password: "",
        full_name: "",
        mobile: "",
        role: "user",
        status: "active",
        gender: "",
        aadhar: "",
        address: "",
        nearest_store: "",
       
      });
    }
    setDialogOpen(true);
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      
      if (editingUser) {
        // Update existing user in users table
        const { error: updateError } = await supabase
          .from("users")
          .update({
                full_name: formData.full_name,
                mobile: formData.mobile,
                role: formData.role,
                status: formData.status,
                gender: formData.gender,
                aadhar: formData.aadhar,
                address: formData.address,
                nearest_store: formData.nearest_store,
                userType: "admin"
                
              })
              .eq("id", editingUser.id);

        if (updateError) throw updateError;
      } else {
        // Create new user via auth.signUp
        if (!formData.password || formData.password.length < 6) {
          setError("Password is required and must be at least 6 characters");
          return;
        }

        try {
          // Step 1: Create auth user (this will trigger profile creation via database trigger)
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                full_name: formData.full_name,
                mobile: formData.mobile,
                role: formData.role,
                gender: formData.gender,
                aadhar: formData.aadhar,
                userType: "admin"
              }
            }
          });

          if (authError) {
            console.error("Auth signup error:", authError);
            let errorMessage = authError.message || "Failed to create user";
            
            // Handle specific error cases
            if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
              errorMessage = "Network error: Could not connect to authentication service. Please check your internet connection and try again.";
            } else if (errorMessage.includes("already registered") || errorMessage.includes("already exists")) {
              errorMessage = "A user with this email already exists.";
            } else if (errorMessage.includes("email")) {
              errorMessage = `Email error: ${errorMessage}`;
            }
            
            throw new Error(errorMessage);
          }

          if (!authData || !authData.user) {
            throw new Error("User creation failed: No user data returned. Please check Supabase configuration.");
          }

          // Step 2: Wait for auth user and profile trigger to complete
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Step 3: Insert/Update user record in users table (for admin panel)
          // Check if user record already exists
          const { data: existingUser, error: checkError } = await supabase
            .from("users")
            .select("id")
            .eq("id", authData.user.id)
            .single();

          if (existingUser) {
            // User record exists, update it with admin-provided data
            console.log("User record exists in users table, updating with admin data...");
            const { error: updateError } = await supabase
              .from("users")
              .update({
                email: formData.email,
                full_name: formData.full_name,
                mobile: formData.mobile,
                role: formData.role,
                status: formData.status,
                gender: formData.gender,
                aadhar: formData.aadhar,
                address: formData.address,
                nearest_store: formData.nearest_store,
                userType: "admin"
              })
              .eq("id", authData.user.id);

            if (updateError) {
              console.error("Error updating user record:", updateError);
              let updateErrorMessage = updateError.message || "Failed to update user record";
              
              if (updateErrorMessage.includes("row-level security policy") || 
                  updateErrorMessage.includes("RLS") || 
                  updateErrorMessage.includes("permission denied")) {
                updateErrorMessage = `RLS Policy Error: ${updateErrorMessage}. You need UPDATE permission on the 'users' table. Please check your RLS policies.`;
              }
              
              throw new Error(`User created in auth but users table update failed: ${updateErrorMessage}`);
            }
          } else {
            // User record doesn't exist, insert it (admin panel creates users table record)
            console.log("Inserting new user record in users table...");
            const { error: userError } = await supabase
              .from("users")
              .insert([{
                id: authData.user.id,
                email: formData.email,
                full_name: formData.full_name,
                mobile: formData.mobile,
                role: formData.role,
                status: formData.status,
                gender: formData.gender,
                aadhar: formData.aadhar,
                address: formData.address,
                nearest_store: formData.nearest_store,
                userType: "admin",
                created_at: new Date().toISOString(),
              }]);

            if (userError) {
              console.error("Error inserting user record:", userError);
              let insertErrorMessage = userError.message || "Failed to create user record";
              
              // Check for RLS policy violations
              if (insertErrorMessage.includes("row-level security policy") || 
                  insertErrorMessage.includes("RLS") || 
                  insertErrorMessage.includes("permission denied") ||
                  insertErrorMessage.includes("violates row-level security")) {
                
                // Provide detailed guidance for admin panel
                const rlsGuidance = `
RLS Policy Violation: Admin panel needs INSERT permission on the 'users' table.

To fix this in Supabase Dashboard:
1. Go to: Table Editor → users table → Policies
2. Click "New Policy" → "Create a policy from scratch"
3. Policy name: "Allow admins to insert users"
4. Allowed operation: INSERT
5. Target roles: authenticated
6. USING expression: 
   (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
7. WITH CHECK expression: true

OR allow all authenticated users (if you trust your admin panel):
1. Policy name: "Allow authenticated users to insert users"
2. USING: true
3. WITH CHECK: true

After creating the policy, try adding the user again.`;
                
                throw new Error(`User created in auth but users table insert failed: ${insertErrorMessage}${rlsGuidance}`);
              }
              
              // Check if user already exists (race condition)
              if (insertErrorMessage.includes("duplicate") || insertErrorMessage.includes("already exists") || insertErrorMessage.includes("unique")) {
                // Try to update instead
                console.log("User record may have been created, attempting update...");
                const { error: updateError } = await supabase
                  .from("users")
                  .update({
                    full_name: formData.full_name,
                    mobile: formData.mobile,
                    role: formData.role,
                    status: formData.status,
                    gender: formData.gender,
                    aadhar: formData.aadhar,
                    address: formData.address,
                    nearest_store: formData.nearest_store,
                    
                  })
                  .eq("id", authData.user.id);

                if (updateError) {
                  throw new Error(`User created but users table data could not be saved: ${updateError.message || insertErrorMessage}`);
                }
              } else {
                throw new Error(`User created in auth but users table insert failed: ${insertErrorMessage}`);
              }
            }
          }

          // Step 4: Also update profiles table if needed (sync with users table data)
          // The trigger creates the profile, but we may want to update it with admin-provided data
          const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({
              full_name: formData.full_name,
              mobile: formData.mobile,
              gender: formData.gender,
              aadhar: formData.aadhar,
             
              is_active: formData.status === 'active',
            })
            .eq("id", authData.user.id);

          if (profileUpdateError && profileUpdateError.code !== 'PGRST116') {
            console.warn("Profile update failed (non-critical):", profileUpdateError);
            // Non-critical - profile was created by trigger, users table is the main record
          }
        } catch (authErr) {
          // Re-throw auth errors
          throw authErr;
        }
      }

      setDialogOpen(false);
      // Clear form on success
      setFormData({
        email: "",
        password: "",
        full_name: "",
        mobile: "",
        role: "user",
        status: "active",
        gender: "",
        aadhar: "",
        address: "",
        nearest_store: "",
        
      });
      fetchUserData();
    } catch (err) {
      console.error("Error saving user:", err);
      let errorMessage = "Failed to save user";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Check for network errors
      if (errorMessage.includes("Failed to fetch") || 
          errorMessage.includes("NetworkError") ||
          errorMessage.includes("ERR_CONNECTION")) {
        errorMessage = "Network error: Could not connect to the server. Please check your internet connection, verify your Supabase configuration, and try again.";
      }
      
      // Check for RLS policy violations
      if (errorMessage.includes("row-level security policy") || 
          errorMessage.includes("RLS") || 
          errorMessage.includes("permission denied")) {
        errorMessage = `Row-level security policy violation: ${errorMessage}. Please check your RLS policies for the 'users' table.`;
      }
      
      setError(errorMessage);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <PageLayout title="User Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="User Dashboard">
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        {/* <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Users in system</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Balance</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Available points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">Total transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redemptions</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRedemptions}</div>
              <p className="text-xs text-muted-foreground">Total redemptions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">QR Scans</CardTitle>
              <ScanLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScans}</div>
              <p className="text-xs text-muted-foreground">Total scans</p>
            </CardContent>
          </Card>
        </div> */}

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="size-5" />
                  My Profile
                </CardTitle>
                <CardDescription>Your account information</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUserData}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="size-4" />
                  Email
                </div>
                <p className="text-sm">{profile?.email || "N/A"}</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="size-4" />
                  Full Name
                </div>
                <p className="text-sm">{profile?.full_name || "Not set"}</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="size-4" />
                  Mobile
                </div>
                <p className="text-sm">{profile?.mobile || "Not set"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="size-5" />
                  Users Management
                </CardTitle>
                <CardDescription>Manage all users in the system</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUserData}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                  <Plus className="size-4" />
                  Add User
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email || "N/A"}</TableCell>
                        <TableCell>{user.full_name || "Not set"}</TableCell>
                        <TableCell>{user.mobile || "Not set"}</TableCell>
                        <TableCell className="capitalize">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role || "user"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === "active" ? "bg-green-100 text-green-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {user.status || "inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(user)}
                            className="gap-2"
                          >
                            <Edit className="size-4" />
                            Edit
                          </Button>
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
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-5" />
              Recent Transactions
            </CardTitle>
            <CardDescription>Your latest transaction history</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No transactions found</div>
            ) : (
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
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="capitalize">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === "credit" ? "bg-green-100 text-green-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell className={`font-medium ${
                        transaction.type === "credit" ? "text-green-600" : "text-red-600"
                      }`}>
                        {transaction.type === "credit" ? "+" : "-"}{transaction.amount}
                      </TableCell>
                      <TableCell>{transaction.description || "N/A"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(transaction.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card> */}

        {/* Recent Redemptions */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="size-5" />
              Recent Redemptions
            </CardTitle>
            <CardDescription>Your latest reward redemptions</CardDescription>
          </CardHeader>
          <CardContent>
            {redemptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No redemptions found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reward</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Points Spent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((redemption) => (
                    <TableRow key={redemption.id}>
                      <TableCell>{redemption.rewardName || redemption.reward_id || "N/A"}</TableCell>
                      <TableCell>{redemption.storeName || redemption.store_id || "N/A"}</TableCell>
                      <TableCell>{redemption.points_spent}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          redemption.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                          redemption.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                          redemption.status === "REJECTED" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {redemption.status || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(redemption.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card> */}

        {/* Recent QR Scans */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-5" />
              Recent QR Scans
            </CardTitle>
            <CardDescription>Your latest QR code scans</CardDescription>
          </CardHeader>
          <CardContent>
            {qrScans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No QR scans found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Scanned At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qrScans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell className="font-mono text-sm">{scan.qrCode || scan.qr_code_id || "N/A"}</TableCell>
                      <TableCell>{scan.storeName || scan.store_id || "N/A"}</TableCell>
                      <TableCell className="font-medium text-green-600">+{scan.pointsEarned || 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(scan.scanned_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card> */}

        {/* Add/Edit User Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Update user information" : "Create a new user account"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitUser}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                    placeholder="user@example.com"
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  )}
                </div>

                {!editingUser && (
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                    />
                    <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="Enter mobile number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role *</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="status">Status *</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="aadhar">Aadhar</Label>
                  <Input
                    id="aadhar"
                    value={formData.aadhar}
                    onChange={(e) => setFormData({ ...formData, aadhar: e.target.value })}
                    placeholder="Enter Aadhar number"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter address"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="nearest_store">Nearest Store</Label>
                  <select
                    id="nearest_store"
                    value={formData.nearest_store}
                    onChange={(e) => setFormData({ ...formData, nearest_store: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select nearest store</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.name}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingUser ? "Update User" : "Add User"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}

