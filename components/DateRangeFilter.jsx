"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";

/**
 * Reusable DateRangeFilter component
 * @param {Object} props
 * @param {string} props.startDate - Start date in YYYY-MM-DD format
 * @param {string} props.endDate - End date in YYYY-MM-DD format
 * @param {function} props.onApply - Callback when filter is applied (startDate, endDate) => void
 * @param {function} props.onClear - Callback when filter is cleared () => void
 * @param {string} props.className - Additional CSS classes
 */
export function DateRangeFilter({ startDate, endDate, onApply, onClear, className = "" }) {
    const [localStart, setLocalStart] = useState(startDate || "");
    const [localEnd, setLocalEnd] = useState(endDate || "");

    const handleApply = () => {
        if (onApply) {
            onApply(localStart, localEnd);
        }
    };

    const handleClear = () => {
        setLocalStart("");
        setLocalEnd("");
        if (onClear) {
            onClear();
        }
    };

    const hasFilter = localStart || localEnd;

    return (
        <div className={`flex items-center gap-2 flex-wrap ${className}`}>
            <div className="flex items-center gap-1">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">From:</span>
                <input
                    type="date"
                    value={localStart}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
            <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">To:</span>
                <input
                    type="date"
                    value={localEnd}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
            <Button variant="default" size="sm" onClick={handleApply}>
                Apply
            </Button>
            {hasFilter && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                    <X className="size-4 mr-1" />
                    Clear
                </Button>
            )}
        </div>
    );
}
