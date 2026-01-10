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
import { Plus, Edit, Trash2, RefreshCw, AlertCircle } from "lucide-react";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    user_id: "",
    type: "credit",
    amount: 0,
    description: "",
  });

  useEffect(() => {
    fetchTransactions();
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, full_name, mobile");
      if (data) setProfiles(data);
    } catch (err) {
      console.error("Error fetching profiles:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session user:", session?.user?.id);
      
      // Fetch ALL transactions without any filters
      const { data, error: fetchError } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        let errorMessage = fetchError.message || "Failed to fetch transactions";
        if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
          errorMessage = `Row-level security policy violation: ${errorMessage}. Please check your RLS policies for the 'transactions' table.`;
        }
        throw new Error(errorMessage);
      }

      console.log(`Fetched ${data?.length || 0} transactions from database`);
      console.log("Transaction IDs:", data?.map(t => t.id));

      // Fetch user names from profiles table and merge
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))];
        console.log("Fetching user profiles for IDs:", userIds);
        
        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, mobile")
            .in("id", userIds);

          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
          } else if (profilesData) {
            const profileMap = new Map(profilesData.map(p => [p.id, { name: p.full_name, mobile: p.mobile }]));
            data.forEach(transaction => {
              const profile = profileMap.get(transaction.user_id);
              transaction.userName = profile?.name || null;
              transaction.userMobile = profile?.mobile || null;
            });
          }
        }
      }

      setTransactions(data || []);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      let errorMessage = err.message || err.toString() || "Failed to fetch transactions";
      if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
        errorMessage = `Row-level security policy violation: ${errorMessage}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        user_id: transaction.user_id || "",
        type: transaction.type || "credit",
        amount: transaction.amount || 0,
        description: transaction.description || "",
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        user_id: "",
        type: "credit",
        amount: 0,
        description: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingTransaction) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update(formData)
          .eq("id", editingTransaction.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("transactions")
          .insert([formData]);

        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      fetchTransactions();
    } catch (err) {
      console.error("Error saving transaction:", err);
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchTransactions();
    } catch (err) {
      console.error("Error deleting transaction:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageLayout title="Transactions">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions Management</CardTitle>
                <CardDescription>View and manage transaction history</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
                  <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4 mr-2" />
                  Add Transaction
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
                        <li>Go to Supabase Dashboard → Table Editor → transactions table → Policies</li>
                        <li>Create or update a SELECT policy that allows authenticated users to read all transactions</li>
                        <li>Example policy: <code className="bg-muted px-1 rounded">CREATE POLICY "Allow authenticated users to read all transactions" ON transactions FOR SELECT TO authenticated USING (true);</code></li>
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-muted-foreground">No transactions found</div>
                {!error && (
                  <div className="text-sm text-muted-foreground">
                    If you have transactions in your database, this might be due to RLS policies restricting access.
                  </div>
                )}
              </div>
            ) : (
              <>
                {transactions.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                      Showing <strong>{transactions.length}</strong> transaction(s) from the database.
                    </div>
                  </div>
                )}
                <div className="rounded-md border overflow-x-auto">
                  <div className="p-4 border-b bg-muted/50">
                    <div className="font-semibold text-sm">Table: transactions</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Columns: id, user_id, type, amount, description, created_at
                    </div>
                  </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-xs">
                          {transaction.id?.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {transaction.userName || transaction.user_id || "N/A"}
                          </div>
                          {transaction.userMobile && (
                            <div className="text-xs text-muted-foreground">
                              {transaction.userMobile}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.type?.toUpperCase() === "CREDIT" ? "bg-green-100 text-green-800" :
                            transaction.type?.toUpperCase() === "DEBIT" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {transaction.type || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className={`font-medium ${
                          transaction.type?.toUpperCase() === "CREDIT" ? "text-green-600" : 
                          transaction.type?.toUpperCase() === "DEBIT" ? "text-red-600" : 
                          "text-gray-600"
                        }`}>
                          {transaction.type?.toUpperCase() === "CREDIT" ? "+" : "-"}{transaction.amount?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{transaction.description || "N/A"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(transaction.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(transaction)}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(transaction.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "Edit Transaction" : "Add New Transaction"}</DialogTitle>
              <DialogDescription>
                {editingTransaction ? "Update transaction information" : "Create a new transaction"}
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
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name || profile.id} {profile.mobile && `(${profile.mobile})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Type *</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                    required
                    min="0"
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
