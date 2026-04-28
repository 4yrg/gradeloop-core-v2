"use client";

import * as React from "react";
import { Building2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tenantsApi } from "@/lib/api/tenants";
import { handleApiError } from "@/lib/api/axios";
import type { Tenant } from "@/types/tenant.types";

interface DeleteTenantDialogProps {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (deletedId: string) => void;
}

export function DeleteTenantDialog({
  tenant,
  open,
  onOpenChange,
  onSuccess,
}: DeleteTenantDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    if (!tenant) return;
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await tenantsApi.delete(tenant.id);
      onSuccess(tenant.id);
      onOpenChange(false);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Tenant
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this tenant? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {tenant && (
          <div className="rounded-md bg-muted p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{tenant.name}</p>
                <p className="text-sm text-muted-foreground">
                  {tenant.domain || tenant.slug}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}