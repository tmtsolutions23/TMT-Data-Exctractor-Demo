export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-medium text-slate-400">
              TMT Tech Solutions LLC
            </span>
            <span className="text-slate-700">|</span>
            <span>Ossining, NY</span>
          </div>
          <p className="text-xs text-slate-600">
            AI workflow automation for Westchester businesses
          </p>
        </div>
      </div>
    </footer>
  );
}
