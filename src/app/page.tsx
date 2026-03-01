"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  Shield,
  Clock,
  ArrowRight,
  X,
  Download,
  Table,
  LayoutList,
} from "lucide-react";

// --- Types ---

type FileStatus = "queued" | "processing" | "done" | "error";

type FileEntry = {
  id: string;
  file: File;
  status: FileStatus;
  result?: Record<string, unknown>;
  error?: string;
  processingTime?: number;
};

type ResultView = "cards" | "table";
type Provider = "openai" | "claude";

const DOC_TYPES = [
  "Invoice",
  "Contract",
  "Lease Agreement",
  "Patient Intake Form",
  "Insurance Claim",
  "Purchase Order",
  "Employment Agreement",
  "NDA",
];

const MAX_CONCURRENT = 3;

// --- Helpers ---

function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, fullKey)
      );
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join("; ");
    } else {
      result[fullKey] = value === null || value === undefined ? "" : String(value);
    }
  }
  return result;
}

function formatKey(key: string): string {
  return key
    .split(".")
    .pop()!
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined)
    return <span className="text-slate-500 italic">N/A</span>;
  if (typeof value === "boolean")
    return (
      <span className={value ? "text-emerald-400" : "text-red-400"}>
        {value ? "Yes" : "No"}
      </span>
    );
  if (typeof value === "number")
    return (
      <span className="text-amber-400 font-medium">
        {value.toLocaleString()}
      </span>
    );
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value))
      return <span className="text-sky-400">{value}</span>;
    if (/^\$/.test(value))
      return <span className="text-amber-400 font-medium">{value}</span>;
    return <span className="text-slate-200">{value}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-1.5 mt-1">
        {value.map((item, i) => (
          <div key={i} className="pl-3 border-l-2 border-navy-600">
            {renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div
        className={`space-y-2 ${depth > 0 ? "mt-1 pl-3 border-l-2 border-navy-600" : ""}`}
      >
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <span className="text-slate-400 text-xs uppercase tracking-wider">
              {formatKey(k)}
            </span>
            <div className="mt-0.5">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

// --- Main Component ---

export default function Home() {
  const [docType, setDocType] = useState("Invoice");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [textInput, setTextInput] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [textResult, setTextResult] = useState<Record<string, unknown> | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [textTime, setTextTime] = useState<number | null>(null);
  const [resultView, setResultView] = useState<ResultView>("cards");
  const [provider, setProvider] = useState<Provider>("openai");
  const processingRef = useRef(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newEntries: FileEntry[] = acceptedFiles.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      status: "queued" as FileStatus,
    }));
    setFiles((prev) => [...prev, ...newEntries]);
    setTextResult(null);
    setTextError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const processFile = async (entry: FileEntry): Promise<FileEntry> => {
    const startTime = Date.now();
    try {
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("provider", provider);
      formData.append("file", entry.file);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        return {
          ...entry,
          status: "error",
          error: data.error || "Failed to extract",
          processingTime: Date.now() - startTime,
        };
      }

      return {
        ...entry,
        status: "done",
        result: data.extracted,
        processingTime: Date.now() - startTime,
      };
    } catch {
      return {
        ...entry,
        status: "error",
        error: "Network error",
        processingTime: Date.now() - startTime,
      };
    }
  };

  const retryFailed = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "error"
          ? { ...f, status: "queued" as FileStatus, error: undefined, processingTime: undefined }
          : f
      )
    );
  };

  const processAllFiles = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    // Read queued files from latest state via ref-style read
    let queued: FileEntry[] = [];
    setFiles((prev) => {
      queued = prev.filter((f) => f.status === "queued");
      return prev;
    });

    if (queued.length === 0) {
      processingRef.current = false;
      return;
    }

    const totalToProcess = queued.length;

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < totalToProcess; i += MAX_CONCURRENT) {
      const batch = queued.slice(i, i + MAX_CONCURRENT);

      // Mark batch as processing
      const batchIds = new Set(batch.map((b) => b.id));
      setFiles((prev) =>
        prev.map((f) =>
          batchIds.has(f.id) ? { ...f, status: "processing" as FileStatus } : f
        )
      );

      // Process batch with staggered starts to avoid API rate limits
      const results = await Promise.all(
        batch.map((entry, idx) =>
          new Promise<FileEntry>((resolve) =>
            setTimeout(() => resolve(processFile(entry)), idx * 800)
          )
        )
      );

      // Update results
      setFiles((prev) =>
        prev.map((f) => {
          const result = results.find((r) => r.id === f.id);
          return result || f;
        })
      );
    }

    processingRef.current = false;
  };

  const handleTextExtract = async () => {
    if (!textInput.trim()) return;
    setTextLoading(true);
    setTextError(null);
    setTextResult(null);
    const startTime = Date.now();
    try {
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("provider", provider);
      formData.append("text", textInput);
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed");
      setTextResult(data.extracted);
      setTextTime(Date.now() - startTime);
    } catch (err: unknown) {
      setTextError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setTextLoading(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setTextInput("");
    setTextResult(null);
    setTextError(null);
    setTextTime(null);
    processingRef.current = false;
  };

  // --- Export Helpers ---

  const completedFiles = files.filter((f) => f.status === "done" && f.result);

  const getAllColumns = (): string[] => {
    const colSet = new Set<string>();
    colSet.add("_fileName");
    for (const f of completedFiles) {
      const flat = flattenObject(f.result!);
      for (const key of Object.keys(flat)) colSet.add(key);
    }
    return Array.from(colSet);
  };

  // Build an Excel workbook buffer for a single file's extraction
  const buildSingleExcel = async (entry: FileEntry): Promise<ArrayBuffer> => {
    const flat = flattenObject(entry.result!);
    const keys = Object.keys(flat);
    const header = keys.map(formatKey);
    const values = keys.map((k) => flat[k] ?? "");

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Extracted Data");
    ws.addRow(header);
    ws.addRow(values);

    ws.columns.forEach((col, i) => {
      const maxLen = Math.max(header[i].length, String(values[i] ?? "").length);
      col.width = Math.min(maxLen + 2, 50);
    });
    ws.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  };

  // Build a CSV string for a single file's extraction
  const buildSingleCSV = (entry: FileEntry): string => {
    const flat = flattenObject(entry.result!);
    const keys = Object.keys(flat);
    const header = keys.map(formatKey);
    const values = keys.map((k) => flat[k] ?? "");
    const escape = (v: string) => {
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    return [header.map(escape).join(","), values.map((v) => escape(String(v))).join(",")].join("\n");
  };

  // Strip file extension from name
  const baseName = (name: string) => name.replace(/\.[^.]+$/, "");

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (completedFiles.length === 1) {
      // Single file — download directly
      const buffer = await buildSingleExcel(completedFiles[0]);
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      downloadBlob(blob, `${baseName(completedFiles[0].file.name)}-extracted.xlsx`);
      return;
    }

    // Multiple files — zip them
    const zip = new JSZip();
    for (const entry of completedFiles) {
      const buffer = await buildSingleExcel(entry);
      zip.file(`${baseName(entry.file.name)}-extracted.xlsx`, buffer);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `tmt-extraction-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const exportCSV = async () => {
    if (completedFiles.length === 1) {
      // Single file — download directly
      const csv = buildSingleCSV(completedFiles[0]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${baseName(completedFiles[0].file.name)}-extracted.csv`);
      return;
    }

    // Multiple files — zip them
    const zip = new JSZip();
    for (const entry of completedFiles) {
      const csv = buildSingleCSV(entry);
      zip.file(`${baseName(entry.file.name)}-extracted.csv`, csv);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `tmt-extraction-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  // --- Derived State ---

  const queuedCount = files.filter((f) => f.status === "queued").length;
  const processingCount = files.filter((f) => f.status === "processing").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const isProcessing = processingCount > 0;
  const hasFiles = files.length > 0;
  const totalTime = completedFiles.reduce(
    (sum, f) => sum + (f.processingTime || 0),
    0
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.06)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-navy-950" strokeWidth={2.5} />
              </div>
              <div>
                <h1
                  className="text-lg font-bold tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  TMT Tech Solutions
                </h1>
                <p className="text-[11px] text-slate-500 tracking-widest uppercase">
                  AI Document Intelligence
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5" />
              <span>Your data is never stored</span>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live Demo
            </div>
            <h2
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Extract structured data
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                from any document.
              </span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              Drop one PDF or fifty. Get clean, organized data back in seconds.
              Export to Excel with a single click.
            </p>
          </div>
        </section>

        {/* Controls Bar */}
        <section className="max-w-7xl mx-auto px-6 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Document Type */}
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setDocType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    docType === type
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "bg-navy-800/60 text-slate-400 border border-white/[0.06] hover:border-white/[0.12] hover:text-slate-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-1 p-1 bg-navy-800/60 rounded-lg border border-white/[0.06]">
              <button
                onClick={() => setInputMode("file")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  inputMode === "file"
                    ? "bg-navy-700 text-slate-100 shadow-sm"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Upload Files
              </button>
              <button
                onClick={() => setInputMode("text")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  inputMode === "text"
                    ? "bg-navy-700 text-slate-100 shadow-sm"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Paste Text
              </button>
            </div>

            {/* AI Provider Toggle — hidden for now, defaults to OpenAI */}
          </div>
        </section>

        {/* Main Content */}
        <section className="max-w-7xl mx-auto px-6 pb-24">
          {inputMode === "text" ? (
            /* ---- Text Mode (unchanged) ---- */
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your document text here..."
                  rows={14}
                  className="w-full rounded-2xl bg-navy-900/40 border border-white/[0.08] px-5 py-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleTextExtract}
                    disabled={textLoading || !textInput.trim()}
                    className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {textLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        Extract Data
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div>
                {textError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-400">{textError}</p>
                    </div>
                  </div>
                )}
                {textLoading && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/[0.02] px-8 py-16">
                    <Loader2 className="w-7 h-7 text-amber-400 animate-spin mb-4" />
                    <p className="text-amber-300 font-medium">Analyzing...</p>
                  </div>
                )}
                {textResult && (
                  <div className="animate-fade-up">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300 text-sm font-medium">
                          Done
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {textTime ? `${(textTime / 1000).toFixed(1)}s` : "—"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-navy-900/60 p-5 space-y-3 max-h-[600px] overflow-y-auto">
                      {Object.entries(textResult).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {formatKey(key)}
                          </span>
                          <div className="mt-0.5 text-sm">
                            {renderValue(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ---- File / Batch Mode ---- */
            <div className="space-y-6">
              {/* Drop Zone */}
              <div
                {...getRootProps()}
                className={`relative group rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
                  isDragActive
                    ? "border-amber-400/60 bg-amber-500/[0.04]"
                    : hasFiles
                      ? "border-white/[0.08] bg-navy-900/20"
                      : "border-white/[0.08] hover:border-white/[0.16] bg-navy-900/40"
                }`}
              >
                <input {...getInputProps()} />
                <div
                  className={`flex flex-col items-center justify-center px-6 ${hasFiles ? "py-8" : "py-16"}`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 group-hover:bg-white/[0.06] transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-slate-300 transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-slate-300">
                    {isDragActive
                      ? "Drop files here..."
                      : hasFiles
                        ? "Drop more files or click to add"
                        : "Drag & drop documents here"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF, TXT, or CSV up to 10MB each — batch upload supported
                  </p>
                </div>
              </div>

              {/* File List */}
              {hasFiles && (
                <div className="space-y-4">
                  {/* Status bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-400">
                        {files.length} file{files.length !== 1 ? "s" : ""}
                      </span>
                      {doneCount > 0 && (
                        <span className="text-emerald-400">
                          {doneCount} extracted
                        </span>
                      )}
                      {processingCount > 0 && (
                        <span className="text-amber-400">
                          {processingCount} processing
                        </span>
                      )}
                      {errorCount > 0 && (
                        <span className="text-red-400">
                          {errorCount} failed
                        </span>
                      )}
                      {totalTime > 0 && (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(totalTime / 1000).toFixed(1)}s total
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {completedFiles.length > 0 && (
                        <>
                          {/* View toggle */}
                          <div className="flex gap-1 p-0.5 bg-navy-800/60 rounded-md border border-white/[0.06]">
                            <button
                              onClick={() => setResultView("cards")}
                              className={`p-1.5 rounded transition-all cursor-pointer ${resultView === "cards" ? "bg-navy-700 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}
                              title="Card view"
                            >
                              <LayoutList className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setResultView("table")}
                              className={`p-1.5 rounded transition-all cursor-pointer ${resultView === "table" ? "bg-navy-700 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}
                              title="Table view"
                            >
                              <Table className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Export buttons */}
                          <button
                            onClick={exportExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-all cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            Excel
                          </button>
                          <button
                            onClick={exportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-medium hover:bg-slate-500/15 transition-all cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            CSV
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* File entries */}
                  <div className="grid gap-2">
                    {files.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          entry.status === "done"
                            ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                            : entry.status === "error"
                              ? "border-red-500/20 bg-red-500/[0.03]"
                              : entry.status === "processing"
                                ? "border-amber-500/20 bg-amber-500/[0.02]"
                                : "border-white/[0.06] bg-navy-900/30"
                        }`}
                      >
                        {/* Icon */}
                        <div className="shrink-0">
                          {entry.status === "processing" ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                          ) : entry.status === "done" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : entry.status === "error" ? (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-500" />
                          )}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">
                            {entry.file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(entry.file.size / 1024).toFixed(0)} KB
                            {entry.processingTime &&
                              ` — ${(entry.processingTime / 1000).toFixed(1)}s`}
                            {entry.error && (
                              <span className="text-red-400 ml-2">
                                {entry.error}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Remove button */}
                        {entry.status !== "processing" && (
                          <button
                            onClick={() => removeFile(entry.id)}
                            className="shrink-0 p-1 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    {queuedCount > 0 && (
                      <button
                        onClick={processAllFiles}
                        disabled={isProcessing}
                        className="flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-navy-950 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(251,191,36,0.15)] cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing {doneCount + processingCount} of {files.length}...
                          </>
                        ) : (
                          <>
                            Extract All ({queuedCount} file
                            {queuedCount !== 1 ? "s" : ""})
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                    {errorCount > 0 && !isProcessing && (
                      <button
                        onClick={() => { retryFailed(); }}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm hover:bg-red-500/15 transition-all cursor-pointer"
                      >
                        Retry Failed ({errorCount})
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      className="px-5 py-3.5 rounded-xl bg-navy-800/60 border border-white/[0.06] text-slate-400 text-sm font-medium hover:text-slate-300 hover:border-white/[0.12] transition-all cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Results */}
                  {completedFiles.length > 0 && resultView === "cards" && (
                    <div className="space-y-4 mt-6">
                      <h3
                        className="text-lg font-bold text-slate-200"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        Extraction Results
                      </h3>
                      {completedFiles.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-white/[0.08] bg-navy-900/60 overflow-hidden animate-fade-up"
                        >
                          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-amber-400" />
                              <span className="text-sm font-medium text-slate-300">
                                {entry.file.name}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  JSON.stringify(entry.result, null, 2)
                                )
                              }
                              className="text-xs text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                            >
                              Copy JSON
                            </button>
                          </div>
                          <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto">
                            {Object.entries(entry.result!).map(
                              ([key, value]) => (
                                <div key={key}>
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {formatKey(key)}
                                  </span>
                                  <div className="mt-0.5 text-sm">
                                    {renderValue(value)}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Table View */}
                  {completedFiles.length > 0 && resultView === "table" && (() => {
                    const columns = getAllColumns();
                    return (
                      <div className="mt-6 animate-fade-up">
                        <h3
                          className="text-lg font-bold text-slate-200 mb-4"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          Extraction Results
                        </h3>
                        <div className="rounded-2xl border border-white/[0.08] bg-navy-900/60 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-white/[0.06]">
                                  {columns.map((col) => (
                                    <th
                                      key={col}
                                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                                    >
                                      {col === "_fileName"
                                        ? "File Name"
                                        : formatKey(col)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {completedFiles.map((entry, rowIdx) => {
                                  const flat = flattenObject(entry.result!);
                                  return (
                                    <tr
                                      key={entry.id}
                                      className={
                                        rowIdx % 2 === 0
                                          ? "bg-transparent"
                                          : "bg-white/[0.01]"
                                      }
                                    >
                                      {columns.map((col) => (
                                        <td
                                          key={col}
                                          className="px-4 py-2.5 text-slate-300 whitespace-nowrap max-w-[300px] truncate"
                                        >
                                          {col === "_fileName"
                                            ? entry.file.name
                                            : flat[col] ?? "—"}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Footer */}
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
      </div>
    </div>
  );
}
