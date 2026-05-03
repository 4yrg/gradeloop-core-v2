"use client";

import * as React from "react";
import { UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectNative } from "@/components/ui/select-native";
import { usersApi, handleApiError } from "@/lib/api/users";
import { toast } from "@/lib/hooks/use-toast";
import type {
  UpdateUserRequest,
  UpdateUserResponse,
} from "@/types/admin.types";
import type { UserListItem } from "@/types/auth.types";
import { USER_TYPES_ARRAY } from "@/types/auth.types";

interface Props {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: UserListItem) => void;
}

interface FormValues {
  user_type: string;
  is_active: boolean;
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess }: Props) {
  const [values, setValues] = React.useState<FormValues>({
    is_active: true,
    user_type: "student",
  });
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user && open) {
      setValues({
        is_active: user.is_active,
        user_type: user.user_type || "student",
      });
    }
  }, [user, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const payload: UpdateUserRequest = {
        is_active: values.is_active,
        user_type: values.user_type,
      };

      const updated: UpdateUserResponse = await usersApi.update(
        user.id,
        payload,
      );

      const finalUser: UserListItem = {
        ...user,
        id: updated.id,
        email: updated.email,
        user_type: updated.user_type || values.user_type,
        is_active: updated.is_active,
      };

      toast.success(
        "User updated",
        `${user.full_name || "No Name"} has been updated.`,
      );
      onSuccess(finalUser);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update user", handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <UserCog className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Editing <strong>{user.full_name || "No Name"}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Full Name</span>
              <span className="font-medium">{user.full_name || "No Name"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium truncate max-w-[200px]">
                {user.email}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">User Type</span>
              <span className="font-medium capitalize">
                {user.user_type}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eu-user-type">User Type</Label>
            <SelectNative
              id="eu-user-type"
              value={values.user_type}
              onChange={(e) =>
                setValues((v) => ({ ...v, user_type: e.target.value }))
              }
              disabled={submitting}
            >
              {USER_TYPES_ARRAY.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.replace('_', ' ')}
                </option>
              ))}
            </SelectNative>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="eu-active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive users cannot log in.
              </p>
            </div>
            <Switch
              id="eu-active"
              checked={values.is_active}
              onCheckedChange={(checked) =>
                setValues((v) => ({ ...v, is_active: checked }))
              }
              disabled={submitting}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}