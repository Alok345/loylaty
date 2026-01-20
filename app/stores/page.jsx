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
import { Plus, Edit, Trash2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export default function StoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    active: true,
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setStores(data || []);
    } catch (err) {
      console.error("Error fetching stores:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (store = null) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name || "",
        location: store.location || "",
        active: store.active ?? true,
      });
    } else {
      setEditingStore(null);
      setFormData({
        name: "",
        location: "",
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
        throw new Error("You must be logged in to save stores. Please refresh the page and log in again.");
      }

      // Explicitly construct payload
      const storeData = {
        name: formData.name,
        location: formData.location,
        active: formData.active,
      };

      if (editingStore) {
        console.log("Updating store:", editingStore.id, "with data:", storeData);
        const { data, error: updateError } = await supabase
          .from("stores")
          .update(storeData)
          .eq("id", editingStore.id)
          .select();

        if (updateError) throw updateError;
        if (!data || data.length === 0) {
          throw new Error("Update completed but no data was returned. The store may not exist or RLS policy prevented the update.");
        }
        console.log("Store updated successfully:", data);
      } else {
        console.log("Inserting new store:", storeData);
        const { data, error: insertError } = await supabase
          .from("stores")
          .insert([storeData])
          .select();

        if (insertError) throw insertError;
        if (!data || data.length === 0) {
          throw new Error("Insert completed but no data was returned. RLS policy may have prevented the insertion.");
        }
        console.log("Store inserted successfully:", data);
      }

      setDialogOpen(false);
      fetchStores();
    } catch (err) {
      console.error("Error saving store:", err);
      let errorMessage = "Failed to save store";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === "object") {
        const errMsg = err.message || err.details || err.hint;
        if (errMsg) {
          errorMessage = errMsg;
          if (errMsg.includes("row-level security policy") || errMsg.includes("RLS") || errMsg.includes("permission denied")) {
            errorMessage = `Row-level security policy violation: ${errMsg}. Please check your Supabase RLS policies for the 'stores' table.`;
          }
        }
      }
      setError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this store?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("stores")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchStores();
    } catch (err) {
      console.error("Error deleting store:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageLayout title="Stores">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Stores Management</CardTitle>
                <CardDescription>Manage store locations and information</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchStores} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Store
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
            ) : stores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No stores found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell>{store.location}</TableCell>
                      <TableCell>
                        {store.active ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <XCircle className="size-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(store.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(store)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(store.id)}
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStore ? "Edit Store" : "Add New Store"}</DialogTitle>
              <DialogDescription>
                {editingStore ? "Update store information" : "Create a new store"}
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
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
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
