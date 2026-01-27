"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Edit, Trash2, RefreshCw, CheckCircle2, XCircle, Image as ImageIcon } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

export default function RewardsPage() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cost: 0,
    image_url: "",
    active: true,
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("rewards")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setRewards(data || []);
    } catch (err) {
      console.error("Error fetching rewards:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (reward = null) => {
    if (reward) {
      setEditingReward(reward);
      setFormData({
        name: reward.name || "",
        description: reward.description || "",
        cost: reward.cost || 0,
        image_url: reward.image_url || "",
        active: reward.active ?? true,
      });
    } else {
      setEditingReward(null);
      setFormData({
        name: "",
        description: "",
        cost: 0,
        image_url: "",
        active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);

      // Check session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be logged in to save rewards. Please refresh the page and log in again.");
      }

      // Explicitly construct payload
      const rewardData = {
        name: formData.name,
        description: formData.description || null,
        cost: parseInt(formData.cost) || 0,
        image_url: formData.image_url || null,
        active: formData.active,
      };

      if (editingReward) {
        console.log("Updating reward:", editingReward.id, "with data:", rewardData);
        const { data, error: updateError } = await supabase
          .from("rewards")
          .update(rewardData)
          .eq("id", editingReward.id)
          .select();

        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          throw new Error("Update completed but no data was returned. The reward may not exist or RLS policy prevented the update.");
        }
        console.log("Reward updated successfully:", data);
      } else {
        console.log("Inserting new reward:", rewardData);
        const { data, error: insertError } = await supabase
          .from("rewards")
          .insert([rewardData])
          .select();

        if (insertError) throw insertError;
        if (!data || data.length === 0) {
          throw new Error("Insert completed but no data was returned. RLS policy may have prevented the insertion.");
        }
        console.log("Reward inserted successfully:", data);
      }

      setDialogOpen(false);
      fetchRewards();
    } catch (err) {
      console.error("Error saving reward:", err);
      let errorMessage = "Failed to save reward";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === "object") {
        const errMsg = err.message || err.details || err.hint;
        if (errMsg) {
          errorMessage = errMsg;
          if (errMsg.includes("row-level security policy") || errMsg.includes("RLS") || errMsg.includes("permission denied")) {
            errorMessage = `Row-level security policy violation: ${errMsg}. Please check your Supabase RLS policies for the 'rewards' table.`;
          }
        }
      }
      setError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this reward?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("rewards")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchRewards();
    } catch (err) {
      console.error("Error deleting reward:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageLayout title="Rewards">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Rewards Management</CardTitle>
                <CardDescription>Manage rewards and incentives</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchRewards} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Reward
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
            ) : rewards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No rewards found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost (Points)</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="font-medium">{reward.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{reward.description || "N/A"}</TableCell>
                      <TableCell>{reward.cost}</TableCell>
                      <TableCell>
                        {reward.image_url ? (
                          <div className="w-12 h-12 rounded overflow-hidden border">
                            <img
                              src={reward.image_url}
                              alt={reward.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center border">
                            <ImageIcon className="size-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {reward.active ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <XCircle className="size-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(reward.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(reward)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(reward.id)}
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
              <DialogTitle>{editingReward ? "Edit Reward" : "Add New Reward"}</DialogTitle>
              <DialogDescription>
                {editingReward ? "Update reward information" : "Create a new reward"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cost">Cost (Points) *</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseInt(e.target.value) || 0 })}
                    required
                    min="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Image</Label>
                  <ImageUpload
                    value={formData.image_url}
                    onChange={(url) => setFormData({ ...formData, image_url: url })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="active">Active</Label>
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
