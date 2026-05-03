'use client';

import * as React from 'react';
import { UserPlus, User, Mail, Shield, Badge } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usersApi, handleApiError } from '@/lib/api/users';
import { toast } from '@/lib/hooks/use-toast';
import type { CreateUserRequest, CreateUserResponse, FormErrors } from '@/types/admin.types';
import { USER_TYPES } from '@/types/auth.types';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EMPTY: CreateUserRequest = {
  full_name: '',
  email: '',
  user_type: 'student',
};

const USER_TYPE_OPTIONS = [
  { value: 'student', label: 'Student', icon: User },
  { value: 'instructor', label: 'Instructor', icon: Shield },
  { value: 'admin', label: 'Administrator', icon: Shield },
];

function validate(values: CreateUserRequest): FormErrors {
  const errors: FormErrors = {};
  if (!values.full_name.trim()) errors.full_name = 'Full Name is required';
  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(values.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (!values.user_type) errors.user_type = 'User Type is required';
  if (values.user_type === 'student' && !values.student_id?.trim())
    errors.student_id = 'Student ID is required for student type';
  if (values.user_type === 'instructor' && !values.designation?.trim())
    errors.designation = 'Designation is required for instructor type';
  return errors;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: Props) {
  const [values, setValues] = React.useState<CreateUserRequest>(EMPTY);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(EMPTY);
      setErrors({});
    }
  }, [open]);

  function set(field: keyof CreateUserRequest, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const user: CreateUserResponse = await usersApi.create(values);
      toast.success('User created', `${user.full_name} has been added. An activation email has been sent.`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create user', handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Fill in the details to register a new system member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cu-fullname">
                FULL NAME <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cu-fullname"
                  placeholder="John Doe"
                  value={values.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  autoComplete="off"
                  disabled={submitting}
                  className="pl-10"
                />
              </div>
              {errors.full_name && (
                <p className="text-xs text-red-500">{errors.full_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cu-email">
                EMAIL ADDRESS <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cu-email"
                  type="email"
                  placeholder="john@gradeloop.com"
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                  autoComplete="off"
                  disabled={submitting}
                  className="pl-10"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              USER TYPE <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {USER_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = values.user_type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set('user_type', option.value)}
                    disabled={submitting}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.user_type && (
              <p className="text-xs text-red-500">{errors.user_type}</p>
            )}
          </div>

          {values.user_type === 'student' && (
            <div className="space-y-2">
              <Label htmlFor="cu-studentid">
                STUDENT ID <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Badge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cu-studentid"
                  placeholder="GL-0000"
                  value={values.student_id ?? ''}
                  onChange={(e) => set('student_id', e.target.value)}
                  autoComplete="off"
                  disabled={submitting}
                  className="pl-10"
                />
              </div>
              {errors.student_id && (
                <p className="text-xs text-red-500">{errors.student_id}</p>
              )}
            </div>
          )}

          {values.user_type === 'instructor' && (
            <div className="space-y-2">
              <Label htmlFor="cu-designation">
                DESIGNATION <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Badge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cu-designation"
                  placeholder="Lecturer"
                  value={values.designation ?? ''}
                  onChange={(e) => set('designation', e.target.value)}
                  autoComplete="off"
                  disabled={submitting}
                  className="pl-10"
                />
              </div>
              {errors.designation && (
                <p className="text-xs text-red-500">{errors.designation}</p>
              )}
            </div>
          )}

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
              {submitting ? 'Creating…' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}