<script lang="ts" context="module">
	import type { Meta, StoryObj } from '@storybook/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Search, Download, Plus, Trash2, Sparkles } from 'lucide-svelte';

	const meta: Meta<Button> = {
		title: 'Components/UI/Button',
		component: Button,
		parameters: {
			layout: 'centered',
			docs: {
				description: {
					component: 'A versatile button component with multiple variants, sizes, and AI-enhanced features for the GradeLoop LMS.'
				}
			}
		},
		argTypes: {
			variant: {
				control: 'select',
				options: ['primary', 'secondary', 'ghost', 'destructive', 'ai-action', 'outline'],
				description: 'Visual style variant of the button'
			},
			size: {
				control: 'select',
				options: ['sm', 'md', 'lg', 'xl', 'icon'],
				description: 'Size of the button'
			},
			disabled: {
				control: 'boolean',
				description: 'Whether the button is disabled'
			},
			loading: {
				control: 'boolean',
				description: 'Whether the button is in loading state'
			},
			fullWidth: {
				control: 'boolean',
				description: 'Whether the button takes full width'
			},
			type: {
				control: 'select',
				options: ['button', 'submit', 'reset'],
				description: 'HTML button type'
			}
		},
		tags: ['autodocs']
	};

	export default meta;
	type Story = StoryObj<typeof meta>;
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';

	let clickCount = 0;
	function handleClick() {
		clickCount++;
		console.log(`Button clicked ${clickCount} times`);
	}
</script>

<!-- Default Button -->
<Story name="Default" args={{ onclick: handleClick }}>
	{#snippet children()}
		Default Button
	{/snippet}
</Story>

<!-- All Variants -->
<Story name="Variants" parameters={{ layout: 'padded' }}>
	<div class="space-y-4">
		<h3 class="text-lg font-semibold mb-4">Button Variants</h3>
		<div class="flex flex-wrap gap-4">
			<Button variant="primary" onclick={handleClick}>
				{#snippet children()}Primary{/snippet}
			</Button>
			<Button variant="secondary" onclick={handleClick}>
				{#snippet children()}Secondary{/snippet}
			</Button>
			<Button variant="ghost" onclick={handleClick}>
				{#snippet children()}Ghost{/snippet}
			</Button>
			<Button variant="destructive" onclick={handleClick}>
				{#snippet children()}Destructive{/snippet}
			</Button>
			<Button variant="ai-action" onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					AI Action
				{/snippet}
			</Button>
			<Button variant="outline" onclick={handleClick}>
				{#snippet children()}Outline{/snippet}
			</Button>
		</div>
	</div>
</Story>

<!-- All Sizes -->
<Story name="Sizes" parameters={{ layout: 'padded' }}>
	<div class="space-y-4">
		<h3 class="text-lg font-semibold mb-4">Button Sizes</h3>
		<div class="flex flex-wrap items-center gap-4">
			<Button size="sm" onclick={handleClick}>
				{#snippet children()}Small{/snippet}
			</Button>
			<Button size="md" onclick={handleClick}>
				{#snippet children()}Medium{/snippet}
			</Button>
			<Button size="lg" onclick={handleClick}>
				{#snippet children()}Large{/snippet}
			</Button>
			<Button size="xl" onclick={handleClick}>
				{#snippet children()}Extra Large{/snippet}
			</Button>
			<Button size="icon" onclick={handleClick}>
				{#snippet children()}
					<Plus size={16} />
				{/snippet}
			</Button>
		</div>
	</div>
</Story>

<!-- With Icons -->
<Story name="With Icons" parameters={{ layout: 'padded' }}>
	<div class="space-y-4">
		<h3 class="text-lg font-semibold mb-4">Buttons with Icons</h3>
		<div class="flex flex-wrap gap-4">
			<Button variant="primary" onclick={handleClick}>
				{#snippet children()}
					<Search size={16} />
					Search
				{/snippet}
			</Button>
			<Button variant="secondary" onclick={handleClick}>
				{#snippet children()}
					<Download size={16} />
					Download
				{/snippet}
			</Button>
			<Button variant="destructive" onclick={handleClick}>
				{#snippet children()}
					<Trash2 size={16} />
					Delete
				{/snippet}
			</Button>
			<Button variant="ai-action" onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					Generate with AI
				{/snippet}
			</Button>
		</div>
	</div>
</Story>

<!-- States -->
<Story name="States" parameters={{ layout: 'padded' }}>
	<div class="space-y-6">
		<div>
			<h3 class="text-lg font-semibold mb-4">Button States</h3>
			<div class="space-y-4">
				<div class="space-y-2">
					<h4 class="text-sm font-medium text-muted-foreground">Normal</h4>
					<div class="flex flex-wrap gap-4">
						<Button variant="primary" onclick={handleClick}>
							{#snippet children()}Normal State{/snippet}
						</Button>
						<Button variant="ai-action" onclick={handleClick}>
							{#snippet children()}
								<Sparkles size={16} />
								AI Normal
							{/snippet}
						</Button>
					</div>
				</div>

				<div class="space-y-2">
					<h4 class="text-sm font-medium text-muted-foreground">Loading</h4>
					<div class="flex flex-wrap gap-4">
						<Button variant="primary" loading onclick={handleClick}>
							{#snippet children()}Loading State{/snippet}
						</Button>
						<Button variant="ai-action" loading onclick={handleClick}>
							{#snippet children()}
								<Sparkles size={16} />
								AI Loading
							{/snippet}
						</Button>
					</div>
				</div>

				<div class="space-y-2">
					<h4 class="text-sm font-medium text-muted-foreground">Disabled</h4>
					<div class="flex flex-wrap gap-4">
						<Button variant="primary" disabled onclick={handleClick}>
							{#snippet children()}Disabled State{/snippet}
						</Button>
						<Button variant="ai-action" disabled onclick={handleClick}>
							{#snippet children()}
								<Sparkles size={16} />
								AI Disabled
							{/snippet}
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</Story>

<!-- Full Width -->
<Story name="Full Width" parameters={{ layout: 'padded' }}>
	<div class="space-y-4 w-full max-w-md">
		<h3 class="text-lg font-semibold mb-4">Full Width Buttons</h3>
		<div class="space-y-3">
			<Button variant="primary" fullWidth onclick={handleClick}>
				{#snippet children()}Primary Full Width{/snippet}
			</Button>
			<Button variant="secondary" fullWidth onclick={handleClick}>
				{#snippet children()}Secondary Full Width{/snippet}
			</Button>
			<Button variant="ai-action" fullWidth onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					AI Action Full Width
				{/snippet}
			</Button>
		</div>
	</div>
</Story>

<!-- AI Actions Showcase -->
<Story name="AI Actions" parameters={{ layout: 'padded' }}>
	<div class="space-y-4">
		<h3 class="text-lg font-semibold mb-4">AI-Specific Actions</h3>
		<p class="text-sm text-muted-foreground mb-6">Special AI-enhanced buttons with glow effects and distinctive styling</p>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
			<Button variant="ai-action" onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					Auto-grade Assignment
				{/snippet}
			</Button>
			<Button variant="ai-action" onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					Generate Feedback
				{/snippet}
			</Button>
			<Button variant="ai-action" onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					Suggest Improvements
				{/snippet}
			</Button>
			<Button variant="ai-action" onclick={handleClick}>
				{#snippet children()}
					<Sparkles size={16} />
					Analyze Code Quality
				{/snippet}
			</Button>
		</div>
	</div>
</Story>

<!-- Interactive Playground -->
<Story
	name="Playground"
	args={{
		variant: 'primary',
		size: 'md',
		disabled: false,
		loading: false,
		fullWidth: false,
		type: 'button',
		onclick: handleClick
	}}
	parameters={{ layout: 'centered' }}
>
	{#snippet children()}
		Interactive Button
	{/snippet}
</Story>

<!-- Form Examples -->
<Story name="Form Usage" parameters={{ layout: 'padded' }}>
	<div class="space-y-6 max-w-md">
		<h3 class="text-lg font-semibold mb-4">Form Button Examples</h3>

		<form class="space-y-4 p-6 border border-border rounded-lg">
			<div>
				<label class="block text-sm font-medium mb-2">Sample Form</label>
				<input
					type="text"
					placeholder="Enter some text..."
					class="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<div class="flex gap-3">
				<Button type="submit" variant="primary">
					{#snippet children()}Submit{/snippet}
				</Button>
				<Button type="reset" variant="secondary">
					{#snippet children()}Reset{/snippet}
				</Button>
				<Button type="button" variant="ghost">
					{#snippet children()}Cancel{/snippet}
				</Button>
			</div>
		</form>

		<div class="p-6 border border-border rounded-lg bg-muted/30">
			<h4 class="font-medium mb-3">AI-Enhanced Form</h4>
			<div class="space-y-3">
				<textarea
					placeholder="Describe your assignment..."
					class="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					rows="3"
				></textarea>
				<div class="flex gap-2">
					<Button variant="ai-action" size="sm">
						{#snippet children()}
							<Sparkles size={14} />
							Generate Rubric
						{/snippet}
					</Button>
					<Button variant="outline" size="sm">
						{#snippet children()}Save Draft{/snippet}
					</Button>
				</div>
			</div>
		</div>
	</div>
</Story>

<!-- Accessibility Demo -->
<Story name="Accessibility" parameters={{ layout: 'padded' }}>
	<div class="space-y-6">
		<h3 class="text-lg font-semibold mb-4">Accessibility Features</h3>

		<div class="space-y-4">
			<div>
				<h4 class="text-sm font-medium mb-2">Focus States</h4>
				<p class="text-sm text-muted-foreground mb-3">Tab through these buttons to see focus indicators</p>
				<div class="flex gap-3">
					<Button variant="primary">
						{#snippet children()}Focus me{/snippet}
					</Button>
					<Button variant="ai-action">
						{#snippet children()}
							<Sparkles size={16} />
							AI Focus
						{/snippet}
					</Button>
					<Button variant="secondary">
						{#snippet children()}Then me{/snippet}
					</Button>
				</div>
			</div>

			<div>
				<h4 class="text-sm font-medium mb-2">Screen Reader Support</h4>
				<p class="text-sm text-muted-foreground mb-3">Buttons with proper ARIA attributes</p>
				<div class="flex gap-3">
					<Button variant="primary" disabled>
						{#snippet children()}Disabled (announced to screen readers){/snippet}
					</Button>
					<Button variant="primary" loading>
						{#snippet children()}Loading (aria-busy="true"){/snippet}
					</Button>
				</div>
			</div>

			<div>
				<h4 class="text-sm font-medium mb-2">High Contrast</h4>
				<p class="text-sm text-muted-foreground mb-3">Enable high contrast mode in your OS to test</p>
				<div class="flex gap-3">
					<Button variant="primary">
						{#snippet children()}High Contrast Test{/snippet}
					</Button>
					<Button variant="outline">
						{#snippet children()}Outline in High Contrast{/snippet}
					</Button>
				</div>
			</div>
		</div>
	</div>
</Story>
