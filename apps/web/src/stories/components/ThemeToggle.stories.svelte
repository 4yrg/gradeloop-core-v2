<script lang="ts" context="module">
	import type { Meta, StoryObj } from '@storybook/svelte';
	import ThemeToggle from '$lib/components/theme/ThemeToggle.svelte';
	import { Sun, Moon, Monitor } from 'lucide-svelte';

	const meta: Meta<ThemeToggle> = {
		title: 'Components/Theme/ThemeToggle',
		component: ThemeToggle,
		parameters: {
			layout: 'centered',
			docs: {
				description: {
					component: 'A theme toggle component that allows users to switch between light, dark, and system themes with smooth transitions and accessibility support.'
				}
			}
		},
		argTypes: {
			size: {
				control: 'select',
				options: ['sm', 'md', 'lg'],
				description: 'Size of the toggle button'
			},
			variant: {
				control: 'select',
				options: ['button', 'dropdown'],
				description: 'Display style of the theme toggle'
			},
			showLabel: {
				control: 'boolean',
				description: 'Whether to show text labels alongside icons'
			},
			class: {
				control: 'text',
				description: 'Additional CSS classes'
			}
		},
		tags: ['autodocs']
	};

	export default meta;
	type Story = StoryObj<typeof meta>;
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
</script>

<!-- Default Theme Toggle -->
<Story name="Default" args={{
	size: 'md',
	variant: 'button',
	showLabel: false
}}>
</Story>

<!-- All Sizes -->
<Story name="Sizes" parameters={{ layout: 'padded' }}>
	<div class="space-y-4">
		<h3 class="text-lg font-semibold mb-4">Theme Toggle Sizes</h3>
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<ThemeToggle size="sm" variant="button" />
				<span class="text-sm text-muted-foreground">Small</span>
			</div>
			<div class="flex items-center gap-2">
				<ThemeToggle size="md" variant="button" />
				<span class="text-sm text-muted-foreground">Medium</span>
			</div>
			<div class="flex items-center gap-2">
				<ThemeToggle size="lg" variant="button" />
				<span class="text-sm text-muted-foreground">Large</span>
			</div>
		</div>
	</div>
</Story>

<!-- With Labels -->
<Story name="With Labels" parameters={{ layout: 'padded' }}>
	<div class="space-y-4">
		<h3 class="text-lg font-semibold mb-4">Theme Toggle with Labels</h3>
		<div class="flex flex-wrap gap-4">
			<ThemeToggle size="sm" variant="button" showLabel={true} />
			<ThemeToggle size="md" variant="button" showLabel={true} />
			<ThemeToggle size="lg" variant="button" showLabel={true} />
		</div>
	</div>
</Story>

<!-- Dropdown Variant -->
<Story name="Dropdown Variant" parameters={{ layout: 'padded' }}>
	<div class="space-y-6">
		<div>
			<h3 class="text-lg font-semibold mb-4">Dropdown Style</h3>
			<p class="text-sm text-muted-foreground mb-4">
				Click the dropdown to see all theme options: Light, Dark, and System
			</p>
			<div class="flex flex-wrap gap-4">
				<ThemeToggle size="sm" variant="dropdown" />
				<ThemeToggle size="md" variant="dropdown" />
				<ThemeToggle size="lg" variant="dropdown" />
			</div>
		</div>

		<div>
			<h3 class="text-lg font-semibold mb-4">Dropdown with Labels</h3>
			<div class="flex flex-wrap gap-4">
				<ThemeToggle size="sm" variant="dropdown" showLabel={true} />
				<ThemeToggle size="md" variant="dropdown" showLabel={true} />
				<ThemeToggle size="lg" variant="dropdown" showLabel={true} />
			</div>
		</div>
	</div>
</Story>

<!-- Button vs Dropdown Comparison -->
<Story name="Variants Comparison" parameters={{ layout: 'padded' }}>
	<div class="space-y-6">
		<h3 class="text-lg font-semibold mb-4">Button vs Dropdown Variants</h3>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div class="space-y-4">
				<h4 class="font-medium">Button Variant</h4>
				<p class="text-sm text-muted-foreground mb-4">
					Simple toggle between light and dark modes. System theme follows the button state based on current resolved theme.
				</p>
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<ThemeToggle size="md" variant="button" />
						<span class="text-sm">Icon only</span>
					</div>
					<div class="flex items-center gap-3">
						<ThemeToggle size="md" variant="button" showLabel={true} />
						<span class="text-sm">With label</span>
					</div>
				</div>
			</div>

			<div class="space-y-4">
				<h4 class="font-medium">Dropdown Variant</h4>
				<p class="text-sm text-muted-foreground mb-4">
					Full control over theme selection with explicit Light, Dark, and System options.
				</p>
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<ThemeToggle size="md" variant="dropdown" />
						<span class="text-sm">Icon only</span>
					</div>
					<div class="flex items-center gap-3">
						<ThemeToggle size="md" variant="dropdown" showLabel={true} />
						<span class="text-sm">With label</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</Story>

<!-- Integration Examples -->
<Story name="Integration Examples" parameters={{ layout: 'padded' }}>
	<div class="space-y-8">
		<h3 class="text-lg font-semibold mb-4">Common Integration Patterns</h3>

		<!-- Header Bar -->
		<div>
			<h4 class="font-medium mb-3">Header/Navigation Bar</h4>
			<div class="bg-card border border-border rounded-lg p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="font-semibold">GradeLoop</div>
						<nav class="hidden md:flex gap-4 text-sm">
							<a href="#" class="text-muted-foreground hover:text-foreground">Dashboard</a>
							<a href="#" class="text-muted-foreground hover:text-foreground">Assignments</a>
							<a href="#" class="text-muted-foreground hover:text-foreground">Students</a>
						</nav>
					</div>
					<div class="flex items-center gap-2">
						<ThemeToggle size="md" variant="button" />
						<div class="w-8 h-8 bg-muted rounded-full"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Settings Panel -->
		<div>
			<h4 class="font-medium mb-3">Settings Panel</h4>
			<div class="bg-card border border-border rounded-lg p-6 max-w-md">
				<h5 class="font-medium mb-4">Appearance</h5>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-sm">Theme</div>
							<div class="text-xs text-muted-foreground">Choose your preferred theme</div>
						</div>
						<ThemeToggle size="md" variant="dropdown" showLabel={true} />
					</div>
					<div class="flex items-center justify-between">
						<div>
							<div class="font-medium text-sm">High Contrast</div>
							<div class="text-xs text-muted-foreground">Increase contrast for accessibility</div>
						</div>
						<input type="checkbox" class="rounded" />
					</div>
				</div>
			</div>
		</div>

		<!-- Toolbar -->
		<div>
			<h4 class="font-medium mb-3">Toolbar/Action Bar</h4>
			<div class="bg-card border border-border rounded-lg p-3">
				<div class="flex items-center gap-2">
					<button class="p-2 hover:bg-muted rounded-md">
						<Sun size={16} />
					</button>
					<button class="p-2 hover:bg-muted rounded-md">
						<Monitor size={16} />
					</button>
					<div class="w-px h-6 bg-border mx-1"></div>
					<ThemeToggle size="sm" variant="button" />
					<div class="w-px h-6 bg-border mx-1"></div>
					<button class="p-2 hover:bg-muted rounded-md">
						<Moon size={16} />
					</button>
				</div>
			</div>
		</div>

		<!-- User Menu -->
		<div>
			<h4 class="font-medium mb-3">User Dropdown Menu</h4>
			<div class="bg-popover border border-border rounded-lg shadow-lg p-2 max-w-56">
				<div class="px-2 py-1.5 text-sm font-medium">John Doe</div>
				<div class="px-2 py-1.5 text-xs text-muted-foreground mb-1">john@example.com</div>
				<div class="border-t border-border my-1"></div>
				<button class="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded">
					Profile Settings
				</button>
				<div class="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-accent rounded">
					<span>Theme</span>
					<ThemeToggle size="sm" variant="dropdown" />
				</div>
				<button class="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded">
					Help & Support
				</button>
				<div class="border-t border-border my-1"></div>
				<button class="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded text-red-600">
					Sign Out
				</button>
			</div>
		</div>
	</div>
</Story>

<!-- Accessibility Demo -->
<Story name="Accessibility" parameters={{ layout: 'padded' }}>
	<div class="space-y-6">
		<h3 class="text-lg font-semibold mb-4">Accessibility Features</h3>

		<div class="space-y-6">
			<div>
				<h4 class="font-medium mb-3">Keyboard Navigation</h4>
				<p class="text-sm text-muted-foreground mb-3">
					Tab to focus, Enter/Space to activate, Escape to close dropdown
				</p>
				<div class="flex gap-4">
					<ThemeToggle size="md" variant="button" showLabel={true} />
					<ThemeToggle size="md" variant="dropdown" showLabel={true} />
				</div>
			</div>

			<div>
				<h4 class="font-medium mb-3">Screen Reader Support</h4>
				<div class="space-y-2 text-sm text-muted-foreground">
					<p>✅ Proper ARIA labels and descriptions</p>
					<p>✅ Current theme state announced</p>
					<p>✅ Focus management in dropdown</p>
					<p>✅ Semantic button and menu roles</p>
				</div>
				<div class="mt-4">
					<ThemeToggle size="md" variant="dropdown" showLabel={true} />
				</div>
			</div>

			<div>
				<h4 class="font-medium mb-3">Visual Accessibility</h4>
				<div class="space-y-2 text-sm text-muted-foreground mb-4">
					<p>✅ High contrast mode support</p>
					<p>✅ Reduced motion respect</p>
					<p>✅ Clear focus indicators</p>
					<p>✅ Sufficient color contrast</p>
				</div>
				<div class="p-4 border border-dashed border-muted-foreground/30 rounded-lg">
					<p class="text-sm text-muted-foreground mb-3">
						Enable high contrast mode or reduce motion in your OS settings to test
					</p>
					<div class="flex gap-4">
						<ThemeToggle size="sm" variant="button" />
						<ThemeToggle size="md" variant="button" />
						<ThemeToggle size="lg" variant="button" />
					</div>
				</div>
			</div>
		</div>
	</div>
</Story>

<!-- Theme Preview -->
<Story name="Theme Preview" parameters={{ layout: 'fullscreen' }}>
	<div class="min-h-screen p-6 space-y-6">
		<div class="flex items-center justify-between mb-8">
			<h3 class="text-2xl font-bold">Theme Preview</h3>
			<ThemeToggle size="lg" variant="dropdown" showLabel={true} />
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<!-- Sample Cards to Show Theme -->
			<div class="bg-card border border-border rounded-lg p-6">
				<h4 class="font-semibold mb-2">Assignment Review</h4>
				<p class="text-muted-foreground text-sm mb-4">
					AI-powered code analysis and feedback
				</p>
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span>Progress</span>
						<span>75%</span>
					</div>
					<div class="w-full bg-muted rounded-full h-2">
						<div class="bg-primary h-2 rounded-full" style="width: 75%"></div>
					</div>
				</div>
			</div>

			<div class="bg-card border border-border rounded-lg p-6">
				<h4 class="font-semibold mb-2">Code Quality</h4>
				<p class="text-muted-foreground text-sm mb-4">
					Static analysis results
				</p>
				<div class="space-y-3">
					<div class="flex items-center gap-2 text-sm">
						<div class="w-2 h-2 bg-success rounded-full"></div>
						<span>No critical issues</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<div class="w-2 h-2 bg-warning rounded-full"></div>
						<span>3 warnings</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<div class="w-2 h-2 bg-info rounded-full"></div>
						<span>2 suggestions</span>
					</div>
				</div>
			</div>

			<div class="bg-ai-bg border border-ai-border rounded-lg p-6">
				<h4 class="font-semibold mb-2 text-ai-text">AI Insights</h4>
				<p class="text-ai-text/70 text-sm mb-4">
					Smart recommendations for your code
				</p>
				<button class="w-full px-3 py-2 bg-ai-highlight text-white rounded-md text-sm hover:bg-ai-hover transition-colors">
					View AI Suggestions
				</button>
			</div>
		</div>

		<div class="bg-code-bg text-code-text p-6 rounded-lg font-mono text-sm">
			<div class="text-code-text/70 mb-2">// Sample code preview</div>
			<div>function calculateGrade(score, total) {</div>
			<div className="pl-4">return Math.round((score / total) * 100);</div>
			<div>}</div>
		</div>

		<div class="flex justify-center pt-8">
			<div class="text-center">
				<p class="text-muted-foreground mb-4">
					Toggle between themes to see the design system in action
				</p>
				<ThemeToggle size="lg" variant="dropdown" showLabel={true} />
			</div>
		</div>
	</div>
</Story>
