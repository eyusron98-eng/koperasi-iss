export type Gender = "pria" | "wanita" | "lainnya";
export type LengthPreference = "pendek" | "sedang" | "panjang" | "bebas";

export interface AnalyzeRequestBody {
  image: string;
  mediaType: string;
  gender: Gender;
  lengthPreference: LengthPreference;
  notes?: string;
}

export interface HairstyleRecommendation {
  name: string;
  description: string;
  why: string;
  maintenance: "Rendah" | "Sedang" | "Tinggi";
  hairType: string;
}

export interface AnalyzeResult {
  faceShape: string;
  faceShapeReasoning: string;
  recommendations: HairstyleRecommendation[];
  stylingTips: string[];
  demoMode: boolean;
}
