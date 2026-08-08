"use client";

import { useRef, useState } from "react";
import { AnalyzeResult, Gender, LengthPreference } from "@/lib/types";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "wanita", label: "Wanita" },
  { value: "pria", label: "Pria" },
  { value: "lainnya", label: "Lainnya / netral" },
];

const LENGTH_OPTIONS: { value: LengthPreference; label: string }[] = [
  { value: "bebas", label: "Bebas, ikuti rekomendasi" },
  { value: "pendek", label: "Pendek" },
  { value: "sedang", label: "Sedang" },
  { value: "panjang", label: "Panjang" },
];

const MAINTENANCE_STYLE: Record<string, string> = {
  Rendah: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Sedang: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Tinggi: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, data] = result.split(",");
      const mediaType = prefix.match(/data:(.*);base64/)?.[1] ?? file.type;
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>("wanita");
  const [lengthPreference, setLengthPreference] = useState<LengthPreference>("bebas");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(selected: File | null) {
    setError(null);
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Format foto harus JPEG, PNG, atau WebP.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("Ukuran foto maksimal 5MB.");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setResult(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: data,
          mediaType,
          gender,
          lengthPreference,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Terjadi kesalahan.");
      }
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-zinc-950">
      <main className="w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Rekomendasi Gaya Rambut AI
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Unggah foto wajahmu, dan dapatkan rekomendasi gaya rambut yang sesuai bentuk wajahmu.
          </p>
        </header>

        {!result && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col items-center gap-4">
              <label
                htmlFor="photo-input"
                className="flex h-56 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview foto"
                    className="h-full w-full rounded-xl object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <span className="text-4xl">📷</span>
                    <span className="font-medium">Klik untuk unggah foto selfie</span>
                    <span className="text-sm">JPEG, PNG, atau WebP, maks 5MB</span>
                  </div>
                )}
              </label>
              <input
                id="photo-input"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />

              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Panjang rambut diinginkan
                  </label>
                  <select
                    value={lengthPreference}
                    onChange={(e) => setLengthPreference(e.target.value as LengthPreference)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {LENGTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full">
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Catatan tambahan (opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: rambut tipis, ingin gaya minim perawatan, dsb."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {error && (
                <p className="w-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
                </p>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className="w-full rounded-full bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? "Menganalisis foto..." : "Analisis Wajah Saya"}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-6">
            {result.demoMode && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <strong>Mode Demo:</strong> ini contoh hasil, bukan analisis foto asli. Tambahkan{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">ANTHROPIC_API_KEY</code>{" "}
                di server untuk mengaktifkan analisis AI sesungguhnya.
              </div>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Foto kamu"
                    className="h-32 w-32 rounded-xl object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Bentuk wajah terdeteksi
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {result.faceShape}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {result.faceShapeReasoning}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Rekomendasi Gaya Rambut
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {rec.name}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          MAINTENANCE_STYLE[rec.maintenance] ?? ""
                        }`}
                      >
                        {rec.maintenance}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{rec.description}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500">
                      <span className="font-medium">Kenapa cocok:</span> {rec.why}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-600">
                      Jenis rambut: {rec.hairType}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {result.stylingTips.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Tips Styling
                </h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {result.stylingTips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleReset}
              className="rounded-full border border-zinc-300 px-5 py-3 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Coba Foto Lain
            </button>
          </div>
        )}
      </main>
      <footer className="w-full py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        Foto tidak disimpan di server — hanya digunakan sekali untuk analisis.
      </footer>
    </div>
  );
}
