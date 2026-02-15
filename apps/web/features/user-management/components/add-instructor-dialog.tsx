"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, User, BadgeCheck, ShieldCheck, GraduationCap, Fingerprint, UserPlus } from "lucide-react";
import { instructorSchema, type InstructorUser } from "@/schemas/user-creation.schema";

interface AddInstructorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InstructorUser) => void | Promise<void>;
}

export function AddInstructorDialog({ open, onOpenChange, onSubmit }: AddInstructorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);

  const form = useForm<InstructorUser>({
    resolver: zodResolver(instructorSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "instructor",
      isActive: true,
      aiAssistedGrading: false,
      assignedFaculty: [],
      primarySpecialization: "",
      educationLevel: "",
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = form;
  const isActive = watch("isActive");
  const aiAssistedGrading = watch("aiAssistedGrading");

  const handleFacultyToggle = (faculty: string) => {
    const updated = selectedFaculties.includes(faculty)
      ? selectedFaculties.filter((f) => f !== faculty)
      : [...selectedFaculties, faculty];
    setSelectedFaculties(updated);
    setValue("assignedFaculty", updated);
  };

  const handleFormSubmit = async (data: InstructorUser) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      reset();
      setSelectedFaculties([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create instructor:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const faculties = [
    "Faculty of Computer Science",
    "Faculty of Engineering",
    "Faculty of Natural Sciences",
    "Faculty of Arts & Humanities",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Add New User</DialogTitle>
            <Badge variant="outline" className="text-xs">Instructor View</Badge>
          </div>
          <DialogDescription>
            Configure professional profile and academic expertise for the new instructor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
          {/* Personal Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <User className="h-4 w-4" />
              Personal Information
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="e.g. Michael"
                  {...register("firstName")}
                  className={errors.firstName ? "border-red-500" : ""}
                />
                {errors.firstName && (
                  <p className="text-xs text-red-500">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder="e.g. Scott"
                  {...register("lastName")}
                  className={errors.lastName ? "border-red-500" : ""}
                />
                {errors.lastName && (
                  <p className="text-xs text-red-500">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="m.scott@gradeloop.edu"
                    className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Professional Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <BadgeCheck className="h-4 w-4" />
              Professional Details
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm font-semibold text-muted-foreground">
                    EMP-
                  </span>
                  <Input
                    id="employeeId"
                    placeholder="10245"
                    className="rounded-l-none"
                    {...register("employeeId")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select defaultValue="academic_affairs" onValueChange={(value) => setValue("department", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic_affairs">Academic Affairs</SelectItem>
                    <SelectItem value="information_technology">Information Technology</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="assignedFaculty">
                    Assigned Faculty <span className="text-red-500">*</span>
                  </Label>
                  <Badge variant="outline" className="text-[9px]">New</Badge>
                </div>
                <div className="space-y-2">
                  {faculties.map((faculty) => (
                    <div key={faculty} className="flex items-center space-x-2">
                      <Checkbox
                        id={faculty}
                        checked={selectedFaculties.includes(faculty)}
                        onCheckedChange={() => handleFacultyToggle(faculty)}
                      />
                      <label htmlFor={faculty} className="text-sm cursor-pointer">
                        {faculty}
                      </label>
                    </div>
                  ))}
                </div>
                {errors.assignedFaculty && (
                  <p className="text-xs text-red-500">{errors.assignedFaculty.message}</p>
                )}
              </div>

              <div className="space-y-2 bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="primarySpecialization">
                    Primary Specialization <span className="text-red-500">*</span>
                  </Label>
                  <Badge variant="outline" className="text-[9px]">New</Badge>
                </div>
                <Input
                  id="primarySpecialization"
                  placeholder="e.g. Quantum Computing"
                  {...register("primarySpecialization")}
                  className={errors.primarySpecialization ? "border-red-500" : ""}
                />
                {errors.primarySpecialization && (
                  <p className="text-xs text-red-500">{errors.primarySpecialization.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Select defaultValue="assistant_professor" onValueChange={(value) => setValue("designation", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assistant_professor">Assistant Professor</SelectItem>
                    <SelectItem value="lead_instructor">Lead Instructor</SelectItem>
                    <SelectItem value="senior_administrator">Senior Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joiningDate">Date of Joining</Label>
                <Input id="joiningDate" type="date" {...register("joiningDate")} />
              </div>
            </div>
          </div>

          {/* Academic Expertise */}
          <div className="space-y-4 bg-primary/5 p-6 rounded-lg border border-primary/20 relative">
            <div className="absolute top-0 right-0">
              <Badge className="rounded-tl-none rounded-br-none text-[9px]">
                Instructor Profile Extension
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mt-6">
              <GraduationCap className="h-4 w-4" />
              Academic Expertise
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="educationLevel">
                  Education Level <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => setValue("educationLevel", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Highest Degree" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phd">PhD / Doctorate</SelectItem>
                    <SelectItem value="masters">Masters Degree</SelectItem>
                    <SelectItem value="postgrad_diploma">Post Graduate Diploma</SelectItem>
                    <SelectItem value="bachelors">Bachelors Degree</SelectItem>
                  </SelectContent>
                </Select>
                {errors.educationLevel && (
                  <p className="text-xs text-red-500">{errors.educationLevel.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="researcherId" className="flex items-center gap-1">
                  Researcher ID
                  <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="researcherId"
                    placeholder="ORCID or Scopus ID"
                    className="pl-10"
                    {...register("researcherId")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Role & Permissions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              Role & Permissions
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">
                  User Role <span className="text-red-500">*</span>
                </Label>
                <Select defaultValue="instructor" onValueChange={(value: any) => setValue("role", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="department_head">Department Head</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted border">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Account Status</span>
                    <span className="text-xs text-muted-foreground">Grant immediate system access</span>
                  </div>
                  <Switch checked={isActive} onCheckedChange={(checked) => setValue("isActive", checked)} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">AI-Assisted Grading</span>
                      <Badge variant="outline" className="text-[9px]">New</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Enable automated evaluation drafts</span>
                  </div>
                  <Switch
                    checked={aiAssistedGrading}
                    onCheckedChange={(checked) => setValue("aiAssistedGrading", checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <UserPlus className="mr-2 h-4 w-4" />
              {isSubmitting ? "Creating..." : "Create Instructor Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
