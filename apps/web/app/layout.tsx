import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../components/providers/theme-provider';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin']
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin']
});

export const metadata: Metadata = {
	title: 'GradeLoop V2 - AI-Integrated Learning Management System',
	description:
		'Production-ready AI-integrated LMS with intelligent grading, plagiarism detection, and adaptive learning components',
	keywords: ['LMS', 'AI', 'Education', 'Grading', 'Learning Management'],
	authors: [{ name: 'GradeLoop Team' }],
	viewport: 'width=device-width, initial-scale=1'
};

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable}`}>
				<ThemeProvider defaultTheme="system" enableSystem disableTransitionOnChange={false}>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
