"use client";

import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { RefreshCw, AlertCircle } from "lucide-react";

export default function QRScanLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session user:", session?.user?.id);
      
      // Fetch ALL QR scan logs without any filters
      const { data, error: fetchError } = await supabase
        .from("qr_scan_logs")
        .select("*")
        .order("scanned_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase fetch error:", fetchError);
        let errorMessage = fetchError.message || "Failed to fetch QR scan logs";
        if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
          errorMessage = `Row-level security policy violation: ${errorMessage}. Please check your RLS policies for the 'qr_scan_logs' table.`;
        }
        throw new Error(errorMessage);
      }

      console.log(`Fetched ${data?.length || 0} QR scan logs from database`);
      console.log("Log IDs:", data?.map(l => l.id));

      // Fetch related data separately and merge
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(l => l.user_id).filter(Boolean))];
        const qrCodeIds = [...new Set(data.map(l => l.qr_code_id).filter(Boolean))];
        const storeIds = [...new Set(data.map(l => l.store_id).filter(Boolean))];

        console.log("Fetching related data - User IDs:", userIds, "QR Code IDs:", qrCodeIds, "Store IDs:", storeIds);

        const [usersData, qrCodesData, storesData] = await Promise.all([
          userIds.length > 0 ? supabase.from("profiles").select("id, full_name, mobile").in("id", userIds) : Promise.resolve({ data: [], error: null }),
          qrCodeIds.length > 0 ? supabase.from("qr_codes").select("id, code, points").in("id", qrCodeIds) : Promise.resolve({ data: [], error: null }),
          storeIds.length > 0 ? supabase.from("stores").select("id, name, location").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
        ]);

        const userMap = new Map((usersData.data || []).map(u => [u.id, { name: u.full_name, mobile: u.mobile }]));
        const qrCodeMap = new Map((qrCodesData.data || []).map(q => [q.id, { code: q.code, points: q.points }]));
        const storeMap = new Map((storesData.data || []).map(s => [s.id, { name: s.name, location: s.location }]));

        data.forEach(log => {
          const user = userMap.get(log.user_id);
          log.userName = user?.name || null;
          log.userMobile = user?.mobile || null;
          
          const qrCode = qrCodeMap.get(log.qr_code_id);
          log.qrCodeCode = qrCode?.code || null;
          log.qrCodePoints = qrCode?.points || null;
          
          const store = storeMap.get(log.store_id);
          log.storeName = store?.name || null;
          log.storeLocation = store?.location || null;
        });
      }

      setLogs(data || []);
      
      // Warn if fewer records than expected
      if (data && data.length === 0) {
        console.warn("No QR scan logs returned. Check RLS policies if you have records in the database.");
      }
    } catch (err) {
      console.error("Error fetching QR scan logs:", err);
      let errorMessage = err.message || err.toString() || "Failed to fetch QR scan logs";
      if (errorMessage.includes("row-level security policy") || errorMessage.includes("RLS")) {
        errorMessage = `Row-level security policy violation: ${errorMessage}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
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
                        <li>Go to Supabase Dashboard → Table Editor → qr_scan_logs table → Policies</li>
                        <li>Create or update a SELECT policy that allows authenticated users to read all QR scan logs</li>
                        <li>Example policy: <code className="bg-muted px-1 rounded">CREATE POLICY "Allow authenticated users to read all qr_scan_logs" ON qr_scan_logs FOR SELECT TO authenticated USING (true);</code></li>
                      </ol>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading QR scan logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-muted-foreground">No QR scan logs found</div>
                {!error && (
                  <div className="text-sm text-muted-foreground">
                    If you have QR scan logs in your database, this might be due to RLS policies restricting access.
                  </div>
                )}
              </div>
            ) : (
              <>
                {logs.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                      Showing <strong>{logs.length}</strong> QR scan log(s) from the database.
                    </div>
                  </div>
                )}
                <div className="rounded-md border overflow-x-auto">
                  <div className="p-4 border-b bg-muted/50">
                    <div className="font-semibold text-sm">Table: qr_scan_logs</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Columns: id, user_id, qr_code_id, store_id, scanned_at
                    </div>
                  </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>User Name</TableHead>
                      <TableHead>QR Code ID</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Store ID</TableHead>
                      <TableHead>Store Name</TableHead>
                      <TableHead>Scanned At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {log.id || "N/A"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.user_id || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {log.userName || "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.userMobile || ""}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.qr_code_id || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">
                            {log.qrCodeCode || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          +{log.qrCodePoints || 0}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.store_id || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.storeName || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.storeLocation || ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(log.scanned_at)}
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
      </div>
    </PageLayout>
  );
}
