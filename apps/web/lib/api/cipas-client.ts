import type {
  AssignmentClusterRequest,
  AssignmentClusterResponse,
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
  AnnotationResponse,
  AnnotationStatsResponse,
  SimilarityReportMetadata,
  AIDetectionRequest,
  AIDetectionResponse,
  SimilarityScoreRequest,
  SimilarityScoreResponse,
  CollusionEdge,
} from "@/types/cipas";
import type {
  UpdateSubmissionAnalysisRequest,
  BatchCodeRequest,
  BatchCodeResponse,
} from "@/types/assessments.types";
import { assessmentsApi } from "@/lib/api/assessments";
import { useAuthStore } from "@/lib/stores/authStore";

// Gateway URL builder (similar to keystroke.ts pattern)
const GATEWAY_URL = (() => {
  const raw =
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";
  // Strip trailing "/api/v1" or "/api/v1/" if present
  return raw.replace(/\/api\/v1\/?$/, "");
})();

// Direct gateway endpoints (no Next.js proxy)
const CLUSTER_ENDPOINT = `${GATEWAY_URL}/api/v1/syntactics/assignments/cluster`;
const REPORTS_ENDPOINT = `${GATEWAY_URL}/api/v1/syntactics/reports`;
const ANNOTATIONS_ENDPOINT = `${GATEWAY_URL}/api/v1/syntactics/annotations`;
const AI_DETECT_ENDPOINT = `${GATEWAY_URL}/api/v1/ai/detect`;
const SEMANTIC_SIMILARITY_ENDPOINT = `${GATEWAY_URL}/api/v1/semantics/similarity`;
const BATCH_CODE_ENDPOINT = `${GATEWAY_URL}/api/v1/submissions/batch/code`;

/**
 * Cluster all submissions for an assignment.
 * This runs the full CIPAS syntactic analysis pipeline.
 */
export async function clusterAssignment(
  request: AssignmentClusterRequest,
): Promise<AssignmentClusterResponse> {
  const res = await fetch(CLUSTER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `CIPAS request failed [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AssignmentClusterResponse>;
}

/**
 * Get a cached similarity report for an assignment.
 * Returns null if no report exists.
 */
export async function getSimilarityReport(
  assignmentId: string,
): Promise<AssignmentClusterResponse | null> {
  const res = await fetch(`${REPORTS_ENDPOINT}/${assignmentId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 404) {
    return null; // No cached report
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to fetch similarity report [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AssignmentClusterResponse>;
}

/**
 * Get metadata about a cached similarity report.
 */
export async function getSimilarityReportMetadata(
  assignmentId: string,
): Promise<SimilarityReportMetadata | null> {
  const res = await fetch(`${REPORTS_ENDPOINT}/${assignmentId}/metadata`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to fetch report metadata [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<SimilarityReportMetadata>;
}

/**
 * Create a new instructor annotation for a clone match or group.
 */
export async function createAnnotation(
  request: CreateAnnotationRequest,
): Promise<AnnotationResponse> {
  const res = await fetch(ANNOTATIONS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to create annotation [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AnnotationResponse>;
}

/**
 * Update an existing instructor annotation.
 */
export async function updateAnnotation(
  annotationId: string,
  request: UpdateAnnotationRequest,
): Promise<AnnotationResponse> {
  const res = await fetch(`${ANNOTATIONS_ENDPOINT}/${annotationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to update annotation [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AnnotationResponse>;
}

/**
 * Get all annotations for an assignment.
 */
export async function getAnnotations(
  assignmentId: string,
  status?: string,
): Promise<AnnotationResponse[]> {
  const url = new URL(
    `${ANNOTATIONS_ENDPOINT}/assignment/${assignmentId}`,
    window.location.origin,
  );

  if (status) {
    url.searchParams.set("status", status);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to fetch annotations [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AnnotationResponse[]>;
}

/**
 * Get annotation statistics for an assignment.
 */
export async function getAnnotationStats(
  assignmentId: string,
): Promise<AnnotationStatsResponse> {
  const res = await fetch(
    `${ANNOTATIONS_ENDPOINT}/assignment/${assignmentId}/stats`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to fetch annotation stats [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AnnotationStatsResponse>;
}

/**
 * Export a similarity report as CSV.
 * The backend only exposes GET /reports/{id}/export.csv — PDF is not yet supported.
 */
export async function exportSimilarityReport(
  assignmentId: string,
  _format: "pdf" | "csv" = "csv",
): Promise<Blob> {
  // Backend route: GET /api/v1/syntactics/reports/{assignment_id}/export.csv
  const res = await fetch(
    `${REPORTS_ENDPOINT}/${assignmentId}/export.csv`,
    {
      method: "GET",
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Failed to export report [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.blob();
}

/**
 * Detect AI-generated code likelihood.
 */
export async function detectAICode(code: string): Promise<AIDetectionResponse> {
  const res = await fetch(AI_DETECT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code } as AIDetectionRequest),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `AI detection failed [${res.status}]: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<AIDetectionResponse>;
}

/**
 * Batch detect AI likelihood for multiple submissions.
 * Returns a map of submission_id to AI detection result.
 */
export async function detectAICodeBatch(
  submissions: Array<{ submission_id: string; source_code: string }>,
): Promise<Record<string, AIDetectionResponse>> {
  const results: Record<string, AIDetectionResponse> = {};

  await Promise.all(
    submissions.map(async (sub) => {
      try {
        const result = await detectAICode(sub.source_code);
        results[sub.submission_id] = result;
      } catch (error) {
        console.error(`AI detection failed for ${sub.submission_id}:`, error);
      }
    }),
  );

  return results;
}

/**
 * Calculate semantic similarity between two code snippets.
 * Returns a score between 0 and 1, where 1 means identical.
 */
export async function getSemanticSimilarity(
  code1: string,
  code2: string,
): Promise<number> {
  const res = await fetch(SEMANTIC_SIMILARITY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code1, code2 } as SimilarityScoreRequest),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Semantic similarity failed [${res.status}]: ${detail || res.statusText}`,
    );
  }

  const result = (await res.json()) as SimilarityScoreResponse;
  return result.similarity_score;
}

/**
 * Save submission analysis results (AI detection, semantic similarity) for an assignment submission.
 * Persists to the submissions table via PATCH /api/v1/submissions/:id/analysis.
 * This is a best-effort operation - failures are logged but not thrown.
 */
export async function saveSubmissionAnalysis(
  submissionId: string,
  analysis: {
    ai_likelihood: number;
    human_likelihood: number;
    is_ai_generated: boolean;
    ai_confidence: number;
    semantic_similarity_score: number | null;
  },
): Promise<void> {
  try {
    const request: UpdateSubmissionAnalysisRequest = {
      ai_likelihood: analysis.ai_likelihood,
      human_likelihood: analysis.human_likelihood,
      is_ai_generated: analysis.is_ai_generated,
      ai_confidence: analysis.ai_confidence,
      semantic_similarity_score: analysis.semantic_similarity_score,
    };

    await assessmentsApi.updateSubmissionAnalysis(submissionId, request);
  } catch (error) {
    console.error(
      `Failed to save analysis for submission ${submissionId}:`,
      error,
    );
    // Don't throw - this is best-effort
  }
}

/**
 * Fetch source code for multiple submissions in a single batch request.
 * Used by cluster diff viewer to avoid N+1 queries.
 * Returns a map of submission_id → SubmissionCodeResponse.
 * Falls back to parallel individual fetches if the batch endpoint is unavailable.
 */
export async function getBatchSubmissionCode(
  submissionIds: string[],
): Promise<Record<string, import("@/types/assessments.types").SubmissionCodeResponse>> {
  if (submissionIds.length === 0) {
    return {};
  }

  // Include Bearer token — the assessment service requires auth.
  // The token lives in-memory (Zustand) so we read it directly here,
  // mirroring what axiosInstance's request interceptor does.
  const token = useAuthStore.getState().accessToken;
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  try {
    const res = await fetch(BATCH_CODE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: JSON.stringify({ submission_ids: submissionIds } as BatchCodeRequest),
    });

    if (!res.ok) {
      throw new Error(`Batch code fetch failed [${res.status}]`);
    }

    const result = (await res.json()) as BatchCodeResponse;
    return result.codes;
  } catch {
    // Batch endpoint unavailable — fall back to parallel individual fetches
    // via the authenticated axiosInstance to guarantee auth always works.
    const entries = await Promise.all(
      submissionIds.map(async (id) => {
        try {
          const codeRes = await assessmentsApi.getSubmissionCode(id);
          return [id, codeRes] as const;
        } catch {
          return null;
        }
      }),
    );
    return Object.fromEntries(
      entries.filter((e): e is [string, import("@/types/assessments.types").SubmissionCodeResponse] => e !== null),
    );
  }
}

const XAI_CHAT_ENDPOINT = `${GATEWAY_URL}/api/v1/xai/chat`;
const XAI_STREAM_ENDPOINT = `${GATEWAY_URL}/api/v1/xai/chat/stream`;

/**
 * Stream an XAI explanation for a detected clone pair.
 * Calls the CIPAS XAI service (no auth required) and yields text deltas.
 * The caller should iterate the returned async generator to build the explanation.
 *
 * @param codeA   source code of the first submission
 * @param codeB   source code of the second submission
 * @param edge    the CollusionEdge describing the detected clone
 */
export async function* streamCloneExplanation(
  codeA: string,
  codeB: string,
  edge: CollusionEdge,
): AsyncGenerator<string> {
  const systemPrompt = `You are an expert in academic code plagiarism detection and software engineering education. \
You analyse pairs of student code submissions that have been flagged as similar by CIPAS (Code Intelligence \
Plagiarism Analysis System) and produce clear, structured explanations for instructors. Be specific about \
matching patterns. Do not repeat the code verbatim; refer to specific constructs by name.`;

  const userPrompt =
    `Two student submissions were flagged by CIPAS:\n\n` +
    `Detection result:\n` +
    `- Clone Type: ${edge.clone_type}\n` +
    `- Confidence: ${Math.round(edge.confidence * 100)}%\n` +
    `- Matching code fragments: ${edge.match_count}\n\n` +
    `--- Submission A ---\n\`\`\`python\n${codeA}\n\`\`\`\n\n` +
    `--- Submission B ---\n\`\`\`python\n${codeB}\n\`\`\`\n\n` +
    `Please provide a structured analysis with these sections:\n` +
    `1. **Clone Type Explanation** — what ${edge.clone_type} means in this context.\n` +
    `2. **Matching Patterns** — identify 2-4 specific structural or lexical patterns that triggered the detection.\n` +
    `3. **Key Similar Sections** — point out the most similar blocks by class/function name.\n` +
    `4. **Educational Assessment** — assess whether this likely represents independent work, inspired-by-but-rewritten, or direct copying.\n` +
    `5. **Recommendation** — suggest whether further investigation is warranted and what evidence to request.`;

  const body = JSON.stringify({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  let res: Response;
  try {
    res = await fetch(XAI_STREAM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    // XAI service unavailable — fall back to non-streaming endpoint
    const fallback = await fetch(XAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!fallback.ok) {
      throw new Error(`XAI service unavailable [${fallback.status}]`);
    }
    const data = (await fallback.json()) as { content?: string };
    yield data.content ?? "";
    return;
  }

  if (!res.ok) {
    throw new Error(`XAI request failed [${res.status}]`);
  }

  // Parse SSE stream: each line is `data: { content, done }` JSON
  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      try {
        const chunk = JSON.parse(jsonStr) as { content?: string; done?: boolean };
        if (chunk.content) yield chunk.content;
        if (chunk.done) return;
      } catch {
        // malformed chunk — skip
      }
    }
  }
}
