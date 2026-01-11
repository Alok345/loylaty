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

export default function BannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    redirect_url: "",
    position: "",
    active: true,
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("banners")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setBanners(data || []);
    } catch (err) {
      console.error("Error fetching banners:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (banner = null) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title || "",
        image_url: banner.image_url || "",
        redirect_url: banner.redirect_url || "",
        position: banner.position || "",
        active: banner.active ?? true,
        start_date: banner.start_date ? banner.start_date.split("T")[0] : "",
        end_date: banner.end_date ? banner.end_date.split("T")[0] : "",
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: "",
        image_url: "",
        redirect_url: "",
        position: "",
        active: true,
        start_date: "",
        end_date: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const bannerData = {
        ...formData,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from("banners")
          .update(bannerData)
          .eq("id", editingBanner.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("banners")
          .insert([bannerData]);

        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      fetchBanners();
    } catch (err) {
      console.error("Error saving banner:", err);
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("banners")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchBanners();
    } catch (err) {
      console.error("Error deleting banner:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <PageLayout title="Banners">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                {/* <CardTitle>Banners Management</CardTitle> */}
                {/* <CardDescription>Manage your promotional banners and advertisements</CardDescription> */}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchBanners} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Banner
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
            ) : banners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No banners found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Image URL</TableHead>
                    <TableHead>Redirect URL</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners.map((banner) => (
                    <TableRow key={banner.id}>
                      <TableCell className="font-medium">{banner.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{banner.image_url || "N/A"}</TableCell>
                      <TableCell className="max-w-xs truncate">{banner.redirect_url || "N/A"}</TableCell>
                      <TableCell>{banner.position || "N/A"}</TableCell>
                      <TableCell>
                        {banner.active ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <XCircle className="size-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(banner.start_date)}</TableCell>
                      <TableCell>{formatDate(banner.end_date)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(banner)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(banner.id)}
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
              <DialogTitle>{editingBanner ? "Edit Banner" : "Add New Banner"}</DialogTitle>
              <DialogDescription>
                {editingBanner ? "Update banner information" : "Create a new promotional banner"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="redirect_url">Redirect URL</Label>
                  <Input
                    id="redirect_url"
                    value={formData.redirect_url}
                    onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="top, bottom, sidebar, etc."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
