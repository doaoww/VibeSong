import { NextRequest, NextResponse } from "next/server";
import type { EmotionalVector } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  language: string;
  emotionalVector: EmotionalVector;
}

const SEED_POOL: SeedSong[] = [
  // ── English: Hip-Hop ─────────────────────────────────────────────────────
  { title: "EARFQUAKE", artist: "Tyler the Creator", genres: ["alternative hip-hop", "neo-soul"], language: "english",
    emotionalVector: { dreamy: 0.72, nostalgia: 0.38, energy: 0.52, cinematic: 0.58, darkness: 0.30, confidence: 0.68, intimacy: 0.80, danceability: 0.54, electronic: 0.48, acoustic: 0.18 } },
  { title: "HUMBLE.", artist: "Kendrick Lamar", genres: ["hip-hop", "conscious rap"], language: "english",
    emotionalVector: { dreamy: 0.08, nostalgia: 0.20, energy: 0.92, cinematic: 0.70, darkness: 0.62, confidence: 1.00, intimacy: 0.10, danceability: 0.72, electronic: 0.40, acoustic: 0.02 } },
  { title: "Redbone", artist: "Childish Gambino", genres: ["psychedelic soul", "funk"], language: "english",
    emotionalVector: { dreamy: 0.62, nostalgia: 0.72, energy: 0.42, cinematic: 0.50, darkness: 0.38, confidence: 0.58, intimacy: 0.72, danceability: 0.64, electronic: 0.28, acoustic: 0.40 } },
  { title: "Self Care", artist: "Mac Miller", genres: ["alternative hip-hop", "lo-fi"], language: "english",
    emotionalVector: { dreamy: 0.80, nostalgia: 0.62, energy: 0.30, cinematic: 0.62, darkness: 0.72, confidence: 0.50, intimacy: 0.70, danceability: 0.32, electronic: 0.42, acoustic: 0.32 } },
  { title: "Money Trees", artist: "Kendrick Lamar", genres: ["hip-hop", "jazz rap"], language: "english",
    emotionalVector: { dreamy: 0.44, nostalgia: 0.60, energy: 0.55, cinematic: 0.72, darkness: 0.50, confidence: 0.78, intimacy: 0.40, danceability: 0.55, electronic: 0.20, acoustic: 0.35 } },
  { title: "SICKO MODE", artist: "Travis Scott", genres: ["trap", "hip-hop"], language: "english",
    emotionalVector: { dreamy: 0.30, nostalgia: 0.10, energy: 0.95, cinematic: 0.80, darkness: 0.75, confidence: 0.90, intimacy: 0.08, danceability: 0.78, electronic: 0.70, acoustic: 0.02 } },
  { title: "No Role Modelz", artist: "J. Cole", genres: ["hip-hop", "rap"], language: "english",
    emotionalVector: { dreamy: 0.20, nostalgia: 0.45, energy: 0.70, cinematic: 0.55, darkness: 0.40, confidence: 0.85, intimacy: 0.30, danceability: 0.65, electronic: 0.30, acoustic: 0.15 } },
  // ── English: R&B / Neo-Soul ───────────────────────────────────────────────
  { title: "Kill Bill", artist: "SZA", genres: ["alternative R&B", "pop"], language: "english",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.48, energy: 0.42, cinematic: 0.65, darkness: 0.58, confidence: 0.62, intimacy: 0.78, danceability: 0.45, electronic: 0.35, acoustic: 0.30 } },
  { title: "Get You", artist: "Daniel Caesar", genres: ["R&B", "soul"], language: "english",
    emotionalVector: { dreamy: 0.70, nostalgia: 0.55, energy: 0.25, cinematic: 0.48, darkness: 0.20, confidence: 0.50, intimacy: 0.92, danceability: 0.30, electronic: 0.22, acoustic: 0.62 } },
  { title: "Ivy", artist: "Frank Ocean", genres: ["indie R&B", "alternative R&B"], language: "english",
    emotionalVector: { dreamy: 0.85, nostalgia: 0.90, energy: 0.18, cinematic: 0.75, darkness: 0.45, confidence: 0.42, intimacy: 0.88, danceability: 0.18, electronic: 0.20, acoustic: 0.70 } },
  { title: "Starboy", artist: "The Weeknd", genres: ["dark R&B", "synth-pop"], language: "english",
    emotionalVector: { dreamy: 0.40, nostalgia: 0.22, energy: 0.72, cinematic: 0.78, darkness: 0.80, confidence: 0.82, intimacy: 0.38, danceability: 0.75, electronic: 0.82, acoustic: 0.05 } },
  { title: "Focus", artist: "H.E.R.", genres: ["R&B", "soul"], language: "english",
    emotionalVector: { dreamy: 0.60, nostalgia: 0.40, energy: 0.35, cinematic: 0.45, darkness: 0.28, confidence: 0.55, intimacy: 0.85, danceability: 0.38, electronic: 0.30, acoustic: 0.55 } },
  { title: "Superstar", artist: "Jhené Aiko", genres: ["R&B", "neo-soul"], language: "english",
    emotionalVector: { dreamy: 0.82, nostalgia: 0.50, energy: 0.20, cinematic: 0.40, darkness: 0.25, confidence: 0.40, intimacy: 0.90, danceability: 0.22, electronic: 0.25, acoustic: 0.65 } },
  // ── English: Pop ──────────────────────────────────────────────────────────
  { title: "bad guy", artist: "Billie Eilish", genres: ["dark pop", "electropop"], language: "english",
    emotionalVector: { dreamy: 0.48, nostalgia: 0.18, energy: 0.58, cinematic: 0.70, darkness: 0.85, confidence: 0.78, intimacy: 0.42, danceability: 0.62, electronic: 0.88, acoustic: 0.05 } },
  { title: "drivers license", artist: "Olivia Rodrigo", genres: ["pop", "indie pop"], language: "english",
    emotionalVector: { dreamy: 0.65, nostalgia: 0.72, energy: 0.22, cinematic: 0.68, darkness: 0.55, confidence: 0.35, intimacy: 0.80, danceability: 0.18, electronic: 0.18, acoustic: 0.78 } },
  { title: "Golden", artist: "Harry Styles", genres: ["pop", "indie rock"], language: "english",
    emotionalVector: { dreamy: 0.75, nostalgia: 0.62, energy: 0.48, cinematic: 0.52, darkness: 0.10, confidence: 0.72, intimacy: 0.62, danceability: 0.55, electronic: 0.20, acoustic: 0.55 } },
  { title: "Royals", artist: "Lorde", genres: ["indie pop", "art pop"], language: "english",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.40, energy: 0.38, cinematic: 0.75, darkness: 0.52, confidence: 0.70, intimacy: 0.50, danceability: 0.40, electronic: 0.55, acoustic: 0.30 } },
  { title: "positions", artist: "Ariana Grande", genres: ["pop", "R&B"], language: "english",
    emotionalVector: { dreamy: 0.60, nostalgia: 0.20, energy: 0.55, cinematic: 0.40, darkness: 0.12, confidence: 0.65, intimacy: 0.75, danceability: 0.68, electronic: 0.60, acoustic: 0.18 } },
  // ── English: Indie / Alternative ──────────────────────────────────────────
  { title: "Do I Wanna Know?", artist: "Arctic Monkeys", genres: ["indie rock", "alternative rock"], language: "english",
    emotionalVector: { dreamy: 0.50, nostalgia: 0.55, energy: 0.60, cinematic: 0.72, darkness: 0.62, confidence: 0.75, intimacy: 0.55, danceability: 0.52, electronic: 0.30, acoustic: 0.40 } },
  { title: "The Less I Know The Better", artist: "Tame Impala", genres: ["psychedelic pop", "indie rock"], language: "english",
    emotionalVector: { dreamy: 0.90, nostalgia: 0.70, energy: 0.55, cinematic: 0.65, darkness: 0.28, confidence: 0.58, intimacy: 0.62, danceability: 0.72, electronic: 0.60, acoustic: 0.25 } },
  { title: "Take Me To Church", artist: "Hozier", genres: ["indie rock", "soul"], language: "english",
    emotionalVector: { dreamy: 0.42, nostalgia: 0.50, energy: 0.65, cinematic: 0.88, darkness: 0.72, confidence: 0.80, intimacy: 0.70, danceability: 0.35, electronic: 0.10, acoustic: 0.68 } },
  { title: "Bags", artist: "Clairo", genres: ["bedroom pop", "indie pop"], language: "english",
    emotionalVector: { dreamy: 0.88, nostalgia: 0.75, energy: 0.15, cinematic: 0.45, darkness: 0.30, confidence: 0.30, intimacy: 0.90, danceability: 0.18, electronic: 0.20, acoustic: 0.80 } },
  { title: "Loving Is Easy", artist: "Rex Orange County", genres: ["indie pop", "bedroom pop"], language: "english",
    emotionalVector: { dreamy: 0.80, nostalgia: 0.65, energy: 0.32, cinematic: 0.42, darkness: 0.08, confidence: 0.48, intimacy: 0.78, danceability: 0.40, electronic: 0.22, acoustic: 0.70 } },
  { title: "Motion Sickness", artist: "Phoebe Bridgers", genres: ["indie folk", "indie rock"], language: "english",
    emotionalVector: { dreamy: 0.65, nostalgia: 0.78, energy: 0.40, cinematic: 0.70, darkness: 0.60, confidence: 0.42, intimacy: 0.72, danceability: 0.28, electronic: 0.15, acoustic: 0.75 } },
  // ── English: Electronic ───────────────────────────────────────────────────
  { title: "Get Lucky", artist: "Daft Punk", genres: ["nu-disco", "house"], language: "english",
    emotionalVector: { dreamy: 0.40, nostalgia: 0.50, energy: 0.75, cinematic: 0.38, darkness: 0.08, confidence: 0.72, intimacy: 0.42, danceability: 0.90, electronic: 0.85, acoustic: 0.05 } },
  { title: "Chances", artist: "KAYTRANADA", genres: ["electronic", "house"], language: "english",
    emotionalVector: { dreamy: 0.48, nostalgia: 0.30, energy: 0.72, cinematic: 0.40, darkness: 0.15, confidence: 0.65, intimacy: 0.55, danceability: 0.88, electronic: 0.90, acoustic: 0.02 } },
  { title: "Los Angeles", artist: "The Midnight", genres: ["synthwave", "retrowave"], language: "english",
    emotionalVector: { dreamy: 0.85, nostalgia: 0.88, energy: 0.52, cinematic: 0.90, darkness: 0.40, confidence: 0.60, intimacy: 0.65, danceability: 0.55, electronic: 0.92, acoustic: 0.05 } },
  { title: "Latch", artist: "Disclosure", genres: ["UK garage", "house"], language: "english",
    emotionalVector: { dreamy: 0.45, nostalgia: 0.22, energy: 0.70, cinematic: 0.38, darkness: 0.18, confidence: 0.60, intimacy: 0.62, danceability: 0.85, electronic: 0.88, acoustic: 0.05 } },
  // ── English: Soul / Folk ──────────────────────────────────────────────────
  { title: "River", artist: "Leon Bridges", genres: ["soul", "R&B"], language: "english",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.82, energy: 0.28, cinematic: 0.62, darkness: 0.22, confidence: 0.55, intimacy: 0.78, danceability: 0.35, electronic: 0.08, acoustic: 0.85 } },
  { title: "Holocene", artist: "Bon Iver", genres: ["indie folk", "ambient"], language: "english",
    emotionalVector: { dreamy: 0.92, nostalgia: 0.88, energy: 0.12, cinematic: 0.95, darkness: 0.40, confidence: 0.28, intimacy: 0.82, danceability: 0.10, electronic: 0.15, acoustic: 0.90 } },
  // ── English: Pop-Punk / Rock ──────────────────────────────────────────────
  { title: "misery business", artist: "Paramore", genres: ["pop-punk", "rock"], language: "english",
    emotionalVector: { dreamy: 0.12, nostalgia: 0.35, energy: 0.95, cinematic: 0.55, darkness: 0.50, confidence: 0.90, intimacy: 0.20, danceability: 0.60, electronic: 0.30, acoustic: 0.35 } },
  { title: "brutal", artist: "Olivia Rodrigo", genres: ["pop-punk", "alternative"], language: "english",
    emotionalVector: { dreamy: 0.18, nostalgia: 0.42, energy: 0.88, cinematic: 0.50, darkness: 0.58, confidence: 0.82, intimacy: 0.28, danceability: 0.58, electronic: 0.28, acoustic: 0.40 } },
  // ── Korean ────────────────────────────────────────────────────────────────
  { title: "Spring Day", artist: "BTS", genres: ["K-pop", "indie pop"], language: "korean",
    emotionalVector: { dreamy: 0.80, nostalgia: 0.85, energy: 0.35, cinematic: 0.75, darkness: 0.35, confidence: 0.50, intimacy: 0.70, danceability: 0.38, electronic: 0.40, acoustic: 0.45 } },
  { title: "Celebrity", artist: "IU", genres: ["K-pop", "dream pop"], language: "korean",
    emotionalVector: { dreamy: 0.82, nostalgia: 0.60, energy: 0.42, cinematic: 0.55, darkness: 0.10, confidence: 0.65, intimacy: 0.68, danceability: 0.50, electronic: 0.45, acoustic: 0.42 } },
  { title: "Attention", artist: "NewJeans", genres: ["K-pop", "R&B"], language: "korean",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.48, energy: 0.55, cinematic: 0.42, darkness: 0.15, confidence: 0.62, intimacy: 0.65, danceability: 0.72, electronic: 0.55, acoustic: 0.25 } },
  { title: "LOVE DIVE", artist: "IVE", genres: ["K-pop", "dance pop"], language: "korean",
    emotionalVector: { dreamy: 0.50, nostalgia: 0.28, energy: 0.72, cinematic: 0.55, darkness: 0.20, confidence: 0.80, intimacy: 0.50, danceability: 0.82, electronic: 0.70, acoustic: 0.08 } },
  { title: "ETA", artist: "NewJeans", genres: ["K-pop", "dance pop"], language: "korean",
    emotionalVector: { dreamy: 0.42, nostalgia: 0.30, energy: 0.80, cinematic: 0.48, darkness: 0.12, confidence: 0.75, intimacy: 0.48, danceability: 0.88, electronic: 0.68, acoustic: 0.05 } },
  { title: "LILAC", artist: "IU", genres: ["K-pop", "indie pop"], language: "korean",
    emotionalVector: { dreamy: 0.75, nostalgia: 0.70, energy: 0.50, cinematic: 0.58, darkness: 0.10, confidence: 0.62, intimacy: 0.65, danceability: 0.60, electronic: 0.42, acoustic: 0.48 } },
  { title: "Dynamite", artist: "BTS", genres: ["K-pop", "disco pop"], language: "korean",
    emotionalVector: { dreamy: 0.38, nostalgia: 0.42, energy: 0.85, cinematic: 0.48, darkness: 0.05, confidence: 0.82, intimacy: 0.38, danceability: 0.90, electronic: 0.60, acoustic: 0.12 } },
  // ── Spanish / Latin ───────────────────────────────────────────────────────
  { title: "Me Porto Bonito", artist: "Bad Bunny", genres: ["reggaeton", "dembow"], language: "spanish",
    emotionalVector: { dreamy: 0.22, nostalgia: 0.15, energy: 0.88, cinematic: 0.35, darkness: 0.22, confidence: 0.90, intimacy: 0.50, danceability: 0.95, electronic: 0.65, acoustic: 0.05 } },
  { title: "LA FAMA", artist: "Rosalía", genres: ["flamenco pop", "experimental pop"], language: "spanish",
    emotionalVector: { dreamy: 0.60, nostalgia: 0.55, energy: 0.48, cinematic: 0.80, darkness: 0.42, confidence: 0.82, intimacy: 0.60, danceability: 0.55, electronic: 0.45, acoustic: 0.55 } },
  { title: "Tití Me Preguntó", artist: "Bad Bunny", genres: ["reggaeton", "Latin trap"], language: "spanish",
    emotionalVector: { dreamy: 0.18, nostalgia: 0.20, energy: 0.90, cinematic: 0.40, darkness: 0.28, confidence: 0.88, intimacy: 0.42, danceability: 0.92, electronic: 0.62, acoustic: 0.05 } },
  { title: "Shakira: Bzrp Music Sessions Vol. 53", artist: "Bizarrap", genres: ["reggaeton", "urban pop"], language: "spanish",
    emotionalVector: { dreamy: 0.18, nostalgia: 0.25, energy: 0.88, cinematic: 0.55, darkness: 0.40, confidence: 0.95, intimacy: 0.30, danceability: 0.85, electronic: 0.70, acoustic: 0.05 } },
  { title: "El Mal Querer", artist: "Rosalía", genres: ["flamenco", "art pop"], language: "spanish",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.72, energy: 0.42, cinematic: 0.88, darkness: 0.65, confidence: 0.78, intimacy: 0.68, danceability: 0.38, electronic: 0.30, acoustic: 0.72 } },
  // ── Russian ───────────────────────────────────────────────────────────────
  { title: "Кружит", artist: "Miyagi & Эндшпиль", genres: ["hip-hop", "trap"], language: "russian",
    emotionalVector: { dreamy: 0.75, nostalgia: 0.65, energy: 0.50, cinematic: 0.70, darkness: 0.55, confidence: 0.60, intimacy: 0.72, danceability: 0.55, electronic: 0.65, acoustic: 0.20 } },
  { title: "Мне Нравится", artist: "Монеточка", genres: ["indie pop", "folk pop"], language: "russian",
    emotionalVector: { dreamy: 0.70, nostalgia: 0.80, energy: 0.38, cinematic: 0.55, darkness: 0.30, confidence: 0.52, intimacy: 0.68, danceability: 0.40, electronic: 0.35, acoustic: 0.60 } },
  { title: "ПЫЯЛА", artist: "JONY", genres: ["R&B", "trap"], language: "russian",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.40, energy: 0.65, cinematic: 0.48, darkness: 0.42, confidence: 0.70, intimacy: 0.62, danceability: 0.72, electronic: 0.60, acoustic: 0.15 } },
  { title: "I Got Love", artist: "Miyagi & Эндшпиль", genres: ["hip-hop", "R&B"], language: "russian",
    emotionalVector: { dreamy: 0.60, nostalgia: 0.50, energy: 0.58, cinematic: 0.62, darkness: 0.38, confidence: 0.72, intimacy: 0.65, danceability: 0.62, electronic: 0.55, acoustic: 0.22 } },
  { title: "Поедем", artist: "Thomas Mraz", genres: ["indie pop", "soul"], language: "russian",
    emotionalVector: { dreamy: 0.72, nostalgia: 0.60, energy: 0.30, cinematic: 0.52, darkness: 0.25, confidence: 0.48, intimacy: 0.80, danceability: 0.35, electronic: 0.30, acoustic: 0.65 } },
  { title: "Дым", artist: "NILETTO", genres: ["pop", "R&B"], language: "russian",
    emotionalVector: { dreamy: 0.62, nostalgia: 0.48, energy: 0.50, cinematic: 0.55, darkness: 0.30, confidence: 0.58, intimacy: 0.70, danceability: 0.55, electronic: 0.50, acoustic: 0.35 } },
  // ── Hindi ─────────────────────────────────────────────────────────────────
  { title: "Tum Hi Ho", artist: "Arijit Singh", genres: ["Bollywood", "romantic"], language: "hindi",
    emotionalVector: { dreamy: 0.72, nostalgia: 0.60, energy: 0.20, cinematic: 0.75, darkness: 0.18, confidence: 0.42, intimacy: 0.95, danceability: 0.15, electronic: 0.25, acoustic: 0.80 } },
  { title: "Kesariya", artist: "Arijit Singh", genres: ["Bollywood", "pop"], language: "hindi",
    emotionalVector: { dreamy: 0.68, nostalgia: 0.55, energy: 0.38, cinematic: 0.72, darkness: 0.22, confidence: 0.48, intimacy: 0.85, danceability: 0.32, electronic: 0.40, acoustic: 0.62 } },
  { title: "Raataan Lambiyan", artist: "Jubin Nautiyal", genres: ["Bollywood", "romantic pop"], language: "hindi",
    emotionalVector: { dreamy: 0.75, nostalgia: 0.62, energy: 0.25, cinematic: 0.65, darkness: 0.15, confidence: 0.40, intimacy: 0.88, danceability: 0.22, electronic: 0.28, acoustic: 0.75 } },
  { title: "Jai Ho", artist: "A.R. Rahman", genres: ["Bollywood", "world"], language: "hindi",
    emotionalVector: { dreamy: 0.40, nostalgia: 0.50, energy: 0.78, cinematic: 0.85, darkness: 0.12, confidence: 0.85, intimacy: 0.40, danceability: 0.72, electronic: 0.50, acoustic: 0.45 } },
  // ── Japanese ──────────────────────────────────────────────────────────────
  { title: "Lemon", artist: "Kenshi Yonezu", genres: ["J-pop", "alternative"], language: "japanese",
    emotionalVector: { dreamy: 0.80, nostalgia: 0.88, energy: 0.28, cinematic: 0.82, darkness: 0.50, confidence: 0.40, intimacy: 0.78, danceability: 0.22, electronic: 0.38, acoustic: 0.60 } },
  { title: "Yoru ni Kakeru", artist: "YOASOBI", genres: ["J-pop", "electropop"], language: "japanese",
    emotionalVector: { dreamy: 0.65, nostalgia: 0.52, energy: 0.72, cinematic: 0.75, darkness: 0.42, confidence: 0.65, intimacy: 0.60, danceability: 0.70, electronic: 0.62, acoustic: 0.25 } },
  { title: "Idol", artist: "YOASOBI", genres: ["J-pop", "anime"], language: "japanese",
    emotionalVector: { dreamy: 0.40, nostalgia: 0.25, energy: 0.90, cinematic: 0.72, darkness: 0.28, confidence: 0.88, intimacy: 0.35, danceability: 0.85, electronic: 0.70, acoustic: 0.10 } },
  { title: "Pretender", artist: "Official HIGE DANdism", genres: ["J-pop", "piano pop"], language: "japanese",
    emotionalVector: { dreamy: 0.68, nostalgia: 0.72, energy: 0.45, cinematic: 0.70, darkness: 0.40, confidence: 0.52, intimacy: 0.75, danceability: 0.40, electronic: 0.38, acoustic: 0.58 } },
  // ── Arabic ────────────────────────────────────────────────────────────────
  { title: "Nour El Ain", artist: "Amr Diab", genres: ["Arabic pop", "Mediterranean"], language: "arabic",
    emotionalVector: { dreamy: 0.62, nostalgia: 0.72, energy: 0.55, cinematic: 0.65, darkness: 0.15, confidence: 0.70, intimacy: 0.75, danceability: 0.65, electronic: 0.35, acoustic: 0.55 } },
  { title: "Tamally Maak", artist: "Amr Diab", genres: ["Arabic pop", "romantic"], language: "arabic",
    emotionalVector: { dreamy: 0.68, nostalgia: 0.60, energy: 0.35, cinematic: 0.60, darkness: 0.12, confidence: 0.52, intimacy: 0.85, danceability: 0.40, electronic: 0.30, acoustic: 0.65 } },
  { title: "Ya Tabtab", artist: "Fairuz", genres: ["Arabic classical", "folk"], language: "arabic",
    emotionalVector: { dreamy: 0.72, nostalgia: 0.90, energy: 0.22, cinematic: 0.75, darkness: 0.18, confidence: 0.50, intimacy: 0.78, danceability: 0.28, electronic: 0.05, acoustic: 0.88 } },
  // ── Uzbek ─────────────────────────────────────────────────────────────────
  { title: "Sog'inch", artist: "Ulug'bek Rahmatullayev", genres: ["Uzbek pop", "folk"], language: "uzbek",
    emotionalVector: { dreamy: 0.60, nostalgia: 0.85, energy: 0.25, cinematic: 0.65, darkness: 0.28, confidence: 0.48, intimacy: 0.80, danceability: 0.28, electronic: 0.15, acoustic: 0.82 } },
  { title: "Armon", artist: "Shahzoda", genres: ["Uzbek pop", "dance"], language: "uzbek",
    emotionalVector: { dreamy: 0.55, nostalgia: 0.60, energy: 0.60, cinematic: 0.52, darkness: 0.30, confidence: 0.65, intimacy: 0.60, danceability: 0.72, electronic: 0.55, acoustic: 0.35 } },
  { title: "Yolgizim", artist: "JABBOR", genres: ["Uzbek pop", "R&B"], language: "uzbek",
    emotionalVector: { dreamy: 0.65, nostalgia: 0.55, energy: 0.42, cinematic: 0.55, darkness: 0.38, confidence: 0.55, intimacy: 0.72, danceability: 0.50, electronic: 0.48, acoustic: 0.40 } },
  // ── French ────────────────────────────────────────────────────────────────
  { title: "Je veux", artist: "Zaz", genres: ["chanson", "jazz pop"], language: "french",
    emotionalVector: { dreamy: 0.42, nostalgia: 0.55, energy: 0.68, cinematic: 0.52, darkness: 0.10, confidence: 0.78, intimacy: 0.55, danceability: 0.72, electronic: 0.12, acoustic: 0.80 } },
  { title: "La Vie en Rose", artist: "Édith Piaf", genres: ["chanson", "classic"], language: "french",
    emotionalVector: { dreamy: 0.75, nostalgia: 0.95, energy: 0.25, cinematic: 0.85, darkness: 0.20, confidence: 0.58, intimacy: 0.82, danceability: 0.30, electronic: 0.02, acoustic: 0.90 } },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toLanguageKey(preference: string): string {
  // "Spanish / Latin" → "spanish", "No preference" → ""
  const lower = preference.toLowerCase().split(" /")[0].trim();
  return lower === "no preference" ? "" : lower;
}

function buildOrderedPool(language: string, excludeSet: Set<string>): SeedSong[] {
  const key = toLanguageKey(language);
  const available = SEED_POOL.filter((s) => !excludeSet.has(s.title.toLowerCase()));

  if (!key) return shuffle(available);

  const preferred = available.filter((s) => s.language === key);
  const english = available.filter((s) => s.language === "english");
  const rest = available.filter((s) => s.language !== key && s.language !== "english");

  // Preferred language songs first, then English fill, then others
  return [...shuffle(preferred), ...shuffle(english), ...shuffle(rest)];
}

async function fetchPreview(
  title: string,
  artist: string
): Promise<{ previewUrl: string | null; artwork: string | null }> {
  const term = encodeURIComponent(`${title} ${artist}`);
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&limit=5`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const results: Array<{ previewUrl?: string; artworkUrl100?: string }> = data.results ?? [];
    const match = results.find((r) => r.previewUrl) ?? results[0];
    if (!match) return { previewUrl: null, artwork: null };
    return {
      previewUrl: match.previewUrl ?? null,
      artwork: match.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    };
  } catch {
    return { previewUrl: null, artwork: null };
  }
}

async function resolveSongs(excludeTitles: string[], language = "") {
  const excludeSet = new Set(excludeTitles.map((t) => t.toLowerCase()));
  const ordered = buildOrderedPool(language, excludeSet);

  // Take enough candidates to get 10 with previews despite iTunes failures
  const candidates = ordered.slice(0, Math.min(ordered.length, 18));
  const resolved = await Promise.all(
    candidates.map(async (song) => {
      const { previewUrl, artwork } = await fetchPreview(song.title, song.artist);
      return { ...song, previewUrl, artwork };
    })
  );
  const withPreviews = resolved.filter((s) => s.previewUrl).slice(0, 10);
  const withoutPreviews = resolved.filter((s) => !s.previewUrl);
  return [...withPreviews, ...withoutPreviews].slice(0, 10);
}

export async function GET(req: NextRequest) {
  const language = req.nextUrl.searchParams.get("language") ?? "";
  const final = await resolveSongs([], language);
  return NextResponse.json(final);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : [];
  const language: string = typeof body.language === "string" ? body.language : "";
  const final = await resolveSongs(exclude, language);
  return NextResponse.json(final);
}
