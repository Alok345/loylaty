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

export default function QRScanLogsPage() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [qrCodes, setQrCodes] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [formData, setFormData] = useState({
    user_id: "",
    qr_code_id: "",
    store_id: "",
    scanned_at: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    fetchLogs();
    fetchUsers();
    fetchQRCodes();
    fetchStores();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("id, email");
    if (data) setUsers(data);
  };

  const fetchQRCodes = async () => {
    const { data } = await supabase.from("qr_codes").select("id, code");
    if (data) setQrCodes(data);
  };

  const fetchStores = async () => {
    const { data } = await supabase.from("stores").select("id, name");
    if (data) setStores(data);
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("qr_scan_logs")
        .select("*, users(email), qr_codes(code), stores(name)")
        .order("scanned_at", { ascending: false });

      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching scan logs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (log = null) => {
    if (log) {
      setEditingLog(log);
      setFormData({
        user_id: log.user_id || "",
        qr_code_id: log.qr_code_id || "",
        store_id: log.store_id || "",
        scanned_at: log.scanned_at ? log.scanned_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
      });
    } else {
      setEditingLog(null);
      setFormData({
        user_id: "",
        qr_code_id: "",
        store_id: "",
        scanned_at: new Date().toISOString().slice(0, 16),
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const logData = {
        ...formData,
        scanned_at: new Date(formData.scanned_at).toISOString(),
      };

      if (editingLog) {
        const { error: updateError } = await supabase
          .from("qr_scan_logs")
          .update(logData)
          .eq("id", editingLog.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("qr_scan_logs")
          .insert([logData]);

        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      fetchLogs();
    } catch (err) {
      console.error("Error saving scan log:", err);
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this scan log?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("qr_scan_logs")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchLogs();
    } catch (err) {
      console.error("Error deleting scan log:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageLayout title="QR Scan Logs">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>QR Scan Logs</CardTitle>
                <CardDescription>View logs of QR code scans</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Log
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
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No scan logs found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Scanned At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.users?.email || log.user_id}</TableCell>
                      <TableCell className="font-mono">{log.qr_codes?.code || log.qr_code_id}</TableCell>
                      <TableCell>{log.stores?.name || log.store_id}</TableCell>
                      <TableCell>{formatDate(log.scanned_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(log)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(log.id)}
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
              <DialogTitle>{editingLog ? "Edit Scan Log" : "Add New Scan Log"}</DialogTitle>
              <DialogDescription>
                {editingLog ? "Update scan log information" : "Create a new scan log entry"}
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
                  <Label htmlFor="qr_code_id">QR Code *</Label>
                  <select
                    id="qr_code_id"
                    value={formData.qr_code_id}
                    onChange={(e) => setFormData({ ...formData, qr_code_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select QR code</option>
                    {qrCodes.map((qr) => (
                      <option key={qr.id} value={qr.id}>
                        {qr.code}
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
                  <Label htmlFor="scanned_at">Scanned At *</Label>
                  <Input
                    id="scanned_at"
                    type="datetime-local"
                    value={formData.scanned_at}
                    onChange={(e) => setFormData({ ...formData, scanned_at: e.target.value })}
                    required
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
