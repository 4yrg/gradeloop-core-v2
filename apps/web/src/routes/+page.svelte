<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
>
	<div class="mx-auto max-w-4xl px-4 text-center">
		<!-- Hero -->
		<div class="mb-12">
			<h1 class="mb-4 text-6xl font-bold text-gray-900">
				Welcome to <span class="text-blue-600">GradeLoop</span>
			</h1>
			<p class="mx-auto max-w-2xl text-xl text-gray-600">
				Your comprehensive platform for programming education and code assessment. Streamline coding
				assignments, automate testing, and provide instant feedback.
			</p>
		</div>

		<!-- Features -->
		<div class="mb-12 grid gap-8 md:grid-cols-3">
			<!-- Feature 1 -->
			<Card>
				<CardHeader class="items-center text-center">
                    <center>
					<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
						<svg
							class="h-6 w-6 text-blue-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13
                   C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13
                   C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13
                   C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253z"
							/>
						</svg>
					</div>
                    </center>
					<CardTitle>Programming Courses</CardTitle>
				</CardHeader>
				<CardContent class="text-sm text-gray-600">
					Create and manage programming courses across multiple languages. Track student progress
					through coding challenges and projects.
				</CardContent>
			</Card>

			<!-- Feature 2 -->
			<Card>
				<CardHeader class="items-center text-center">
					<center>
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
							<svg
								class="h-6 w-6 text-green-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5
                   a2 2 0 012-2h5.586a1 1 0 01.707.293
                   l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
					</center>
					<CardTitle>Code Assessment</CardTitle>
				</CardHeader>
				<CardContent class="text-sm text-gray-600">
					Automated code testing and grading with unit tests, code quality checks, and instant
					feedback.
				</CardContent>
			</Card>

			<!-- Feature 3 -->
			<Card>
				<CardHeader class="items-center text-center">
					<center>
						<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
							<svg
								class="h-6 w-6 text-purple-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6
                   a2 2 0 002 2h2a2 2 0 002-2zm0 0V9
                   a2 2 0 012-2h2a2 2 0 012 2v10m-6 0
                   a2 2 0 002 2h2a2 2 0 002-2m0 0V5
                   a2 2 0 012-2h2a2 2 0 012 2v14
                   a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
						</div>
					</center>
					<CardTitle>Coding Analytics</CardTitle>
				</CardHeader>
				<CardContent class="text-sm text-gray-600">
					Analyze coding patterns, detect common mistakes, and gain insights into student
					performance.
				</CardContent>
			</Card>
		</div>

		<!-- Actions -->
		<div class="flex flex-col justify-center gap-4 sm:flex-row">
			<Button variant="outline" size="lg" class="border-blue-600 text-blue-600">Learn More</Button>
		</div>

		<!-- Footer tagline -->
		<div class="mt-12 text-gray-500">
			<p>Teaching code • Assessing skills • Building developers</p>
		</div>
	</div>
</div>
