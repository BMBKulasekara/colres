import { action } from "./_generated/server.js";
import { api } from "./_generated/api.js";
import { v } from "convex/values";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

type SemanticScholarPaper = {
  paperId?: string;
  title?: string;
  url?: string;
  abstract?: string;
  authors?: { name?: string }[];
  year?: number;
  citationCount?: number;
};

type SemanticScholarResponse = {
  data?: SemanticScholarPaper[];
};

export const suggestPapers = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    // 1. Retrieve the document details
    const doc = await ctx.runQuery(api.documents.getDocumentById, { id: args.documentId });
    if (!doc) {
      throw new Error("Document not found");
    }

    const title = doc.title || "";
    const description = doc.description || "";

    if (!description && !title) {
      return [];
    }

    let queries: string[] = [];
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // 2. Generate optimized search queries using Gemini if API Key is available
    if (geminiApiKey) {
      try {
        const prompt = `You are an academic research assistant.
Based on the following document title and description, suggest up to 3 separate, highly targeted search queries (each 2-4 words) to find relevant research papers on Semantic Scholar.
Return ONLY a JSON array of strings, for example: ["machine learning privacy", "federated learning health"]. Do not include markdown code block formatting or explanations.

Document Title: ${title}
Document Description: ${description}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as GeminiResponse;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            let cleanText = text.trim();
            if (cleanText.startsWith("```")) {
              cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            }
            const parsed = JSON.parse(cleanText);
            if (Array.isArray(parsed)) {
              queries = parsed.map(String).slice(0, 3);
            }
          }
        } else {
          console.error("Gemini API call failed:", response.status, response.statusText);
        }
      } catch (err) {
        console.error("Error generating queries with Gemini API:", err);
      }
    }

    // Fallback if Gemini key is missing or query generation failed
    if (queries.length === 0) {
      // Use document title or description snippet directly as a search query
      const baseQuery = description ? description.substring(0, 100) : title;
      queries = [baseQuery];
    }

    // 3. Query Semantic Scholar Search API for each query queryStr
    const paperPromises = queries.map(async (queryStr) => {
      try {
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
          queryStr
        )}&limit=5&fields=title,url,abstract,authors,year,citationCount`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`Semantic Scholar search failed for query "${queryStr}":`, res.statusText);
          return [];
        }
        const data = (await res.json()) as SemanticScholarResponse;
        return data.data ?? [];
      } catch (err) {
        console.error(`Error fetching papers from Semantic Scholar for query "${queryStr}":`, err);
        return [];
      }
    });

    const results = await Promise.all(paperPromises);

    // 4. Flatten, Deduplicate and format results
    const seenIds = new Set<string>();
    const papers: {
      id: string;
      title: string;
      url: string;
      abstract: string;
      authors: string[];
      year: number;
      citationCount: number;
    }[] = [];

    for (const batch of results) {
      for (const item of batch) {
        if (item.paperId && !seenIds.has(item.paperId)) {
          seenIds.add(item.paperId);
          papers.push({
            id: item.paperId,
            title: item.title ?? "",
            url: item.url || `https://www.semanticscholar.org/paper/${item.paperId}`,
            abstract: item.abstract ?? "",
            authors: item.authors?.map((a) => a.name ?? "") ?? [],
            year: item.year ?? 0,
            citationCount: item.citationCount ?? 0,
          });
        }
      }
    }

    // Sort by citationCount (relevance/popularity) descending and return top 8
    papers.sort((a, b) => b.citationCount - a.citationCount);
    return papers.slice(0, 8);
  },
});
