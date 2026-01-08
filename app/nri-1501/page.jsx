// app/nri1502/page.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Filter,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Globe,
  X,
  CalendarDays,
  Copy,
  AlertCircle,
} from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function NRI1502() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pushingLeadId, setPushingLeadId] = useState(null);
  const [markingDuplicateId, setMarkingDuplicateId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const [sortConfig, setSortConfig] = useState({
    key: "submittedAt",
    direction: "desc",
  });

  // Function to convert UTC to IST
  const convertUTCtoIST = (date) => {
    if (!date) return null;
    const utcDate = new Date(date);
    // IST is UTC+5:30
    return new Date(utcDate.getTime());
  };

  // Function to get IST date string (YYYY-MM-DD format)
  const getISTDateString = (date) => {
    const istDate = convertUTCtoIST(date);
    if (!istDate) return "";
    return istDate.toISOString().split("T")[0];
  };

  // Function to check if two dates are same in IST
  const isSameISTDate = (date1, date2) => {
    if (!date1 || !date2) return false;

    const istDate1 = convertUTCtoIST(date1);
    const istDate2 = convertUTCtoIST(date2);

    if (!istDate1 || !istDate2) return false;

    return (
      istDate1.getFullYear() === istDate2.getFullYear() &&
      istDate1.getMonth() === istDate2.getMonth() &&
      istDate1.getDate() === istDate2.getDate()
    );
  };

  // Fetch leads from Firestore
  useEffect(() => {
    const q = query(collection(db, "nri-1501"), orderBy("submittedAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const leadsData = [];
      querySnapshot.forEach((doc) => {
        leadsData.push({ id: doc.id, ...doc.data() });
      });
      setLeads(leadsData);
      setFilteredLeads(leadsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let result = leads;

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(term) ||
          lead.phone?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.id?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    // if (statusFilter !== "all") {
    //   result = result.filter((lead) => lead.status === statusFilter);
    // }

    // Apply status filter
    if (statusFilter !== "all") {
      if (statusFilter === "new") {
        // Include both "new" status and undefined/null status
        result = result.filter((lead) => !lead.status || lead.status === "new");
      } else {
        result = result.filter((lead) => lead.status === statusFilter);
      }
    }

    // Apply date filter using IST
    if (startDate || endDate) {
  result = result.filter((lead) => {
    const leadDate = lead.submittedAt?.toDate();
    if (!leadDate) return false;

    const istLeadDate = convertUTCtoIST(leadDate);

    if (startDate && endDate) {
      const start = new Date(startDate + "T00:00:00Z");
      const end = new Date(endDate + "T23:59:59Z");
      return istLeadDate >= start && istLeadDate <= end;
    } else if (startDate) {
      const start = new Date(startDate + "T00:00:00Z");
      return isSameISTDate(istLeadDate, start);
    } else if (endDate) {
      const end = new Date(endDate + "T00:00:00Z");
      return isSameISTDate(istLeadDate, end);
    }

    return true;
  });
}

    // Apply sorting
    result = [...result].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) return 0;

      if (sortConfig.key === "submittedAt" || sortConfig.key === "pushedAt") {
        const aDate = aValue.toDate();
        const bDate = bValue.toDate();
        return sortConfig.direction === "asc"
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });

    setFilteredLeads(result);
    setCurrentPage(1);
  }, [leads, searchTerm, statusFilter, startDate, endDate, sortConfig]);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  // Push lead status
  const handlePushLead = async (leadId) => {
    try {
      setPushingLeadId(leadId);
      const leadRef = doc(db, "nri-1501", leadId);

      // Check current status
      const leadDoc = await getDoc(leadRef);
      const currentStatus = leadDoc.data()?.status;

      // Only update if not already pushed
      if (currentStatus !== "pushed") {
        await updateDoc(leadRef, {
          status: "pushed",
          pushedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error pushing lead:", error);
      alert("Error updating lead status");
    } finally {
      setPushingLeadId(null);
    }
  };

  // Mark as duplicate
  const handleMarkAsDuplicate = async (leadId) => {
    if (
      !window.confirm("Are you sure you want to mark this lead as duplicate?")
    ) {
      return;
    }

    try {
      setMarkingDuplicateId(leadId);
      const leadRef = doc(db, "nri-1501", leadId);

      const leadDoc = await getDoc(leadRef);
      const currentStatus = leadDoc.data()?.status;

      if (currentStatus !== "duplicate") {
        await updateDoc(leadRef, {
          status: "duplicate",
          duplicateMarkedAt: new Date(),
          duplicateMarkedBy: "admin",
        });
        alert("Lead marked as duplicate successfully!");
      }
    } catch (error) {
      console.error("Error marking lead as duplicate:", error);
      alert("Error marking lead as duplicate");
    } finally {
      setMarkingDuplicateId(null);
    }
  };

  // Download to Excel
  const handleDownloadExcel = () => {
    const worksheetData = filteredLeads.map((lead) => ({
      ID: lead.id,
      Name: lead.name || "",
      Phone: lead.phone || lead.phoneNumber || "",
      Email: lead.email || "",
      Age: lead.age || "",
      "Year of Birth": lead.year_of_birth || "",
      Income: lead.income || "",
      "Country Code": lead.countryCode || "",
      Campaign: lead.campaign || "",
      Status: lead.status || "new",
      "Submitted At (IST)": lead.submittedAt
        ? convertUTCtoIST(lead.submittedAt.toDate()).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "medium",
          })
        : "",
      "Pushed At (IST)": lead.pushedAt
        ? convertUTCtoIST(lead.pushedAt.toDate()).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "medium",
          })
        : "",
      "Duplicate Marked At (IST)": lead.duplicateMarkedAt
        ? convertUTCtoIST(lead.duplicateMarkedAt.toDate()).toLocaleString(
            "en-IN",
            {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "medium",
            }
          )
        : "",
      "Duplicate Marked By": lead.duplicateMarkedBy || "",
      "IP Address": lead.ipAddress || "",
      Language: lead.language || "",
      Source: lead.source || "",
      Notes: lead.notes || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    // Auto-size columns
    const maxWidth = worksheetData.reduce(
      (w, r) => Math.max(w, r.Name.length),
      10
    );
    worksheet["!cols"] = [{ wch: maxWidth + 2 }];

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

    const filename = `NRI-1501-Leads-${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    saveAs(blob, filename);
  };

  // View lead details
  const handleViewLead = (lead) => {
    setSelectedLead(lead);
    setIsDialogOpen(true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setEndDate("");
    setStartDate("");
    setSortConfig({ key: "submittedAt", direction: "desc" });
  };

  // Get current date in IST for date picker max
  const getTodayIST = () => {
    const now = new Date();
    const istDate = new Date(now.getTime());
    return istDate.toISOString().split("T")[0];
  };

  // Format date for display in IST
  const formatISTDate = (date) => {
    if (!date) return "";
    const istDate = convertUTCtoIST(date);
    return istDate.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  // Format date for table display in IST
  const formatTableDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate();
    const istDate = convertUTCtoIST(date);
    return istDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "pushed":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "new":
        return "bg-green-100 text-green-800 border border-green-200";
      case "duplicate":
        return "bg-orange-100 text-orange-800 border border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">
                  Building Your Application
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Data Fetching</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    NRI 1501 Leads
                  </h1>
                  <p className="text-gray-600 mt-2">
                    Total:{" "}
                    <span className="font-semibold">
                      {filteredLeads.length}
                    </span>{" "}
                    leads | Pushed:{" "}
                    <span className="font-semibold text-blue-600">
                      {leads.filter((l) => l.status === "pushed").length}
                    </span>{" "}
                    | New:{" "}
                    <span className="font-semibold text-green-600">
                      {
                        leads.filter((l) => !l.status || l.status === "new")
                          .length
                      }
                    </span>{" "}
                    | Duplicate:{" "}
                    <span className="font-semibold text-orange-600">
                      {leads.filter((l) => l.status === "duplicate").length}
                    </span>
                    | Junk:{" "}
                    <span className="font-semibold text-pink-600">
                      {leads.filter((l) => l.status === "junk").length}
                    </span>
                    
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset Filters
                  </button>
                  <button
                    onClick={handleDownloadExcel}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download Excel
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, phone, email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="all">All Status</option>
                    <option value="new">New</option>
                    <option value="pushed">Pushed</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="junk">Junk</option>
                  </select>
                </div>

                <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Date Range Filter (IST)
  </label>
  <div className="flex gap-2">
    <div className="relative flex-1">
      <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        max={getTodayIST()}
        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
      />
    </div>
    <div className="relative flex-1">
      <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        max={getTodayIST()}
        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
      />
    </div>
    {(startDate || endDate) && (
      <button
        onClick={() => {
          setStartDate("");
          setEndDate("");
        }}
        className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg"
      >
        Clear
      </button>
    )}
  </div>
</div>


                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortConfig.key}
                    onChange={(e) => handleSort(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  >
                    <option value="submittedAt">Date (Newest)</option>
                    <option value="name">Name</option>
                    <option value="age">Age</option>
                    <option value="income">Income</option>
                  </select>
                </div> */}
              </div>

              {/* Quick Date Filters */}
              {/* <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCalendarDate(getTodayIST())}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    calendarDate === getTodayIST()
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const istYesterday = new Date(yesterday.getTime());
                    setCalendarDate(istYesterday.toISOString().split("T")[0]);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    calendarDate ===
                    (() => {
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);
                      const istYesterday = new Date(yesterday.getTime());
                      return istYesterday.toISOString().split("T")[0];
                    })()
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setCalendarDate("")}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    !calendarDate
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All Dates
                </button>
              </div> */}
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortConfig.key === "name" && (
                            <span>
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("phone")}
                      >
                        <div className="flex items-center gap-1">
                          Phone
                          {sortConfig.key === "phone" && (
                            <span>
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("age")}
                      >
                        <div className="flex items-center gap-1">
                          Age
                          {sortConfig.key === "age" && (
                            <span>
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("income")}
                      >
                        <div className="flex items-center gap-1">
                          Income
                          {sortConfig.key === "income" && (
                            <span>
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pushed At (IST)
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("submittedAt")}
                      >
                        <div className="flex items-center gap-1">
                          Date (IST)
                          {sortConfig.key === "submittedAt" && (
                            <span>
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <AnimatePresence>
                      {currentItems.map((lead) => (
                        <motion.tr
                          key={lead.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {lead.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {lead.id.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium">
                                  {lead.phoneNumber}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {lead.countryCode}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                            >
                              <Mail className="h-4 w-4" />
                              {lead.email}
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{lead.age}</div>
                              <div className="text-sm text-gray-500">
                                ({lead.year_of_birth})
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{lead.income}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {lead.pushedAt ||
                                lead.junkAt ||
                                lead.duplicateMarkedAt
                                  ? formatTableDate(
                                      lead.pushedAt ||
                                        lead.junkAt ||
                                        lead.duplicateMarkedAt
                                    )
                                  : "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {formatTableDate(lead.submittedAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                lead.status
                              )}`}
                            >
                              {lead.status || "new"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                             <button
  onClick={() => {
  const linkToCopy = `https://yourdomain.com/leads/${lead.id}`;
  navigator.clipboard.writeText(linkToCopy)
    .then(() => alert("Link copied!"));
}}

  className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
  title="Copy Link"
>
  <Copy className="h-4 w-4" />
</button>

                              {lead.status === "pushed" ? (
                                // Show Duplicate button for pushed leads
                                <button
                                  onClick={() => handleMarkAsDuplicate(lead.id)}
                                  disabled={
                                    lead.status === "duplicate" ||
                                    markingDuplicateId === lead.id
                                  }
                                  className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                                    lead.status === "duplicate"
                                      ? "bg-orange-100 text-orange-700 cursor-default"
                                      : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                  }`}
                                  title={
                                    lead.status === "duplicate"
                                      ? "Already Marked as Duplicate"
                                      : "Mark as Duplicate"
                                  }
                                >
                                  {markingDuplicateId === lead.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : lead.status === "duplicate" ? (
                                    <AlertCircle className="h-4 w-4" />
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Duplicate
                                    </>
                                  )}
                                </button>
                              ) : (
                                // Show Push button for non-pushed leads
                                <button
                                  onClick={() => handlePushLead(lead.id)}
                                  disabled={
                                    lead.status === "pushed" ||
                                    pushingLeadId === lead.id ||
                                    lead.status === "duplicate"
                                  }
                                  className={`p-2 rounded-lg transition-colors ${
                                    lead.status === "pushed"
                                      ? "bg-green-100 text-green-700 cursor-default"
                                      : lead.status === "duplicate"
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  }`}
                                  title={
                                    lead.status === "pushed"
                                      ? "Already Pushed"
                                      : lead.status === "duplicate"
                                      ? "Cannot push duplicate lead"
                                      : "Push Lead"
                                  }
                                >
                                  {pushingLeadId === lead.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : lead.status === "pushed" ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : lead.status === "duplicate" ? (
                                    "X"
                                  ) : (
                                    "Push"
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>

                {currentItems.length === 0 && (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No leads found
                    </h3>
                    {/* <p className="text-gray-500">
                      {calendarDate
                        ? `No leads submitted on ${formatISTDate(
                            new Date(calendarDate + "T00:00:00Z")
                          )}. Try another date or remove the date filter.`
                        : "Try adjusting your search or filter to find what you're looking for."}
                    </p> */}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-gray-200 px-6 py-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                      Showing{" "}
                      <span className="font-medium">
                        {indexOfFirstItem + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium">
                        {Math.min(indexOfLastItem, filteredLeads.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium">
                        {filteredLeads.length}
                      </span>{" "}
                      results
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>

                      <div className="hidden sm:flex gap-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                  currentPage === pageNum
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-700 hover:bg-gray-100 border border-gray-300"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lead Details Modal */}
          {isDialogOpen && selectedLead && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Lead Details
                      </h2>
                      <p className="text-gray-600 mt-1">
                        Submitted on{" "}
                        {formatISTDate(selectedLead.submittedAt?.toDate())}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsDialogOpen(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Personal Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Name
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.name}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Age
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.age} years
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Year of Birth
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.year_of_birth}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Contact Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Phone
                          </label>
                          <p className="mt-1 text-gray-900 flex items-center gap-2">
                            <Globe className="h-4 w-4 text-gray-400" />
                            {selectedLead.countryCode}{" "}
                            {selectedLead.phone || selectedLead.phoneNumber}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Email
                          </label>
                          <a
                            href={`mailto:${selectedLead.email}`}
                            className="mt-1 text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2"
                          >
                            <Mail className="h-4 w-4" />
                            {selectedLead.email}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Financial Info */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Financial Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Income
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.income}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Campaign
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.campaign || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Status
                          </label>
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                                selectedLead.status
                              )}`}
                            >
                              {selectedLead.status || "new"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Technical Info */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Technical Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Language
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.language || "English"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            IP Address
                          </label>
                          <p className="mt-1 text-gray-900">
                            {selectedLead.ipAddress || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Source
                          </label>
                          <p className="mt-1 text-gray-900 text-sm truncate">
                            {selectedLead.source || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedLead.notes && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Notes
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700">{selectedLead.notes}</p>
                      </div>
                    </div>
                  )}

                  {selectedLead.duplicateMarkedAt && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        Duplicate Information
                      </h3>
                      <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-orange-700">
                          Marked as duplicate on{" "}
                          {formatISTDate(
                            selectedLead.duplicateMarkedAt?.toDate()
                          )}
                          {selectedLead.duplicateMarkedBy &&
                            ` by ${selectedLead.duplicateMarkedBy}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setIsDialogOpen(false)}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Close
                    </button>

                    {selectedLead.status === "pushed" ? (
                      <button
                        onClick={() => {
                          handleMarkAsDuplicate(selectedLead.id);
                          setIsDialogOpen(false);
                        }}
                        disabled={selectedLead.status === "duplicate"}
                        className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          selectedLead.status === "duplicate"
                            ? "bg-orange-100 text-orange-700 cursor-not-allowed"
                            : "bg-yellow-600 hover:bg-yellow-700 text-white"
                        }`}
                      >
                        <Copy className="h-4 w-4" />
                        {selectedLead.status === "duplicate"
                          ? "Already Duplicate"
                          : "Mark as Duplicate"}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handlePushLead(selectedLead.id);
                          setIsDialogOpen(false);
                        }}
                        disabled={
                          selectedLead.status === "pushed" ||
                          selectedLead.status === "duplicate"
                        }
                        className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                          selectedLead.status === "pushed"
                            ? "bg-green-100 text-green-700 cursor-not-allowed"
                            : selectedLead.status === "duplicate"
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        {selectedLead.status === "pushed"
                          ? "Already Pushed"
                          : selectedLead.status === "duplicate"
                          ? "Cannot Push (Duplicate)"
                          : "Push Lead"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
