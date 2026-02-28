"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    Edit,
    RefreshCw,
    AlertCircle,
    Save,
    X,
    CheckCircle2,
    Filter,
    Search,
    Receipt,
    Eye,
    Package,
    Navigation,
    PhoneCall
} from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editStatus, setEditStatus] = useState("");
    const [updateError, setUpdateError] = useState(null);
    const [updateSuccess, setUpdateSuccess] = useState(false);

    // Filter state
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10;

    // Image Dialog state
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState("");

    useEffect(() => {
        fetchOrders();
    }, [startDate, endDate, currentPage, searchQuery]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query
            let query = supabase
                .from("purchase_orders")
                .select("*", { count: "exact" })
                .in("verification_status", ["pending", "approved"])
                .order("created_at", { ascending: false })
                .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

            // Apply date range filter
            if (startDate) {
                query = query.gte("created_at", `${startDate}T00:00:00`);
            }
            if (endDate) {
                query = query.lte("created_at", `${endDate}T23:59:59`);
            }

            const { data, error: fetchError, count } = await query;

            if (fetchError) {
                throw fetchError;
            }

            // Fetch user profiles for these orders
            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(o => o.user_id).filter(Boolean))];

                if (userIds.length > 0) {
                    const { data: profiles, error: profilesError } = await supabase
                        .from("profiles")
                        .select("id, full_name, mobile")
                        .in("id", userIds);

                    if (!profilesError) {
                        const profileMap = new Map(profiles.map(p => [p.id, p]));
                        data.forEach(order => {
                            order.user = profileMap.get(order.user_id);
                        });
                    }
                }
            }

            // Client-side search if needed
            let filteredData = data || [];
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                filteredData = filteredData.filter(o =>
                    (o.user?.full_name && o.user.full_name.toLowerCase().includes(q)) ||
                    (o.user?.mobile && o.user.mobile.includes(q)) ||
                    (o.owner_name && o.owner_name.toLowerCase().includes(q)) ||
                    (o.item_name && o.item_name.toLowerCase().includes(q))
                );
            }

            setOrders(filteredData);
            setTotalCount(searchQuery.trim() ? filteredData.length : (count || 0));
        } catch (err) {
            console.error("Error fetching purchase orders:", err);
            setError(err.message || "Failed to fetch purchase orders");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (order) => {
        setEditingId(order.id);
        setEditStatus(order.verification_status);
        setUpdateError(null);
        setUpdateSuccess(false);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditStatus("");
        setUpdateError(null);
        setUpdateSuccess(false);
    };

    const handleSaveStatus = async (id) => {
        try {
            setUpdateError(null);
            setUpdateSuccess(false);

            const { data, error: updateErr } = await supabase
                .from("purchase_orders")
                .update({ verification_status: editStatus })
                .eq("id", id)
                .select();

            if (updateErr) {
                console.error("Supabase update error detail:", updateErr);
                throw updateErr;
            }

            if (!data || data.length === 0) {
                throw new Error("Update failed: No data returned. Check RLS policies.");
            }

            setUpdateSuccess(true);
            setTimeout(() => {
                setEditingId(null);
                setEditStatus("");
                setUpdateSuccess(false);
                fetchOrders();
            }, 1000);
        } catch (err) {
            console.error("Error updating status:", err);
            setUpdateError(err.message || "Failed to update status");
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const openImage = (url) => {
        setSelectedImage(url);
        setImageDialogOpen(true);
    };

    return (
        <PageLayout title="Purchase Orders">
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Purchase Orders Management</CardTitle>
                                <CardDescription>Verify and manage customer purchase orders</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
                                <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Filter className="size-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Filters:</span>
                            </div>
                            <DateRangeFilter
                                startDate={startDate}
                                endDate={endDate}
                                onApply={(start, end) => {
                                    setStartDate(start);
                                    setEndDate(end);
                                    setCurrentPage(1);
                                }}
                                onClear={() => {
                                    setStartDate("");
                                    setEndDate("");
                                    setCurrentPage(1);
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <Search className="size-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, item, or ID..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-64 h-9"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading...</div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No purchase orders found</div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Order Details</TableHead>
                                            <TableHead>Customer Info</TableHead>
                                            <TableHead>Contact Detail</TableHead>
                                            <TableHead>Bill Image</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created At</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1 font-medium">
                                                            <Package className="size-3 text-muted-foreground" />
                                                            {order.item_name || "N/A"}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Qty: {order.quantity || 0}
                                                        </div>
                                                        <div className="text-[10px] font-mono text-muted-foreground">
                                                            ID: {order.id?.substring(0, 8)}...
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="font-medium">{order.owner_name || "N/A"}</div>
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Navigation className="size-3" />
                                                            {order.owner_city || "N/A"}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <PhoneCall className="size-3 text-muted-foreground" />
                                                            {order.owner_mobile || "N/A"}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            Inv: {order.invoice_number || "N/A"}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {order.photo_url ? (
                                                        <Button variant="outline" size="sm" onClick={() => openImage(order.photo_url)} className="h-8">
                                                            <Eye className="size-4 mr-1" />
                                                            View Bill
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No Image</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingId === order.id ? (
                                                        <div className="flex flex-col gap-1">
                                                            <select
                                                                value={editStatus}
                                                                onChange={(e) => setEditStatus(e.target.value)}
                                                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm min-w-[120px]"
                                                            >
                                                                <option value="pending">Pending</option>
                                                                <option value="approved">Approved</option>
                                                            </select>
                                                            <div className="flex gap-1 mt-1">
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={() => handleSaveStatus(order.id)}
                                                                    className="h-6 px-2 text-xs"
                                                                >
                                                                    <Save className="size-3" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={handleCancelEdit}
                                                                    className="h-6 px-2 text-xs"
                                                                >
                                                                    <X className="size-3" />
                                                                </Button>
                                                            </div>
                                                            {updateError && (
                                                                <p className="text-[10px] text-destructive mt-1 break-words max-w-[120px]">{updateError}</p>
                                                            )}
                                                            {updateSuccess && (
                                                                <p className="text-[10px] text-green-600 mt-1">Updated!</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-300 font-medium ${order.verification_status?.toLowerCase() === "pending"
                                                                ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                                                : order.verification_status?.toLowerCase() === "approved"
                                                                    ? "bg-green-100 text-green-800 border border-green-200"
                                                                    : "bg-red-100 text-red-800 border border-red-200"
                                                                }`}
                                                        >
                                                            {order.verification_status}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {formatDate(order.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    {editingId !== order.id && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(order)}
                                                        >
                                                            <Edit className="size-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Pagination */}
                        {orders.length > 0 && (
                            <div className="mt-4 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} orders
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1 || loading}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        disabled={currentPage * pageSize >= totalCount || loading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bill Image Dialog */}
            <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Bill Image</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center border rounded-lg overflow-hidden bg-muted">
                        <img src={selectedImage} alt="Bill" className="max-w-full h-auto max-h-[70vh] object-contain" />
                    </div>
                </DialogContent>
            </Dialog>
        </PageLayout>
    );
}
