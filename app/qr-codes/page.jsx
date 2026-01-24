"use client";

import { useState, useEffect, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
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
import { Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Printer, Tag, Filter } from "lucide-react";

export default function QRCodesPage() {
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchTagSearch, setBatchTagSearch] = useState("all");
  const [availableTags, setAvailableTags] = useState([]);
  const [batchTagName, setBatchTagName] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pointsFilter, setPointsFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availablePoints, setAvailablePoints] = useState([]);
  const pageSize = 120;

  const [formData, setFormData] = useState({
    points: 20,
    count: 10,
  });


  useEffect(() => {
    fetchQRCodes();
    fetchTagsAndPoints();
  }, [batchTagSearch, currentPage, pointsFilter, statusFilter]);

  const fetchTagsAndPoints = async () => {
    try {
      // Fetch unique tags
      const { data: tagData, error: tagError } = await supabase
        .from("qr_codes")
        .select("batch_tag")
        .not("batch_tag", "is", null);

      if (tagError) throw tagError;
      const uniqueTags = [...new Set(tagData.map(item => item.batch_tag))].sort();
      setAvailableTags(uniqueTags);

      // Fetch unique points
      const { data: pointsData, error: pointsError } = await supabase
        .from("qr_codes")
        .select("points")
        .order("points", { ascending: true });

      if (pointsError) throw pointsError;
      const uniquePoints = [...new Set(pointsData.map(item => item.points))];
      setAvailablePoints(uniquePoints);
    } catch (err) {
      console.error("Error fetching filter data:", err);
    }
  };

  const fetchQRCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from("qr_codes")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (batchTagSearch === "untagged") {
        query = query.is("batch_tag", null);
      } else if (batchTagSearch !== "all") {
        query = query.eq("batch_tag", batchTagSearch);
      }

      if (pointsFilter !== "all") {
        query = query.eq("points", parseInt(pointsFilter));
      }

      if (statusFilter === "active") {
        query = query.eq("active", true);
      } else if (statusFilter === "inactive") {
        query = query.eq("active", false);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setQrCodes(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching QR codes:", {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code,
        page: currentPage,
        filter: batchTagSearch
      });
      let errorMessage = err.message || "An error occurred while fetching QR codes.";
      if (err.details) errorMessage += ` (${err.details})`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      points: 20,
      count: 10,
    });
    setDialogOpen(true);
  };

  const generateUniqueCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "QR-";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += "-";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("You must be logged in to generate QR codes.");
      }

      const points = parseInt(formData.points);
      const count = parseInt(formData.count);

      if (isNaN(points) || points < 0) throw new Error("Points must be a non-negative number");
      if (isNaN(count) || count <= 0) throw new Error("Count must be greater than 0");
      if (count > 100) throw new Error("Maximum 100 QR codes can be generated at once");

      const newQrCodes = [];
      const generatedCodes = new Set();

      // Since we want them to be unique, we'll try to generate unique ones
      // In a real environment, we might want to check DB for collisions, 
      // but with 2^36 combinations for 8 alphanumeric chars, it's fairly safe for bulk.
      // However, to be extra safe, we'll just generate them and the DB unique constraint will catch duplicates if any.

      for (let i = 0; i < count; i++) {
        let code;
        do {
          code = generateUniqueCode();
        } while (generatedCodes.has(code));

        generatedCodes.add(code);
        newQrCodes.push({
          code,
          points,
          active: true,
        });
      }

      console.log(`Inserting ${count} new QR codes with ${points} points each`);
      const { data, error: insertError } = await supabase
        .from("qr_codes")
        .insert(newQrCodes)
        .select();

      if (insertError) throw insertError;

      console.log("QR codes inserted successfully:", data?.length);
      setDialogOpen(false);
      fetchQRCodes();
    } catch (err) {
      console.error("Error generating QR codes:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleAssignTag = async (e) => {
    e.preventDefault();
    if (!batchTagName.trim()) {
      setError("Please enter a batch tag name");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from("qr_codes")
        .update({ batch_tag: batchTagName.trim() })
        .in("id", selectedIds);

      if (updateError) throw updateError;

      setBatchDialogOpen(false);
      setBatchTagName("");
      setSelectedIds([]);
      fetchQRCodes();
      fetchTags();
    } catch (err) {
      console.error("Error assigning tag:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(qrCodes.map((q) => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    // Give more time for the QR codes to render and styles to apply
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 1500);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this QR code?")) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("qr_codes")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchQRCodes();
    } catch (err) {
      console.error("Error deleting QR code:", err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageLayout title="QR Codes">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <select
                  value={batchTagSearch}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setBatchTagSearch(e.target.value);
                  }}
                  className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-available disabled:opacity-50 appearance-none pr-8"
                >
                  <option value="all">All Batches</option>
                  <option value="untagged">Untagged</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
              </div>
              <div className="relative">
                <select
                  value={pointsFilter}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setPointsFilter(e.target.value);
                  }}
                  className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-available disabled:opacity-50 appearance-none pr-8"
                >
                  <option value="all">All Points</option>
                  {availablePoints.map((pts) => (
                    <option key={pts} value={pts}>
                      Points: {pts}
                    </option>
                  ))}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setStatusFilter(e.target.value);
                  }}
                  className="flex h-9 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-available disabled:opacity-50 appearance-none pr-8"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Used</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
              </div>
              <Button variant="outline" size="sm" onClick={fetchQRCodes} disabled={loading}>
                <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {selectedIds.length > 0 && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setBatchDialogOpen(true)}>
                    <Tag className="size-4 mr-2" />
                    Tag Selected ({selectedIds.length})
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handlePrint}>
                    <Printer className="size-4 mr-2" />
                    Print Selected ({selectedIds.length})
                  </Button>
                </>
              )}
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="size-4 mr-2" />
                Bulk Create QR Codes
              </Button>
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
            ) : qrCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No QR codes found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === qrCodes.length && qrCodes.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qrCodes.map((qrCode) => (
                    <TableRow key={qrCode.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(qrCode.id)}
                          onChange={(e) => handleSelectOne(qrCode.id, e.target.checked)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono">{qrCode.code}</TableCell>
                      <TableCell>{qrCode.points}</TableCell>
                      <TableCell>
                        {qrCode.batch_tag ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                            {qrCode.batch_tag}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">No tag</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {qrCode.active ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <XCircle className="size-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(qrCode.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(qrCode.id)}
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
            {qrCodes.length > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} QR codes
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Create QR Codes</DialogTitle>
              <DialogDescription>
                Generate multiple unique QR codes with the same point value.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="points">Points per QR Code *</Label>
                  <Input
                    id="points"
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="count">How many QR codes to create? *</Label>
                  <Input
                    id="count"
                    type="number"
                    value={formData.count}
                    onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                    required
                    min="1"
                    max="100"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Generating..." : "Generate & Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Batch Tag</DialogTitle>
              <DialogDescription>
                Enter a tag name for the {selectedIds.length} selected QR codes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignTag}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="batchTag">Tag Name *</Label>
                  <Input
                    id="batchTag"
                    value={batchTagName}
                    onChange={(e) => setBatchTagName(e.target.value)}
                    required
                    placeholder="Batch 1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBatchDialogOpen(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Assigning..." : "Assign Tag"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Print View - 60 Stickers (2 QR per sticker = 120 QR total) */}
      <div className={`${isPrinting ? "block" : "hidden"} print:block print:bg-white`}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: A4;
              margin: 0 !important;
            }
            
            html, body {
              width: 210mm !important;
              height: 290mm !important;
              margin: 0 9mm !important;
              padding: 0 !important;
              overflow: hidden !important;
            }
            
            /* Hide all content visually */
            body * {
              visibility: hidden !important;
            }
            
            /* Show print container and its children */
            .print-container-root,
            .print-container-root * {
              visibility: visible !important;
            }
            
            .print-container-root {
              position: fixed !important;
              left: 0 !important;
              top: 2.5mm !important;
              width: 100vw !important;
              height: 100vh !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              display: flex !important;
              color: black !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
              page-break-after: avoid !important;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .sticker-grid {
              display: grid !important;
              grid-template-columns: repeat(4, 25%) !important;
              grid-template-rows: repeat(15, calc(100% / 16)) !important;
              row-gap: 1mm !important;
              column-gap: 0 !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
            }

            .sticker-cell {
              display: flex !important;
              flex-direction: row !important;
              justify-content: center !important;
              align-items: center !important;
              gap: 10mm !important;
              border-bottom: 0.5pt solid #ddd !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
            }

            .qr-item {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 0 !important;
            }

            .qr-item svg {
              width: 16mm !important;
              height: 16mm !important;
            }

            .qr-code-label {
              font-size: 5pt !important;
              font-family: monospace !important;
              font-weight: bold !important;
              color: black !important;
              line-height: 1 !important;
              margin-top: 0.5mm !important;
            }
          }
        `}} />
        <div className="print-container-root hidden print:block bg-white text-black">
          <div className="sticker-grid">
            {(() => {
              const selected = qrCodes.filter(q => selectedIds.includes(q.id));
              const stickers = [];
              for (let i = 0; i < selected.length; i += 2) {
                const qr1 = selected[i];
                const qr2 = selected[i + 1];
                stickers.push(
                  <div key={i} className="sticker-cell">
                    <div className="qr-item">
                      <QRCodeSVG
                        value={qr1.code}
                        size={56}
                        level="H"
                        includeMargin={false}
                        fgColor="#000000"
                        bgColor="#FFFFFF"
                      />
                      <span className="qr-code-label">{qr1.code}</span>
                    </div>
                    {qr2 && (
                      <div className="qr-item">
                        <QRCodeSVG
                          value={qr2.code}
                          size={56}
                          level="H"
                          includeMargin={false}
                          fgColor="#000000"
                          bgColor="#FFFFFF"
                        />
                        <span className="qr-code-label">{qr2.code}</span>
                      </div>
                    )}
                  </div>
                );
              }
              return stickers;
            })()}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
