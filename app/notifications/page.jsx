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
import { Plus, Edit, Trash2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [formData, setFormData] = useState({
    user_id: "",
    title: "",
    message: "",
    is_read: false,
  });

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("id, email");
    if (data) setUsers(data);
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message || "Failed to fetch notifications");
      }

      // Fetch user emails separately and merge
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(n => n.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, email")
            .in("id", userIds);

          if (usersData) {
            const userMap = new Map(usersData.map(u => [u.id, u.email]));
            data.forEach(notification => {
              notification.userEmail = userMap.get(notification.user_id);
            });
          }
        }
      }

      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err.message || err.toString() || "Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (notification = null) => {
    if (notification) {
      setEditingNotification(notification);
      setFormData({
        user_id: notification.user_id || "",
        title: notification.title || "",
        message: notification.message || "",
        is_read: notification.is_read || false,
      });
    } else {
      setEditingNotification(null);
      setFormData({
        user_id: "",
        title: "",
        message: "",
        is_read: false,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingNotification) {
        const { error: updateError } = await supabase
          .from("notifications")
          .update(formData)
          .eq("id", editingNotification.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("notifications")
          .insert([formData]);

        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      fetchNotifications();
    } catch (err) {
      console.error("Error saving notification:", err);
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchNotifications();
    } catch (err) {
      console.error("Error deleting notification:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageLayout title="Notifications">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                {/* <CardTitle>Notifications Management</CardTitle>
                <CardDescription>Manage and send notifications to users</CardDescription> */}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchNotifications} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Notification
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
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No notifications found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Read</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>{notification.userEmail || notification.user_id}</TableCell>
                      <TableCell className="font-medium">{notification.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{notification.message}</TableCell>
                      <TableCell>
                        {notification.is_read ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <XCircle className="size-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(notification.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(notification)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notification.id)}
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
              <DialogTitle>{editingNotification ? "Edit Notification" : "Add New Notification"}</DialogTitle>
              <DialogDescription>
                {editingNotification ? "Update notification" : "Create a new notification"}
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
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={4}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_read"
                    checked={formData.is_read}
                    onChange={(e) => setFormData({ ...formData, is_read: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="is_read">Mark as read</Label>
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
