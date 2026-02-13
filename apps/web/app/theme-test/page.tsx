"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Search,
  Bell,
  Settings,
  Heart,
  Star,
  Download,
  Upload,
  Check,
  X,
  AlertCircle,
  Info,
} from "lucide-react";

const testFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  subscribe: z.boolean(),
  category: z.string(),
});

type TestFormValues = z.infer<typeof testFormSchema>;

export default function ThemeTestPage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      message: "",
      subscribe: false,
      category: "",
    },
  });

  const onSubmit = async (data: TestFormValues) => {
    setIsLoading(true);
    console.log("Form data:", data);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">
              T
            </div>
            <span className="text-xl font-bold">Theme Test</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Test all components in light & dark modes
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        <div className="space-y-12">
          {/* Typography Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Typography</h2>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-foreground">
                Heading 1 - Main Title
              </h1>
              <h2 className="text-3xl font-bold text-foreground">
                Heading 2 - Section Title
              </h2>
              <h3 className="text-2xl font-semibold text-foreground">
                Heading 3 - Subsection
              </h3>
              <h4 className="text-xl font-semibold text-foreground">
                Heading 4 - Minor Heading
              </h4>
              <p className="text-foreground">
                Regular paragraph text with normal weight and standard line
                height. This should be easily readable in both light and dark
                themes.
              </p>
              <p className="text-muted-foreground">
                Muted text for secondary information and descriptions.
              </p>
              <p className="text-sm text-muted-foreground">
                Small text for footnotes and additional details.
              </p>
            </div>
          </section>

          {/* Colors & Theme Variables */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Color Palette</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-primary border-2 border-border"></div>
                <p className="text-sm text-center">Primary</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-secondary border-2 border-border"></div>
                <p className="text-sm text-center">Secondary</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-accent border-2 border-border"></div>
                <p className="text-sm text-center">Accent</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-muted border-2 border-border"></div>
                <p className="text-sm text-center">Muted</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-destructive border-2 border-border"></div>
                <p className="text-sm text-center">Destructive</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-full rounded-lg bg-card border-2 border-border"></div>
                <p className="text-sm text-center">Card</p>
              </div>
            </div>
          </section>

          {/* Buttons Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Buttons</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Button Variants</h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="default">Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Button Sizes</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Button States</h3>
                <div className="flex flex-wrap gap-4">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button className="ai-glow">AI Glow</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Icon Buttons</h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline" size="icon">
                    <Sun className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Moon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Form Elements Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Form Elements</h2>
            <Card className="p-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                              <Input
                                placeholder="Enter your full name"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                              <Input
                                type="email"
                                placeholder="Enter your email"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="pl-10 pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="">Select a category</option>
                            <option value="general">General</option>
                            <option value="support">Support</option>
                            <option value="feedback">Feedback</option>
                            <option value="bug">Bug Report</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <textarea
                            placeholder="Enter your message here..."
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subscribe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border border-input text-primary focus:ring-primary accent-primary"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Subscribe to newsletter
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Receive updates about new features and announcements.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Submitting..." : "Submit Form"}
                    </Button>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>
          </section>

          {/* Cards Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Cards</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Feature Card</h3>
                    <p className="text-sm text-muted-foreground">Basic card</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  This is a simple card component with consistent styling across
                  themes.
                </p>
              </Card>

              <Card className="p-6 border-primary/20 bg-primary/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Highlighted Card</h3>
                    <p className="text-sm text-muted-foreground">
                      With accent styling
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  This card has accent styling to draw attention to important
                  content.
                </p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Alert Card</h3>
                    <p className="text-sm text-muted-foreground">
                      Warning or error
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Cards can also be used to display alerts and important
                  messages.
                </p>
              </Card>
            </div>
          </section>

          {/* Badges Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Badges</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge className="bg-green-500 text-white">Success</Badge>
                <Badge className="bg-yellow-500 text-black">Warning</Badge>
                <Badge className="bg-red-500 text-white">Error</Badge>
                <Badge className="bg-blue-500 text-white">Info</Badge>
              </div>
            </div>
          </section>

          {/* Interactive Elements */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Interactive Elements</h2>
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Search Input</h3>
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search for anything..."
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Range Input</h3>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="w-full max-w-md h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Radio Buttons</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="theme-test"
                        value="option1"
                        className="accent-primary"
                      />
                      <span>Option 1</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="theme-test"
                        value="option2"
                        className="accent-primary"
                      />
                      <span>Option 2</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="theme-test"
                        value="option3"
                        className="accent-primary"
                      />
                      <span>Option 3</span>
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Table Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Table</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border hover:bg-muted/50">
                      <td className="p-4 align-middle">John Doe</td>
                      <td className="p-4 align-middle">john@example.com</td>
                      <td className="p-4 align-middle">
                        <Badge className="bg-green-500 text-white">Active</Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                    <tr className="border-b border-border hover:bg-muted/50">
                      <td className="p-4 align-middle">Jane Smith</td>
                      <td className="p-4 align-middle">jane@example.com</td>
                      <td className="p-4 align-middle">
                        <Badge variant="secondary">Inactive</Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="p-4 align-middle">Bob Johnson</td>
                      <td className="p-4 align-middle">bob@example.com</td>
                      <td className="p-4 align-middle">
                        <Badge className="bg-yellow-500 text-black">
                          Pending
                        </Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Loading States */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Loading States</h2>
            <Card className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-muted rounded-full animate-pulse"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded animate-pulse w-1/3"></div>
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Icons Grid */}
          <section>
            <h2 className="text-3xl font-bold mb-6">Icons</h2>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-4">
              {[
                Sun,
                Moon,
                Monitor,
                Eye,
                EyeOff,
                Mail,
                Lock,
                User,
                Search,
                Bell,
                Settings,
                Heart,
                Star,
                Download,
                Upload,
                Check,
                X,
                AlertCircle,
                Info,
              ].map((Icon, index) => (
                <div
                  key={index}
                  className="h-12 w-12 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container mx-auto px-4 md:px-6 py-8">
          <div className="text-center text-muted-foreground">
            <p>Theme Test Page - All components shown in current theme</p>
            <p className="text-sm mt-2">
              Switch between light and dark modes using the floating theme
              toggle
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
