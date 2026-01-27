"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ImageUpload({ value, onChange, bucket = "images" }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleUpload = async (e) => {
        try {
            setError(null);
            const file = e.target.files?.[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith("image/")) {
                setError("Please upload an image file.");
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError("Image size should be less than 5MB.");
                return;
            }

            setUploading(true);

            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            onChange(publicUrl);
        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload image. Make sure the 'images' bucket exists and has correct permissions.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const removeImage = () => {
        onChange("");
    };

    return (
        <div className="space-y-4">
            {value ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
                    <img
                        src={value}
                        alt="Uploaded image"
                        className="w-full h-full object-cover"
                    />
                    <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="size-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Uploading...</p>
                        </>
                    ) : (
                        <>
                            <div className="p-3 bg-muted rounded-full">
                                <ImageIcon className="size-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">
                                Click to upload image
                            </p>
                            <p className="text-xs text-muted-foreground">
                                PNG, JPG, WEBP up to 5MB
                            </p>
                        </>
                    )}
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept="image/*"
                className="hidden"
                disabled={uploading}
            />

            {error && (
                <Alert variant="destructive">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
