"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { UploadCloud } from "lucide-react";

export function Dropzone({
  accept,
  onFiles,
  title = "Drop files here or browse",
  hint,
  className,
  busy = false,
}: {
  accept?: string;
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  className?: string;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handle(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
        over
          ? "border-teal-400 bg-teal-500/10"
          : "border-white/15 bg-navy-900/40 hover:border-medical-500/50 hover:bg-navy-900/70",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <div
        className={cn(
          "grid h-14 w-14 place-items-center rounded-2xl text-medical-300 transition",
          over ? "bg-teal-500/20 text-teal-300" : "bg-medical-600/15"
        )}
      >
        <UploadCloud className={cn("h-7 w-7", busy && "animate-pulse")} />
      </div>
      <p className="mt-4 text-sm font-semibold text-white">
        {busy ? "Processing…" : title}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
