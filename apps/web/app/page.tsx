import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">G</div>
            <span className="text-xl font-bold tracking-tight">GradeLoop</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#platform" className="hover:text-primary transition-colors">Platform</a>
            <a href="#about" className="hover:text-primary transition-colors">About</a>
          </div>
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground ai-glow inline-flex">
            Get Started
          </button>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          {/* Animated Background Gradients */}
          <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-secondary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-700" />

          <div className="container mx-auto px-4 md:px-6 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8 animate-in fade-in slide-in-from-bottom-4">
              ✨ Introducing GradeLoop Core v2
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Empowering Education with <br className="hidden md:block" />
              <span className="text-primary italic">Intelligent Insights.</span>
            </h1>
            <p className="mx-auto max-w-[700px] text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
              GradeLoop is a modern, AI-integrated Learning Management System designed to streamline academic workflows and provide actionable data for educators and students.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="h-12 px-8 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 ai-glow transition-all hover:scale-105">
                Start for Free
              </button>
              <button className="h-12 px-8 rounded-full border border-border bg-background hover:bg-muted transition-all font-semibold">
                View Documentation
              </button>
            </div>
          </div>

          {/* Hero Dashboard Preview */}
          <div className="container mx-auto px-4 md:px-6 mt-16 md:mt-24">
            <div className="relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-black/20 p-2 shadow-2xl backdrop-blur-sm">
              <div className="overflow-hidden rounded-xl border border-white/5 shadow-inner">
                <Image
                  src="/hero-dashboard.png"
                  alt="GradeLoop Dashboard Preview"
                  width={1920}
                  height={1080}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to succeed.</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto italic">
                A complete suite of tools built for modern education.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="card p-8 group hover:border-primary/50 transition-all duration-300">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <div className="size-6 bg-primary rounded-full blur-[2px] opacity-40 group-hover:scale-125 transition-transform" />
                  <span className="absolute text-primary font-bold">01</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Grading</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Automated grading assistants and rubric-based evaluations that save time and ensure consistency across all departments.
                </p>
              </div>

              <div className="card p-8 group border-primary/20 bg-primary/5 shadow-ai-glow">
                <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
                  <div className="size-6 bg-primary rounded-full blur-[4px] opacity-60 animate-pulse" />
                  <span className="absolute text-primary font-bold">02</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Real-time Analytics</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Visualize performance trends and engagement levels instantly with our powerful, interactive dashboard.
                </p>
              </div>

              <div className="card p-8 group hover:border-primary/50 transition-all duration-300">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <div className="size-6 bg-primary rounded-full blur-[2px] opacity-40 group-hover:scale-125 transition-transform" />
                  <span className="absolute text-primary font-bold">03</span>
                </div>
                <h3 className="text-xl font-bold mb-3">AI Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Predictive modeling and student-at-risk detection using advanced machine learning to improve retention and outcomes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl mx-auto bg-primary rounded-3xl p-10 md:p-20 text-center text-primary-foreground shadow-2xl overflow-hidden relative">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

              <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to transform your <br className="hidden md:block" /> institution?</h2>
              <p className="text-primary-foreground/80 text-lg mb-10 max-w-xl mx-auto">
                Join the hundreds of institutions already using GradeLoop to drive academic excellence.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button className="h-12 px-10 rounded-full bg-background text-foreground font-bold hover:bg-zinc-100 transition-all">
                  Get Started for Free
                </button>
                <button className="h-12 px-8 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-all">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center font-bold text-muted-foreground border border-border">G</div>
              <span className="text-lg font-bold tracking-tight">GradeLoop</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2026 GradeLoop Core v2. Built with precision for the future of LMS.
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
