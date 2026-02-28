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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit, Trash2, RefreshCw, CheckCircle2, XCircle, Send } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // CRUD Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [formData, setFormData] = useState({
    user_id: "",
    title: "",
    message: "",
    is_read: false,
  });

  // Push Notification Dialog State
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [stores, setStores] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pushData, setPushData] = useState({
    targetType: "store", // "store" or "occupation"
    targetValue: "",
    title: "",
    message: "",
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(null);
  const [pushError, setPushError] = useState(null);

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
    fetchStores();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id, email");

      if (error) {
        console.error("Error fetching users from profiles:", error);
        return;
      }

      if (data) setUsers(data);
    } catch (err) {
      console.error("Unexpected error in fetchUsers:", err);
    }
  };

  const fetchStores = async () => {
    const { data } = await supabase.from("stores").select("name").eq("active", true);
    if (data) setStores(data);
  };

  const fetchRoles = async () => {
    try {
      console.log("Fetching roles...");
      const { data, error } = await supabase.from("profiles").select("role");

      if (error) {
        console.error("Error fetching roles from Supabase:", error);
        return;
      }

      if (data) {
        const distinctRoles = [...new Set(data.map(u => u.role).filter(Boolean))];
        setRoles(distinctRoles);
      }
    } catch (err) {
      console.error("Unexpected error in fetchRoles:", err);
    }
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
          try {
            const { data: usersData, error: usersError } = await supabase
              .from("profiles")
              .select("id, email")
              .in("id", userIds);

            if (usersError) {
              console.error("Error fetching user profiles:", usersError);
            } else if (usersData) {
              const userMap = new Map(usersData.map(u => [u.id, u.email]));
              data.forEach(notification => {
                notification.userEmail = userMap.get(notification.user_id);
              });
            }
          } catch (profileErr) {
            console.error("Error in profile fetch:", profileErr);
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

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be logged in to save notifications.");
      }

      const notificationData = {
        user_id: formData.user_id,
        title: formData.title,
        message: formData.message,
        is_read: formData.is_read,
      };

      if (editingNotification) {
        const { data, error: updateError } = await supabase
          .from("notifications")
          .update(notificationData)
          .eq("id", editingNotification.id)
          .select();

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("notifications")
          .insert([notificationData])
          .select();

        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      fetchNotifications();
    } catch (err) {
      console.error("Error saving notification:", err);
      setError(err.message || "Failed to save notification");
    }
  };

  const handlePushSubmit = async (e) => {
    e.preventDefault();
    setPushLoading(true);
    setPushSuccess(null);
    setPushError(null);

    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send notification");
      }

      setPushSuccess(`Notification sent to ${result.successCount} users.`);
      setPushData({ targetType: "store", targetValue: "", title: "", message: "" });

      // Refresh notifications list if backend also inserts them
      fetchNotifications();

      setTimeout(() => {
        setPushDialogOpen(false);
        setPushSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("Error sending push notification:", err);
      setPushError(err.message);
    } finally {
      setPushLoading(false);
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
              <div></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchNotifications} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                      <Send className="size-4 mr-2" />
                      Send Push Notification
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Send Push Notification</DialogTitle>
                      <DialogDescription>
                        Send notifications to users via Firebase Cloud Messaging based on filters.
                      </DialogDescription>
                    </DialogHeader>
                    {pushError && <Alert variant="destructive"><AlertDescription>{pushError}</AlertDescription></Alert>}
                    {pushSuccess && <Alert className="bg-green-50 text-green-800 border-green-200"><CheckCircle2 className="h-4 w-4 mr-2" /> <AlertDescription>{pushSuccess}</AlertDescription></Alert>}

                    <form onSubmit={handlePushSubmit} className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label>Target Audience</Label>
                        <Select
                          value={pushData.targetType}
                          onValueChange={(val) => setPushData({ ...pushData, targetType: val, targetValue: "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Target" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="store">Store Wise</SelectItem>
                            <SelectItem value="occupation">Occupation Type</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {pushData.targetType === "store" && (
                        <div className="grid gap-2">
                          <Label>Select Store</Label>
                          <Select
                            value={pushData.targetValue}
                            onValueChange={(val) => setPushData({ ...pushData, targetValue: val })}
                            required={pushData.targetType === "store"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose Store" />
                            </SelectTrigger>
                            <SelectContent>
                              {stores.map(store => (
                                <SelectItem key={store.name} value={store.name}>{store.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {pushData.targetType === "occupation" && (
                        <div className="grid gap-2">
                          <Label>Select Occupation</Label>
                          <Select
                            value={pushData.targetValue}
                            onValueChange={(val) => setPushData({ ...pushData, targetValue: val })}
                            required={pushData.targetType === "occupation"}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose Occupation" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role || "unknown"} value={role || "Unknown"}>
                                  {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unknown"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label>Title</Label>
                        <Input
                          value={pushData.title}
                          onChange={(e) => setPushData({ ...pushData, title: e.target.value })}
                          required
                          placeholder="Notification Title"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Message</Label>
                        <Textarea
                          value={pushData.message}
                          onChange={(e) => setPushData({ ...pushData, message: e.target.value })}
                          required
                          placeholder="Type your message here. Use @ to insert user's name."
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">Tip: Use '@' as a placeholder for the user's name.</p>
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPushDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={pushLoading}>
                          {pushLoading ? "Sending..." : "Send Notification"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Manual Log
                </Button> */}
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
              <DialogTitle>{editingNotification ? "Edit Notification Log" : "Add Notification Log"}</DialogTitle>
              <DialogDescription>
                {editingNotification ? "Update notification record" : "Manually add a notification record"}
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
