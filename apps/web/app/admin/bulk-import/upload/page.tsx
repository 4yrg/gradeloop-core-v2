"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { ImportProgressStepper } from "@/features/bulk-import/components/import-progress-stepper";

export default function BulkImportUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      alert("Please upload a valid CSV or Excel file");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);

    try {
      // TODO: Implement actual upload API call
      // For now, simulate upload and navigate to mapping
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock import ID - in production this would come from API response
      const mockImportId = "imp_" + Date.now();

      router.push(`/admin/bulk-import/${mockImportId}/map`);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Bulk User Import
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Import students, teachers, and staff data from your existing systems.
        </p>
      </div>

      {/* Progress Stepper */}
      <ImportProgressStepper currentStep="upload" />

      {/* Upload Area */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-gray-300 dark:border-gray-600 hover:border-primary/50 dark:hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {!file ? (
            <>
              <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                Upload your file
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Drag and drop your CSV or Excel file here, or click to browse
              </p>
              <div className="mt-6">
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Select File
                    </span>
                  </Button>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInput}
                />
              </div>
              <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                Supported formats: CSV, XLSX, XLS (Max 10MB)
              </p>
            </>
          ) : (
            <>
              <FileText className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {file.name}
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(file.size)}
              </p>
              <div className="mt-6 flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setFile(null)}
                  disabled={isUploading}
                >
                  Remove
                </Button>
                <Button onClick={handleUpload} disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Continue"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">
              Before you upload
            </h3>
            <div className="mt-2 text-sm text-blue-800 dark:text-blue-400">
              <ul className="list-disc list-inside space-y-1">
                <li>Ensure your file contains headers in the first row</li>
                <li>Required fields: First Name, Last Name, Email Address</li>
                <li>Email addresses must be unique for each user</li>
                <li>Date format should be YYYY-MM-DD</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => router.push("/admin/users")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
