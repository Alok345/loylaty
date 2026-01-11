"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { User, Mail, Phone, MapPin, Briefcase, CreditCard, Calendar, Shield, Lock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ProfilesPage() {
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
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

      // Fetch user data from users table (contains all profile data)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("Error fetching user:", userError);
        let userErrorMessage = userError.message || "Failed to fetch user data";
        
        // Check for RLS policy violations
        if (userErrorMessage.includes("row-level security policy") || 
            userErrorMessage.includes("RLS") || 
            userErrorMessage.includes("permission denied")) {
          setError(`Row-level security policy violation: ${userErrorMessage}. Please check your RLS policies for the 'users' table.`);
        } else {
          setError(`Error loading user data: ${userErrorMessage}`);
        }
      } else {
        setUser(userData);
        // Since user data contains profile fields (full_name, mobile, etc.), use it as profile
        setProfile(userData);
      }

      // Try to fetch profile from profiles table as fallback (optional)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) {
        // PGRST116 is the error code for "no rows returned" - this is expected if profile doesn't exist
        if (profileError.code === 'PGRST116' || profileError.code === 'PGRST102') {
          // Profile doesn't exist - that's okay, user data from users table will be used
          console.log("Profile not found for user - using users table data");
        } else {
          // Other errors (RLS, network, etc.) - log them but don't fail
          console.error("Error fetching profile:", profileError);
        }
      } else if (profileData) {
        // If profile exists, merge it with user data (profile takes precedence)
        setProfile({ ...userData, ...profileData });
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("All fields are required");
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      setPasswordLoading(false);
      return;
    }

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setPasswordError("Unable to verify user. Please try again.");
        setPasswordLoading(false);
        return;
      }

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      });

      if (verifyError) {
        setPasswordError("Current password is incorrect");
        setPasswordLoading(false);
        return;
      }

      // If verification succeeds, update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || "Failed to update password");
        setPasswordLoading(false);
        return;
      }

      // Success
      setPasswordSuccess(true);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Password update error:", err);
      setPasswordError(err.message || "An error occurred while updating password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <PageLayout title="My Profile">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading profile...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="My Profile">
      <div className="space-y-6">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                {/* <CardTitle className="flex items-center gap-2">
                  <User className="size-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Your personal and account details</CardDescription> */}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProfileData}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium">{user?.email || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <p className="text-sm font-medium">{profile?.full_name || user?.full_name || "Not set"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Mobile</Label>
                    <p className="text-sm font-medium">{profile?.mobile || user?.mobile || "Not set"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <p className="text-sm font-medium capitalize">{profile?.role || user?.role || "N/A"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <p className="text-sm font-medium capitalize">{profile?.gender || user?.gender || "Not set"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CreditCard className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Aadhar</Label>
                    <p className="text-sm font-medium">{profile?.aadhar || user?.aadhar || "Not set"}</p>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <p className="text-sm font-medium">{profile?.address || user?.address || "Not set"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nearest Store</Label>
                    <p className="text-sm font-medium">{profile?.nearest_store || user?.nearest_store || "Not set"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Briefcase className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Occupation</Label>
                    <p className="text-sm font-medium">{profile?.occupation || "Not set"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CreditCard className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Points Balance</Label>
                    <p className="text-sm font-medium">{profile?.points_balance?.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  {profile?.is_active ? (
                    <CheckCircle2 className="size-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="size-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <p className={`text-sm font-medium ${profile?.is_active ? "text-green-600" : "text-red-600"}`}>
                      {profile?.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="size-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Member Since</Label>
                    <p className="text-sm font-medium">{formatDate(profile?.created_at || user?.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              {passwordSuccess && (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Password updated successfully!
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    placeholder="Enter current password"
                    required
                    disabled={passwordLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    placeholder="Enter new password (min. 6 characters)"
                    required
                    minLength={6}
                    disabled={passwordLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                    disabled={passwordLoading}
                  />
                </div>
              </div>

              <Button type="submit" disabled={passwordLoading} className="w-full">
                {passwordLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
