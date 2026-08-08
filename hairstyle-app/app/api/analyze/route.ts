import Anthropic from "@anthropic-ai/sdk";
import { AnalyzeRequestBody, AnalyzeResult, Gender, LengthPreference } from "@/lib/types";
import { getMockResult } from "@/lib/mockResult";

export const runtime = "nodejs";

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_GENDERS: Gender[] = ["pria", "wanita", "lainnya"];
const ALLOWED_LENGTHS: LengthPreference[] = ["pendek", "sedang", "panjang", "bebas"];

const GENDER_LABEL: Record<Gender, string> = {
  pria: "Pria",
  wanita: "Wanita",
  lainnya: "Tidak disebutkan / netral",
};

const LENGTH_LABEL: Record<LengthPreference, string> = {
  pendek: "Pendek",
  sedang: "Sedang",
  panjang: "Panjang",
  bebas: "Tidak ada preferensi khusus",
};

const SYSTEM_PROMPT = `Kamu adalah konsultan gaya rambut profesional. Tugasmu menganalisis foto wajah seseorang lalu merekomendasikan gaya rambut yang cocok.

Balas HANYA dengan JSON valid (tanpa markdown, tanpa teks lain) sesuai skema persis berikut:
{
  "faceShape": string (bentuk wajah dalam Bahasa Indonesia, misal "Oval", "Bulat", "Persegi", "Hati", "Diamond", "Lonjong"),
  "faceShapeReasoning": string (1-2 kalimat penjelasan kenapa bentuk wajah ini terdeteksi, dalam Bahasa Indonesia),
  "recommendations": [
    {
      "name": string (nama gaya rambut),
      "description": string (deskripsi singkat gaya rambut),
      "why": string (kenapa gaya ini cocok untuk bentuk wajah dan preferensi pengguna),
      "maintenance": "Rendah" | "Sedang" | "Tinggi",
      "hairType": string (jenis rambut yang cocok, misal "Lurus", "Bergelombang", "Keriting", "Semua jenis rambut")
    }
  ] (berikan tepat 3 rekomendasi, urutkan dari yang paling direkomendasikan),
  "stylingTips": string[] (2-3 tips styling praktis dalam Bahasa Indonesia)
}

Pertimbangkan preferensi gender dan panjang rambut yang diberikan pengguna. Semua teks harus dalam Bahasa Indonesia yang natural dan ramah.`;

function buildUserPrompt(gender: Gender, lengthPreference: LengthPreference, notes?: string) {
  let prompt = `Analisis foto wajah ini dan berikan rekomendasi gaya rambut.\n\nPreferensi pengguna:\n- Gender: ${GENDER_LABEL[gender]}\n- Panjang rambut yang diinginkan: ${LENGTH_LABEL[lengthPreference]}`;
  if (notes && notes.trim()) {
    prompt += `\n- Catatan tambahan: ${notes.trim().slice(0, 300)}`;
  }
  return prompt;
}

function isValidResult(data: unknown): data is AnalyzeResult {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.faceShape === "string" &&
    typeof d.faceShapeReasoning === "string" &&
    Array.isArray(d.recommendations) &&
    d.recommendations.length > 0 &&
    Array.isArray(d.stylingTips)
  );
}

export async function POST(request: Request) {
  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  const { image, mediaType, gender, lengthPreference, notes } = body;

  if (!image || typeof image !== "string") {
    return Response.json({ error: "Foto tidak ditemukan." }, { status: 400 });
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return Response.json(
      { error: "Format foto harus JPEG, PNG, atau WebP." },
      { status: 400 }
    );
  }
  if (!ALLOWED_GENDERS.includes(gender)) {
    return Response.json({ error: "Preferensi gender tidak valid." }, { status: 400 });
  }
  if (!ALLOWED_LENGTHS.includes(lengthPreference)) {
    return Response.json({ error: "Preferensi panjang rambut tidak valid." }, { status: 400 });
  }

  const approxBytes = (image.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Ukuran foto maksimal 5MB." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(getMockResult(gender));
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
                data: image,
              },
            },
            {
              type: "text",
              text: buildUserPrompt(gender, lengthPreference, notes),
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Respons AI tidak berisi teks.");
    }

    const cleaned = textBlock.text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");

    const parsed = JSON.parse(cleaned);
    if (!isValidResult(parsed)) {
      throw new Error("Format respons AI tidak sesuai skema.");
    }

    const result: AnalyzeResult = { ...parsed, demoMode: false };
    return Response.json(result);
  } catch (error) {
    console.error("Gagal menganalisis foto:", error);
    return Response.json(
      { error: "Gagal menganalisis foto. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
