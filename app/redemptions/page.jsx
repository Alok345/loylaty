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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit, Trash2, RefreshCw } from "lucide-react";

export default function RedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRedemption, setEditingRedemption] = useState(null);
  const [formData, setFormData] = useState({
    user_id: "",
    reward_id: "",
    store_id: "",
    points_spent: 0,
    status: "pending",
    contact_name: "",
    contact_mobile: "",
  });

  useEffect(() => {
    fetchRedemptions();
    fetchUsers();
    fetchRewards();
    fetchStores();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("id, email");
    if (data) setUsers(data);
  };

  const fetchRewards = async () => {
    const { data } = await supabase.from("rewards").select("id, name");
    if (data) setRewards(data);
  };

  const fetchStores = async () => {
    const { data } = await supabase.from("stores").select("id, name");
    if (data) setStores(data);
  };

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("redemptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message || "Failed to fetch redemptions");
      }

      // Fetch related data separately and merge
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
        const rewardIds = [...new Set(data.map(r => r.reward_id).filter(Boolean))];
        const storeIds = [...new Set(data.map(r => r.store_id).filter(Boolean))];

        const [usersData, rewardsData, storesData] = await Promise.all([
          userIds.length > 0 ? supabase.from("users").select("id, email").in("id", userIds) : { data: [] },
          rewardIds.length > 0 ? supabase.from("rewards").select("id, name").in("id", rewardIds) : { data: [] },
          storeIds.length > 0 ? supabase.from("stores").select("id, name").in("id", storeIds) : { data: [] },
        ]);

        const userMap = new Map((usersData.data || []).map(u => [u.id, u.email]));
        const rewardMap = new Map((rewardsData.data || []).map(r => [r.id, r.name]));
        const storeMap = new Map((storesData.data || []).map(s => [s.id, s.name]));

        data.forEach(redemption => {
          redemption.userEmail = userMap.get(redemption.user_id);
          redemption.rewardName = rewardMap.get(redemption.reward_id);
          redemption.storeName = storeMap.get(redemption.store_id);
        });
      }

      setRedemptions(data || []);
    } catch (err) {
      console.error("Error fetching redemptions:", err);
      setError(err.message || err.toString() || "Failed to fetch redemptions");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (redemption = null) => {
    if (redemption) {
      setEditingRedemption(redemption);
      setFormData({
        user_id: redemption.user_id || "",
        reward_id: redemption.reward_id?.toString() || "",
        store_id: redemption.store_id || "",
        points_spent: redemption.points_spent || 0,
        status: redemption.status || "pending",
        contact_name: redemption.contact_name || "",
        contact_mobile: redemption.contact_mobile || "",
      });
    } else {
      setEditingRedemption(null);
      setFormData({
        user_id: "",
        reward_id: "",
        store_id: "",
        points_spent: 0,
        status: "pending",
        contact_name: "",
        contact_mobile: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const redemptionData = {
        ...formData,
        reward_id: parseInt(formData.reward_id),
      };

      if (editingRedemption) {
        const { error: updateError } = await supabase
          .from("redemptions")
          .update(redemptionData)
          .eq("id", editingRedemption.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("redemptions")
          .insert([redemptionData]);

        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      fetchRedemptions();
    } catch (err) {
      console.error("Error saving redemption:", err);
      setError(err.message);
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
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Redemption
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : redemptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No redemptions found</div>
            ) : (
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
                      <TableCell>{redemption.userEmail || redemption.user_id}</TableCell>
                      <TableCell>{redemption.rewardName || redemption.reward_id}</TableCell>
                      <TableCell>{redemption.storeName || redemption.store_id}</TableCell>
                      <TableCell>{redemption.points_spent}</TableCell>
                      <TableCell className="capitalize">{redemption.status}</TableCell>
                      <TableCell>
                        {redemption.contact_name} ({redemption.contact_mobile})
                      </TableCell>
                      <TableCell>{formatDate(redemption.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(redemption)}
                          >
                            <Edit className="size-4" />
                          </Button>
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
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRedemption ? "Edit Redemption" : "Add New Redemption"}</DialogTitle>
              <DialogDescription>
                {editingRedemption ? "Update redemption information" : "Create a new redemption"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="user_id">User *</Label>
                  <select
                    id="user_id"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select user</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reward_id">Reward *</Label>
                  <select
                    id="reward_id"
                    value={formData.reward_id}
                    onChange={(e) => setFormData({ ...formData, reward_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select reward</option>
                    {rewards.map((reward) => (
                      <option key={reward.id} value={reward.id}>
                        {reward.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="store_id">Store *</Label>
                  <select
                    id="store_id"
                    value={formData.store_id}
                    onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select store</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="points_spent">Points Spent *</Label>
                  <Input
                    id="points_spent"
                    type="number"
                    value={formData.points_spent}
                    onChange={(e) => setFormData({ ...formData, points_spent: parseInt(e.target.value) || 0 })}
                    required
                    min="0"
                  />
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
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact_mobile">Contact Mobile</Label>
                  <Input
                    id="contact_mobile"
                    value={formData.contact_mobile}
                    onChange={(e) => setFormData({ ...formData, contact_mobile: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
