import type {
  BuiltSegmentGraph,
  CloneType,
  ExplainMetrics,
  RawSubmission,
  SegmentEdgeModel,
  SegmentNodeModel,
  StudentProfile,
  SubmissionCluster,
} from "./types";

function hashPair(a: string, b: string): number {
  const s = a < b ? `${a}|${b}` : `${b}|${a}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function edgeConfidence(sourceId: string, targetId: string, t: CloneType): number {
  const h = hashPair(sourceId, targetId);
  const base = t === 1 ? 0.93 : t === 2 ? 0.76 : 0.6;
  const jitter = (h % 600) / 10000;
  return Math.min(0.99, Math.round((base + jitter) * 1000) / 1000);
}

export function explainMetricsForPair(
  codeA: string,
  codeB: string,
  t: CloneType,
): ExplainMetrics {
  const maxL = Math.max(codeA.length, codeB.length, 1);
  const lenRatio = 1 - Math.abs(codeA.length - codeB.length) / maxL;
  const bump = Math.round(lenRatio * 8);
  if (t === 1) {
    return {
      token_similarity_pct: Math.min(99, 94 + bump),
      ast_similarity_pct: Math.min(99, 91 + bump),
      control_flow_similarity_pct: Math.min(99, 88 + bump),
    };
  }
  if (t === 2) {
    return {
      token_similarity_pct: Math.min(96, 76 + bump),
      ast_similarity_pct: Math.min(96, 82 + bump),
      control_flow_similarity_pct: Math.min(96, 79 + bump),
    };
  }
  return {
    token_similarity_pct: Math.min(92, 58 + bump),
    ast_similarity_pct: Math.min(92, 71 + bump),
    control_flow_similarity_pct: Math.min(92, 74 + bump),
  };
}

export function humanCloneReason(t: CloneType): string {
  if (t === 1) return "Near-identical token sequence — consistent with Type 1 (exact / copy-paste).";
  if (t === 2)
    return "Same structure with systematic identifier renaming — consistent with Type 2.";
  return "Equivalent control flow with surface variation — consistent with Type 3 (logic-level similarity).";
}

export function aiStyleExplanation(codeA: string, codeB: string, t: CloneType): string {
  const simShort =
    codeA.slice(0, 48).replace(/\s+/g, " ") + (codeA.length > 48 ? "…" : "");
  const simShortB =
    codeB.slice(0, 48).replace(/\s+/g, " ") + (codeB.length > 48 ? "…" : "");
  if (t === 1) {
    return `These snippets align almost lexically (“${simShort}” vs “${simShortB}”), which strongly suggests a Type 1 clone (direct duplication).`;
  }
  if (t === 2) {
    return `Both segments implement the same loop and guard pattern with different local names — typical of a Type 2 renamed clone.`;
  }
  return `The branching and iteration skeleton match while literals or identifiers differ — indicative of Type 3 structural / logic similarity.`;
}

function parseSubmissionIndex(submissionId: string): number {
  const m = /^S(\d+)$/.exec(submissionId);
  return m ? parseInt(m[1], 10) : 0;
}

export function enrichProfiles(raw: RawSubmission[]): Map<string, StudentProfile> {
  const map = new Map<string, StudentProfile>();
  const base = Date.parse("2026-03-01T09:00:00Z");
  for (const sub of raw) {
    const n = parseSubmissionIndex(sub.submission_id);
    const student_id = `STU-${String(n).padStart(3, "0")}`;
    const name = `Student ${n} (Top Hill)`;
    map.set(sub.submission_id, {
      student_id,
      submission_id: sub.submission_id,
      name,
      avatar_seed: name,
      submitted_at: new Date(base + n * 3600000 * 3).toISOString(),
      past_similarity_flags: (n * 7) % 4,
    });
  }
  return map;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Simple label-propagation communities on undirected adjacency. */
function detectCommunities(nodeIds: string[], undirectedEdges: Array<[string, string]>): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const [a, b] of undirectedEdges) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }

  const labels = new Map(nodeIds.map((id) => [id, id]));

  for (let iter = 0; iter < 24; iter++) {
    const order = seededShuffle(nodeIds, 14695981039346656037 % 4294967291 + iter * 997);
    for (const id of order) {
      const neigh = adj.get(id) || [];
      if (neigh.length === 0) continue;
      const counts = new Map<string, number>();
      for (const n of neigh) {
        const lab = labels.get(n)!;
        counts.set(lab, (counts.get(lab) || 0) + 1);
      }
      let bestLab = labels.get(id)!;
      let bestC = -1;
      for (const [lab, c] of counts) {
        if (c > bestC || (c === bestC && lab < bestLab)) {
          bestC = c;
          bestLab = lab;
        }
      }
      labels.set(id, bestLab);
    }
  }

  const uniq = [...new Set(labels.values())].sort();
  const remap = new Map(uniq.map((lab, i) => [lab, i]));
  const out = new Map<string, number>();
  for (const id of nodeIds) out.set(id, remap.get(labels.get(id)!)!);
  return out;
}

export function buildSegmentGraph(raw: RawSubmission[]): BuiltSegmentGraph {
  const segmentById = new Map<
    string,
    { submission_id: string; segment: RawSubmission["segments"][0] }
  >();
  const submissionOrder = new Map<string, number>();

  raw.forEach((sub, idx) => {
    submissionOrder.set(sub.submission_id, idx);
    for (const seg of sub.segments) {
      segmentById.set(seg.segment_id, { submission_id: sub.submission_id, segment: seg });
    }
  });

  const profilesBySubmission = enrichProfiles(raw);
  const profilesByStudent = new Map<string, StudentProfile>();
  for (const p of profilesBySubmission.values()) profilesByStudent.set(p.student_id, p);

  const edgeKeySet = new Set<string>();
  const edges: SegmentEdgeModel[] = [];

  for (const sub of raw) {
    for (const seg of sub.segments) {
      for (const otherId of seg.clones_with) {
        const a = seg.segment_id;
        const b = otherId;
        if (!segmentById.has(b)) continue;
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        if (edgeKeySet.has(key)) continue;
        edgeKeySet.add(key);
        const t = seg.clone_type as CloneType;
        edges.push({
          id: key,
          source_id: a,
          target_id: b,
          clone_type: t,
          confidence: edgeConfidence(a, b, t),
        });
      }
    }
  }

  const nodes: SegmentNodeModel[] = [];
  const undirected: Array<[string, string]> = edges.map((e) => [e.source_id, e.target_id]);

  for (const sub of raw) {
    for (const seg of sub.segments) {
      const prof = profilesBySubmission.get(sub.submission_id)!;
      nodes.push({
        id: seg.segment_id,
        segment_id: seg.segment_id,
        submission_id: sub.submission_id,
        student_id: prof.student_id,
        code: seg.code,
        dominant_clone_type: seg.clone_type as CloneType,
        community_id: 0,
        submission_order: submissionOrder.get(sub.submission_id) ?? 0,
      });
    }
  }

  const communityOfSegment = detectCommunities(
    nodes.map((n) => n.id),
    undirected,
  );
  nodes.forEach((n) => {
    n.community_id = communityOfSegment.get(n.id) ?? 0;
  });

  const explainCache = new Map<string, ExplainMetrics>();
  for (const e of edges) {
    const sa = segmentById.get(e.source_id)!.segment;
    const sb = segmentById.get(e.target_id)!.segment;
    explainCache.set(
      e.id,
      explainMetricsForPair(sa.code, sb.code, e.clone_type),
    );
  }

  const studentRisk = new Map<string, { score: number; label: string }>();
  const crossTypeWeight = { 1: 3, 2: 2, 3: 1 } as const;
  const agg = new Map<string, { w: number; peers: Set<string> }>();

  for (const n of nodes) {
    if (!agg.has(n.student_id)) agg.set(n.student_id, { w: 0, peers: new Set() });
  }
  for (const n of nodes) {
    const bucket = agg.get(n.student_id)!;
    for (const e of edges) {
      if (e.source_id !== n.id && e.target_id !== n.id) continue;
      const other = e.source_id === n.id ? e.target_id : e.source_id;
      const osub = segmentById.get(other)!.submission_id;
      if (osub === n.submission_id) continue;
      bucket.peers.add(osub);
      bucket.w += crossTypeWeight[e.clone_type] * e.confidence;
    }
  }
  for (const [student_id, bucket] of agg) {
    const score = Math.min(100, Math.round((bucket.w / Math.max(1, bucket.peers.size)) * 14));
    let label = "Low";
    if (score >= 68) label = "High";
    else if (score >= 38) label = "Elevated";
    studentRisk.set(student_id, { score, label });
  }

  const communitySuspicion = new Map<number, { level: number; label: string }>();
  const commCross = new Map<number, { t12: number; total: number }>();
  for (const e of edges) {
    const sa = segmentById.get(e.source_id)!.submission_id;
    const sb = segmentById.get(e.target_id)!.submission_id;
    if (sa === sb) continue;
    const ca = communityOfSegment.get(e.source_id)!;
    const cb = communityOfSegment.get(e.target_id)!;
    if (ca !== cb) continue;
    if (!commCross.has(ca)) commCross.set(ca, { t12: 0, total: 0 });
    const o = commCross.get(ca)!;
    o.total++;
    if (e.clone_type === 1 || e.clone_type === 2) o.t12++;
  }
  for (const [k, v] of commCross) {
    const ratio = v.t12 / Math.max(1, v.total);
    const level = Math.min(100, Math.round(ratio * 100 + v.total * 4));
    let label = "Low";
    if (level >= 72) label = "High";
    else if (level >= 45) label = "Medium";
    communitySuspicion.set(k, { level, label });
  }

  const submissionClusters = computeSubmissionClusters(raw, edges, segmentById);

  return {
    nodes,
    edges,
    profilesBySubmission,
    profilesByStudent,
    studentRisk,
    communitySuspicion,
    submissionClusters,
    explainCache,
  };
}

function computeSubmissionClusters(
  raw: RawSubmission[],
  edges: SegmentEdgeModel[],
  segmentById: Map<string, { submission_id: string }>,
): SubmissionCluster[] {
  const subs = raw.map((r) => r.submission_id);
  const parent = new Map(subs.map((s) => [s, s]));

  function find(x: string): string {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  }

  for (const e of edges) {
    const sa = segmentById.get(e.source_id)!.submission_id;
    const sb = segmentById.get(e.target_id)!.submission_id;
    if (sa === sb) continue;
    union(sa, sb);
  }

  const groups = new Map<string, string[]>();
  for (const s of subs) {
    const r = find(s);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(s);
  }

  let cid = 0;
  const out: SubmissionCluster[] = [];
  for (const [, members] of groups) {
    const cross_edge_count = edges.filter((e) => {
      const sa = segmentById.get(e.source_id)!.submission_id;
      const sb = segmentById.get(e.target_id)!.submission_id;
      if (sa === sb) return false;
      return members.includes(sa) && members.includes(sb);
    }).length;

    const t12 = edges.filter((e) => {
      const sa = segmentById.get(e.source_id)!.submission_id;
      const sb = segmentById.get(e.target_id)!.submission_id;
      if (sa === sb || !members.includes(sa) || !members.includes(sb)) return false;
      return e.clone_type === 1 || e.clone_type === 2;
    }).length;

    let suspicion: SubmissionCluster["suspicion"] = "low";
    if (members.length >= 3 && t12 >= 4) suspicion = "high";
    else if (members.length >= 2 && t12 >= 2) suspicion = "medium";

    out.push({
      id: cid++,
      submission_ids: members.sort((a, b) => parseSubmissionIndex(a) - parseSubmissionIndex(b)),
      cross_edge_count,
      suspicion,
    });
  }

  out.sort((a, b) => b.submission_ids.length - a.submission_ids.length);
  return out;
}

export function submissionNeighborhood(
  submissionId: string,
  edges: SegmentEdgeModel[],
  segmentById: Map<string, { submission_id: string }>,
): Set<string> {
  const segIds = new Set<string>();
  for (const e of edges) {
    const sa = segmentById.get(e.source_id)!.submission_id;
    const sb = segmentById.get(e.target_id)!.submission_id;
    if (sa === submissionId) segIds.add(e.source_id);
    if (sb === submissionId) segIds.add(e.target_id);
    if (sa === submissionId) segIds.add(e.target_id);
    if (sb === submissionId) segIds.add(e.source_id);
  }
  return segIds;
}

export function egoNetwork(
  seedSegmentIds: Set<string>,
  edges: SegmentEdgeModel[],
  hops: number,
): Set<string> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source_id)) adj.set(e.source_id, new Set());
    if (!adj.has(e.target_id)) adj.set(e.target_id, new Set());
    adj.get(e.source_id)!.add(e.target_id);
    adj.get(e.target_id)!.add(e.source_id);
  }

  let frontier = new Set(seedSegmentIds);
  const seen = new Set(seedSegmentIds);
  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const n of adj.get(id) || []) {
        if (!seen.has(n)) {
          seen.add(n);
          next.add(n);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }
  return seen;
}
