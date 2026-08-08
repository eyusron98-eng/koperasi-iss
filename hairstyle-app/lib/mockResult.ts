import { AnalyzeResult, Gender } from "./types";

export function getMockResult(gender: Gender): AnalyzeResult {
  const base: AnalyzeResult = {
    faceShape: "Oval",
    faceShapeReasoning:
      "Ini adalah contoh hasil (mode demo). Panjang dan lebar wajah pada foto contoh terlihat proporsional dengan garis rahang yang lembut, ciri khas bentuk wajah oval.",
    recommendations: [
      {
        name: "Textured Crop",
        description:
          "Potongan pendek dengan tekstur berantakan di bagian atas, sisi lebih rapat.",
        why: "Menonjolkan garis rahang tanpa menambah lebar wajah, cocok untuk hampir semua bentuk wajah.",
        maintenance: "Sedang",
        hairType: "Lurus hingga bergelombang",
      },
      {
        name: "Layered Waves",
        description: "Rambut sedang dengan layer bertingkat dan ombak lembut.",
        why: "Layer menambah dimensi dan membingkai wajah secara seimbang.",
        maintenance: "Sedang",
        hairType: "Bergelombang hingga keriting",
      },
      {
        name: "Side-Swept Fringe",
        description: "Poni tipis disisir ke samping dengan panjang sedang.",
        why: "Melembutkan garis dahi dan memberi kesan wajah lebih dinamis.",
        maintenance: "Rendah",
        hairType: "Semua jenis rambut",
      },
    ],
    stylingTips: [
      "Ini contoh data demo — tambahkan ANTHROPIC_API_KEY untuk hasil analisis AI yang sesungguhnya berdasarkan foto kamu.",
      "Gunakan produk styling ringan agar tekstur rambut tetap natural.",
    ],
    demoMode: true,
  };

  if (gender === "pria") {
    base.recommendations = [
      base.recommendations[0],
      {
        name: "Classic Pompadour",
        description: "Rambut atas disisir ke belakang dengan volume, sisi rapi.",
        why: "Memberi kesan tegas dan memanjangkan proporsi wajah secara visual.",
        maintenance: "Tinggi",
        hairType: "Lurus hingga bergelombang",
      },
      {
        name: "Buzz Cut",
        description: "Potongan sangat pendek dan merata di seluruh kepala.",
        why: "Praktis, rendah perawatan, cocok untuk aktivitas tinggi.",
        maintenance: "Rendah",
        hairType: "Semua jenis rambut",
      },
    ];
  }

  return base;
}
