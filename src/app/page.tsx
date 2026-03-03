import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Cog,
  Shield,
  ArrowRight,
  Mail,
  Zap,
  ChevronRight,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SERVICES = [
  {
    icon: FileText,
    title: "AI Document Processing",
    description:
      "Extract structured data from invoices, contracts, and forms in seconds. Upload one or fifty — get clean, export-ready results.",
    href: "/extract",
    cta: "Try the demo",
  },
  {
    icon: MessageSquare,
    title: "Smart Client Intake",
    description:
      "AI-powered intake chatbots that gather client information conversationally. Configured for law, medical, real estate, and accounting.",
    href: "/intake",
    cta: "Try the demo",
  },
  {
    icon: Cog,
    title: "Custom Automation & Integration",
    description:
      "End-to-end workflow automation connecting your existing tools. From data entry to reporting — we eliminate the manual steps.",
    href: null,
    cta: null,
  },
  {
    icon: Shield,
    title: "Network Infrastructure & Security",
    description:
      "Enterprise-grade network architecture, monitoring, and security. 14+ years of hands-on infrastructure experience.",
    href: null,
    cta: null,
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.06)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10">
        <Header />

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              AI-Powered Automation
            </div>
            <h2
              className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] mb-5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              We build the systems
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                that run your business.
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mb-8">
              TMT Tech Solutions helps businesses automate repetitive workflows
              with AI — from document processing to client intake to custom
              integrations. Less manual work, more growth.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#demos"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 font-semibold text-sm transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:shadow-[0_0_30px_rgba(251,191,36,0.25)]"
              >
                See Live Demos
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#contact"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-navy-800/60 border border-white/[0.08] text-slate-300 font-semibold text-sm hover:border-white/[0.16] hover:text-slate-100 transition-all"
              >
                Get in Touch
              </Link>
            </div>
          </div>
        </section>

        {/* About / Experience */}
        <section className="border-y border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
                  Why TMT
                </p>
                <h3
                  className="text-3xl sm:text-4xl font-bold tracking-tight mb-5"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  14+ years of IT expertise,
                  <br />
                  now focused on AI.
                </h3>
                <p className="text-slate-400 leading-relaxed mb-4">
                  With a Senior Network Engineer background spanning enterprise
                  infrastructure, security, and systems administration, TMT Tech
                  Solutions brings deep technical fluency to every automation
                  project.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  We don&apos;t just bolt AI onto your workflow — we understand
                  the full stack underneath it. That means solutions that
                  actually integrate with your existing systems and scale with
                  your business.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "14+", label: "Years in IT" },
                  { value: "AI", label: "Automation Focus" },
                  { value: "Full", label: "Stack Expertise" },
                  { value: "WC", label: "Westchester, NY" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/[0.06] bg-navy-900/40 p-6 text-center"
                  >
                    <p
                      className="text-2xl font-bold text-amber-400 mb-1"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {stat.value}
                    </p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Services / What We Build */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Services
            </p>
            <h3
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              What We Build
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="group rounded-2xl border border-white/[0.06] bg-navy-900/40 p-6 hover:border-white/[0.12] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <h4
                    className="text-lg font-bold mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {service.title}
                  </h4>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    {service.description}
                  </p>
                  {service.href && (
                    <Link
                      href={service.href}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      {service.cta}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Demos Banner */}
        <section id="demos" className="border-y border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
                Try It Yourself
              </p>
              <h3
                className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Live Demos
              </h3>
              <p className="text-slate-400 max-w-lg mx-auto">
                See our AI solutions in action. No signup required — your data
                is never stored.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <Link
                href="/extract"
                className="group flex flex-col rounded-2xl border border-white/[0.08] bg-navy-900/60 p-6 hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-amber-400" />
                </div>
                <h4
                  className="text-lg font-bold mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Document Extraction
                </h4>
                <p className="text-sm text-slate-400 mb-4 flex-1">
                  Upload PDFs, text, or CSV files and get structured data back
                  instantly. Batch processing and Excel export included.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 group-hover:text-amber-300 transition-colors">
                  Launch demo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
              <Link
                href="/intake"
                className="group flex flex-col rounded-2xl border border-white/[0.08] bg-navy-900/60 p-6 hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                </div>
                <h4
                  className="text-lg font-bold mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Client Intake Chatbot
                </h4>
                <p className="text-sm text-slate-400 mb-4 flex-1">
                  AI chatbot that gathers client information through natural
                  conversation. Supports law, medical, real estate, and CPA
                  verticals.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 group-hover:text-amber-300 transition-colors">
                  Launch demo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Get Started
            </p>
            <h3
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Let&apos;s talk about your
              <br />
              automation needs.
            </h3>
            <p className="text-slate-400 mb-8">
              Whether you need document processing, client intake automation, or
              a custom integration — we&apos;ll build it right.
            </p>
            <a
              href="mailto:gil@tmtsolutions.tech"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 font-semibold text-sm transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:shadow-[0_0_30px_rgba(251,191,36,0.25)]"
            >
              <Mail className="w-4 h-4" />
              gil@tmtsolutions.tech
            </a>
            <p className="text-xs text-slate-500 mt-4">
              Gil — TMT Tech Solutions LLC, Ossining, NY
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
