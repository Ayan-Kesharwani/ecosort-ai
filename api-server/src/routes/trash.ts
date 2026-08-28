import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { trashAnalyses } from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://trashscan.ai",
    "X-Title": "TrashScan AI",
  },
});

const VISION_MODEL_ATTEMPTS = [
  // Gemini 3.7 Flash is the best fit here: current, multimodal, and fast.
  { model: "google/gemini-3.7-flash", timeoutMs: 30_000 },
  // GPT-5.6 Luna is a strong, low-cost multimodal fallback on OpenRouter.
  { model: "openai/gpt-5.6-luna", timeoutMs: 30_000 },
  // Keep one free fallback for times when the account has no paid balance.
  { model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", timeoutMs: 18_000 },
] as const;

const TRASH_SYSTEM_PROMPT = `You are a trash classification AI. Analyze the image and respond with ONLY a JSON object — no markdown, no explanation.

The JSON must have exactly this structure:
{
  "items": [
    {
      "name": "plastic water bottle",
      "category": "plastic",
      "recyclable": true,
      "handlingInstructions": "Empty it, rinse with water, put in the recycling bin.",
      "confidence": 0.9,
      "zoneHint": "top-left",
      "binCategory": "Recycling",
      "boundingBox": { "x": 10, "y": 5, "width": 20, "height": 30 }
    }
  ],
  "summary": "Plain English 2-3 sentence summary of what trash is in the image.",
  "recyclableZones": "Which areas of the image contain recyclable items.",
  "nonRecyclableZones": "Which areas contain non-recyclable items.",
  "overallRecyclablePercent": 70,
  "cleaningDriveGuide": "How volunteers should sort this pile safely.",
  "smartBinGuide": "Which bins each item type goes in."
}

Rules:
- "items" MUST be an array — list every visible trash item separately.
- If any trash is visible, "items" must not be empty. Never return an empty list for a visible pile.
- "category" must be one of: plastic, metal, paper, glass, organic, electronic, hazardous, other
- "boundingBox" values are percentages of image dimensions (0-100). x,y = top-left corner. Estimate if unsure — never omit.
- Respond with ONLY the JSON object. No other text.`;

type BoundingBox = { x: number; y: number; width: number; height: number };

type TrashItem = {
  name: string;
  category: string;
  recyclable: boolean;
  handlingInstructions: string;
  confidence: number;
  zoneHint: string | null;
  binCategory: string;
  boundingBox: BoundingBox | null;
};

type AIResponse = {
  items: TrashItem[];
  summary: string;
  recyclableZones: string;
  nonRecyclableZones: string;
  overallRecyclablePercent: number;
  cleaningDriveGuide: string;
  smartBinGuide: string;
};

router.post("/trash/analyze", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const dataUri = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: TRASH_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUri, detail: "low" } },
          { type: "text", text: "Analyze all trash items in this image. Respond with JSON only." },
        ],
      },
    ];

    let completion: OpenAI.ChatCompletion | null = null;
    let lastError: Error | null = null;

    for (const attempt of VISION_MODEL_ATTEMPTS) {
      if (req.aborted) break;

      const modelAbort = new AbortController();
      const abortModel = () => modelAbort.abort();
      const timeoutId = setTimeout(abortModel, attempt.timeoutMs);
      req.once("aborted", abortModel);

      try {
        req.log.info({ model: attempt.model }, "Trying vision model");
        const candidate = await openai.chat.completions.create({
          model: attempt.model,
          // The Nemotron model uses part of its token budget for reasoning.
          // A smaller limit can produce a successful HTTP response with no
          // visible JSON content.
          max_tokens: 8192,
          messages,
          response_format: { type: "json_object" },
        }, {
          signal: modelAbort.signal,
          timeout: attempt.timeoutMs + 1_000,
        });

        const candidateContent = candidate.choices?.[0]?.message?.content;
        if (typeof candidateContent !== "string" || candidateContent.trim() === "") {
          throw new Error("Vision model returned an empty response");
        }

        completion = candidate;
        req.log.info({ model: attempt.model }, "Model succeeded");
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (req.aborted) break;
        req.log.warn(
          { model: attempt.model, err: lastError.message },
          "Model failed, trying next",
        );
      } finally {
        clearTimeout(timeoutId);
        req.off("aborted", abortModel);
      }
    }

    if (req.aborted) return;

    if (!completion) {
      req.log.error(
        { err: lastError, modelCount: VISION_MODEL_ATTEMPTS.length },
        "All vision models failed or timed out",
      );
      res.status(500).json({
        error:
          "The vision service is busy right now. Please wait a few seconds and try the analysis again.",
      });
      return;
    }

    const rawContent = completion.choices?.[0]?.message?.content ?? "";
    req.log.info({ raw: rawContent.slice(0, 800) }, "Raw AI response");

    // Robustly extract JSON: find outermost { ... } even if there's surrounding text or code fences
    function extractJson(text: string): string {
      // Remove code fences
      const stripped = text.replace(/```(?:json)?/gi, "").trim();
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) return "{}";
      return stripped.slice(start, end + 1);
    }

    const raw = extractJson(rawContent);
    if (raw === "{}") {
      req.log.error("AI response did not contain a JSON object");
      res.status(500).json({
        error:
          "The vision service returned an incomplete result. Please try the analysis again.",
      });
      return;
    }

    let parsed: AIResponse;
    try {
      parsed = JSON.parse(raw) as AIResponse;
    } catch {
      req.log.error({ raw: raw.slice(0, 500) }, "AI returned invalid JSON");
      res.status(500).json({ error: `AI returned unparseable response: ${raw.slice(0, 200)}` });
      return;
    }
    // Normalise: some models use alternate key names for the items array
    const items = parsed.items ?? (parsed as Record<string, unknown>)["detectedItems"] ?? (parsed as Record<string, unknown>)["trash_items"] ?? (parsed as Record<string, unknown>)["detected_items"] ?? [];
    parsed.items = items as TrashItem[];
    req.log.info({ itemCount: parsed.items.length }, "Parsed item count");

    const [saved] = await db
      .insert(trashAnalyses)
      .values({
        summary: parsed.summary ?? "",
        recyclableZones: parsed.recyclableZones ?? "",
        nonRecyclableZones: parsed.nonRecyclableZones ?? "",
        overallRecyclablePercent: parsed.overallRecyclablePercent ?? 0,
        cleaningDriveGuide: parsed.cleaningDriveGuide ?? null,
        smartBinGuide: parsed.smartBinGuide ?? null,
        imageBase64: imageBase64.length > 500000 ? null : imageBase64,
        items: parsed.items ?? [],
      })
      .returning();

    res.json({
      id: saved.id,
      items: parsed.items ?? [],
      summary: parsed.summary ?? "",
      recyclableZones: parsed.recyclableZones ?? "",
      nonRecyclableZones: parsed.nonRecyclableZones ?? "",
      overallRecyclablePercent: parsed.overallRecyclablePercent ?? 0,
      cleaningDriveGuide: parsed.cleaningDriveGuide ?? null,
      smartBinGuide: parsed.smartBinGuide ?? null,
      imageBase64: imageBase64,
      createdAt: saved.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error analyzing trash");
    const message = err instanceof Error ? err.message : "Failed to analyze image";
    res.status(500).json({ error: message });
  }
});

router.get("/trash/history", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: trashAnalyses.id,
        summary: trashAnalyses.summary,
        overallRecyclablePercent: trashAnalyses.overallRecyclablePercent,
        items: trashAnalyses.items,
        createdAt: trashAnalyses.createdAt,
      })
      .from(trashAnalyses)
      .orderBy(desc(trashAnalyses.createdAt))
      .limit(20);

    res.json(
      rows.map((r) => ({
        id: r.id,
        summary: r.summary,
        overallRecyclablePercent: r.overallRecyclablePercent,
        itemCount: Array.isArray(r.items) ? (r.items as unknown[]).length : 0,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching history");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.get("/trash/history/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [row] = await db
      .select()
      .from(trashAnalyses)
      .where(sql`${trashAnalyses.id} = ${id}`)
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    res.json({
      id: row.id,
      items: row.items,
      summary: row.summary,
      recyclableZones: row.recyclableZones,
      nonRecyclableZones: row.nonRecyclableZones,
      overallRecyclablePercent: row.overallRecyclablePercent,
      cleaningDriveGuide: row.cleaningDriveGuide,
      smartBinGuide: row.smartBinGuide,
      imageBase64: row.imageBase64,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching analysis");
    res.status(500).json({ error: "Failed to fetch analysis" });
  }
});

router.get("/trash/stats", async (req, res) => {
  try {
    const rows = await db.select().from(trashAnalyses);

    const totalAnalyses = rows.length;
    let totalItems = 0;
    let recyclableSum = 0;
    const categoryCounts: Record<string, number> = {};

    for (const row of rows) {
      const items = (row.items as TrashItem[]) ?? [];
      totalItems += items.length;
      recyclableSum += row.overallRecyclablePercent;
      for (const item of items) {
        categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
      }
    }

    res.json({
      totalAnalyses,
      totalItemsDetected: totalItems,
      avgRecyclablePercent: totalAnalyses > 0 ? recyclableSum / totalAnalyses : 0,
      categoryBreakdown: Object.entries(categoryCounts).map(([category, count]) => ({
        category,
        count,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
