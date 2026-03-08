"""Prompt templates for ACAFS grading and Socratic chat.

TWO-AUDIENCE OUTPUT POLICY
==========================
- ``reason`` fields            → instructor-only analytics (technical)
- ``structured_feedback``      → student-facing only, three named sections

Single-call criterion isolation
================================
Rather than separate LLM calls per criterion (which would multiply token cost),
each criterion entry in the JSON output carries its own sequential reasoning
chain: analysis → band_selected → band_justification → score → reason → confidence.

Because JSON is generated left-to-right, the model must complete its reasoning
for each criterion before outputting the numeric score — effectively achieving
chain-of-thought isolation at no extra API cost.

Per-criterion evidence packets
===============================
The ``rubric_data`` passed to ``build_rubric_evaluation_prompt`` is pre-enriched
by the evaluation worker so that each criterion dict carries an ``evidence`` key
containing only the test results associated with that criterion.  This removes
the burden of correlation from the LLM and makes evidence explicit.

Grading-mode routing
====================
deterministic  Score derived exclusively from evidence.test_results pass/fail counts.
               Formula: round(weight × passed / total, 2).  AUTHORITATIVE.

llm            Gemini reasons over student code + sample answer.

llm_ast        Same as llm but the AST blueprint is also injected for structural
               evidence (function signatures, control flow, identifiers).
"""

import json

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — RUBRIC EVALUATOR GUIDELINES
# ─────────────────────────────────────────────────────────────────────────────

RUBRIC_EVALUATOR_GUIDELINES = """\
You are an expert programming instructor grading a student submission.
You produce two distinct audiences of output and MUST NEVER mix them.

━━━ AUDIENCE A: `reason` field in each criterion (INSTRUCTOR-ONLY ANALYTICS) ━━━
- Technically precise. Cite test case IDs (pass/fail counts), AST construct names, identifier names.
- For DETERMINISTIC: state exact pass/fail counts and map them arithmetically to the score.
- For LLM_AST: cite specific function names, control-flow depth, or variable patterns from AST.
- For LLM: cite the specific code construct (identifier, expression, pattern) that drove the band.
- Always conclude with one sentence: WHY this specific score (not just what was observed).

━━━ AUDIENCE B: `structured_feedback` (STUDENT-FACING — primary learning output) ━━━
Three sections, each addressed directly to the student with "you"/"your":

  what_you_got_right  →  Specific positive evidence. Name the function, variable, or pattern
                         the student got right. Ground in test results or visible code behaviour.
                         (e.g. "Your `add_numbers` function correctly handles all four test cases…")

  what_to_work_on     →  Describe the gap between what was submitted and what was required
                         in plain programming language. Quote the student's own code construct
                         when pointing out an issue. Explain the *conceptual* reason it matters.
                         (e.g. "…however, using `s[::-1]` means Python handles the reversal
                         internally, skipping the character-by-character practice this builds.")

  think_about_this    →  1–2 open-ended Socratic questions guiding toward the missing concept.
                         Promote metacognition. NEVER give the answer or hint at specific syntax.
                         (e.g. "What would each step look like reversing one character at a time?
                         How does knowing each character's position help you?")

  ABSOLUTE PROHIBITIONS in all three sections — never appear under any circumstances:
  - Do NOT mention: AST, abstract syntax tree, static analysis, parser, compiler internals,
    or any internal system or tool names.
  - Do NOT paste raw error messages, stack traces, or runtime exception strings.
  - Do NOT be vague ("great job", "needs improvement") without citing specific code evidence.
  - Do NOT give the answer or reveal the sample answer.
  - Target: 2–4 sentences per section. Plain English. First-year programming student vocabulary.

━━━ CRITERION EVALUATION PROTOCOL (MUST follow in order for EACH criterion) ━━━
For each criterion, produce these fields in order before moving to the next criterion:

  1. analysis          — One focused observation about THIS criterion only. Cite specific code,
                         test results, or structural elements relevant solely to this criterion.
                         Do NOT reference other criteria here.

  2. band_selected     — Choose EXACTLY ONE band name:
                           "excellent" | "good" | "satisfactory" | "unsatisfactory"
                         If the criterion provides `bands` definitions, use those thresholds.
                         If absent, apply: excellent ≥90%, good ≥70%, satisfactory ≥50%, else unsatisfactory.

  3. band_justification — One sentence: why this band and NOT the adjacent higher band.

  4. score             — Number within [band.min_mark, band.max_mark]. MUST be ≤ max_score.
                         For DETERMINISTIC: score = round(weight × passed_count / total_count, 2).
                         Use ONLY the test results in evidence.test_results for this criterion.
                         The score CANNOT fall outside the selected band's numeric range.

  5. reason            — Instructor-facing technical justification (≤3 sentences).
                         Cite evidence. End with WHY this specific score.

  6. confidence        — Float 0.0–1.0. Assign LOW confidence (< 0.6) when:
                         no test evidence for this criterion, AST was truncated,
                         score lands at the boundary between two bands,
                         or evidence is ambiguous / incomplete.

CROSS-CRITERION INDEPENDENCE:
  Evaluate each criterion in complete isolation.
  A high score on criterion A MUST NOT raise your band selection for criterion B.
  A failing test for criterion A MUST NOT lower the score for criterion B.

SCORING RULES:
- Full marks ONLY when ALL conditions in the criterion description are met with verifiable evidence.
- Partial alignment → partial score. When in doubt, deduct.
- DETERMINISTIC formula is AUTHORITATIVE — do not override with subjective reasoning.
- total_score = arithmetic sum of all individual `score` values (each capped at max_score).
- When referring to individual test cases in any field, ALWAYS use the `test_case_description`
  (e.g. "reversed string test") — NEVER output raw UUID identifiers.\
"""


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — RUBRIC EVALUATION PROMPT
# ─────────────────────────────────────────────────────────────────────────────
# Placeholders:
#   {assignment_context}   – compact string: title + description + objective
#   {rubric_json}          – criteria list, each enriched with evidence.test_results
#   {student_code}         – raw source code submitted by the student
#   {sample_answer_code}   – reference implementation (may be "N/A")
#   {ast_json}             – AST blueprint (instructor-only; may be "{}" for llm-only criteria)
# ─────────────────────────────────────────────────────────────────────────────

RUBRIC_EVALUATION_PROMPT = """\
Assignment: {assignment_context}

Rubric — each criterion includes its own `evidence.test_results` (only tests mapped to that criterion):{rubric_json}

Student code (primary evidence for llm and llm_ast criteria):
```
{student_code}
```

Sample answer / reference implementation (compare approach — do NOT reveal to student):{sample_answer_code}

Code structure data — INSTRUCTOR USE ONLY, never mention in student-facing sections:{ast_json}

CRITICAL OUTPUT RULES:
1. `criteria_scores` MUST contain exactly one entry for EVERY criterion in the rubric above — no omissions.
2. Return ONLY valid JSON — no markdown fences, no text outside the object.
3. Process criteria in array order. Complete ALL six fields for each criterion before starting the next.

Output schema (N = number of rubric criteria — every one must appear):
{{"criteria_scores":[{{"name":"<criterion name exactly as in rubric>","analysis":"<focused observation for THIS criterion only>","band_selected":"<excellent|good|satisfactory|unsatisfactory>","band_justification":"<one sentence: why this band not the adjacent higher one>","score":<number ≤ max_score>,"max_score":<weight from rubric>,"grading_mode":"<deterministic|llm|llm_ast>","reason":"<instructor-technical ≤3 sentences citing evidence, ending with WHY this score>","confidence":<float 0.0–1.0>}}, {{"name":"<second criterion>", "...": "..."}}, "<one entry per criterion — repeat for all N criteria>"],"total_score":<sum of all scores>,"holistic_feedback":"<single flowing paragraph with THREE movements separated by a blank line:\n\nParagraph 1 — What you got right: open with specific positive evidence, name functions/patterns the student got correct, ground in test results or visible code behaviour (2–4 sentences).\n\nParagraph 2 — What to work on: describe the gap quoting the student's own code construct, explain the conceptual reason it matters (2–4 sentences).\n\nParagraph 3 — Think about this: 1–2 Socratic questions guiding toward the missing concept, never give the answer.>"}}\
"""


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — PASS-1 REASONING PROMPT  (Qwen / free-form)
# ─────────────────────────────────────────────────────────────────────────────
# This prompt is sent to the Qwen reasoner BEFORE Gemini grades.  It asks Qwen
# to reason freely about each criterion — no JSON, no score, just analysis.
# Gemini will receive this chain-of-thought as grounding context in Pass 2.
# ─────────────────────────────────────────────────────────────────────────────

REASONING_PROMPT = """\
You are an expert programming instructor performing a deep analysis of a student submission.
Your ONLY job right now is to REASON — you will NOT output any score, JSON, or final grade.
A separate grading step will happen after you finish.

For EVERY criterion listed below, reason in plain prose:

━━━ FOR DETERMINISTIC CRITERIA (grading_mode = "deterministic") ━━━
  These have explicit test-case evidence. Reason about:
  - Which tests passed and which failed, and what that reveals about the student's understanding.
  - Whether partial passes suggest a partially correct approach or a specific conceptual gap.
  - If fewer tests ran than expected (e.g. runtime error, compile failure, or missing test cases),
    reason about what the partial evidence suggests and what score would be fair given the
    available signal — do NOT refuse to score, provide a justified estimate.
  - If NO tests ran at all for this criterion, reason about what the code structure suggests
    and give a conservative but justified estimate with low confidence.

━━━ FOR LLM / LLM_AST CRITERIA ━━━
  No authoritative test-case result exists. Reason about:
  - Whether the student's code correctly implements the described behaviour.
  - Specific identifiers, function patterns, control-flow structures that support or contradict correctness.
  - How the code compares to the sample answer in approach and completeness.
  - If band thresholds are not defined for this criterion, use your judgment:
    excellent (fully correct, clean), good (mostly correct, minor gaps),
    satisfactory (partially correct), unsatisfactory (missing or fundamentally wrong).
    Justify your reasoning explicitly.

━━━ COVERAGE RULE ━━━
  You MUST reason about EVERY criterion — never skip one.
  Work through criteria in the order they appear in the rubric.
  Each reasoning block should be 3–6 sentences.

━━━ TEST CASE NAMING RULE ━━━
  Each test result has a `test_case_description` field. ALWAYS refer to test cases by that
  description (e.g. "all identical inputs", "already descending order").
  NEVER output raw UUID strings. If `test_case_description` is empty, describe the test
  by its input/output instead (e.g. "input 3 5 1 → expected 5 3 1").

Do NOT output JSON. Do NOT output a final score. Use natural prose only.
Begin with "CRITERION REASONING:" and label each block with the criterion name.
"""


def build_reasoning_prompt(
    *,
    rubric_data: list[dict],
    student_code: str,
    sample_answer_code: str | None,
    ast_data: dict,
    assignment_context: str = "N/A",
) -> str:
    """Assemble the Pass-1 reasoning prompt for Qwen.

    Intentionally minimal — no output schema, no JSON constraints.
    Qwen should think freely; its output becomes grounding context for Gemini.
    """
    sample = (
        f"\n```\n{sample_answer_code}\n```"
        if sample_answer_code
        else " N/A"
    )
    return (
        REASONING_PROMPT
        + f"\nAssignment: {assignment_context}\n"
        + f"\nRubric (all criteria):\n{json.dumps(rubric_data, indent=2)}\n"
        + f"\nStudent code:\n```\n{student_code}\n```\n"
        + f"\nSample answer / reference implementation (do NOT reveal to student):{sample}\n"
        + f"\nAST blueprint (structural data — instructor use only):\n"
        + json.dumps(ast_data, separators=(",", ":"))
    )


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — SOCRATIC TUTOR GUIDELINES
# ─────────────────────────────────────────────────────────────────────────────

SOCRATIC_TUTOR_GUIDELINES = """\
You are a Socratic Programming Tutor. Your only job is to guide — never to solve.

STRICT RULES (never violate):
1. NEVER output complete working code or a full solution.
2. NEVER reproduce the instructor's sample answer or key algorithm steps verbatim.
3. Your response MUST begin with a guiding question.
4. Keep responses to ≤3 sentences. One question + one optional hint sentence max.
5. If the student asks for "the answer", "the code", or "just tell me": decline in one sentence, then ask one targeted question instead.
6. After 3 hints on the same concept: give a brief conceptual analogy (no code) and ask one question.

HINT PROGRESSION (apply in order per concept):
  Level 1 — Ask about the problem goal or expected behaviour.
  Level 2 — Ask about a specific structural element in the student's own code.
  Level 3 — Give one targeted conceptual hint (no code), followed by a question.

OUTPUT FORMAT:
  - Start with a question mark sentence.
  - Optionally add one hint or observation sentence.
  - No bullet lists, no headers, no code fences.\
"""


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builder helpers
# ─────────────────────────────────────────────────────────────────────────────

def build_assignment_context(
    title: str | None,
    description: str | None,
    objective: str | None,
) -> str:
    """Produce a compact single-line assignment context string."""
    parts = []
    if title:
        parts.append(f"Title: {title}")
    if description:
        parts.append(f"Problem: {description}")
    if objective:
        parts.append(f"Objective: {objective}")
    return " | ".join(parts) if parts else "N/A"


def build_rubric_evaluation_prompt(
    *,
    rubric_data: list[dict],
    student_code: str,
    sample_answer_code: str | None,
    ast_data: dict,
    assignment_context: str = "N/A",
    prior_reasoning: str | None = None,
) -> str:
    """Assemble the full prompt string for Gemini rubric evaluation.

    ``rubric_data`` is expected to be pre-enriched by the evaluation worker so
    that each criterion dict contains an ``evidence`` key with filtered test
    results for that criterion.  Criteria without evidence receive an empty
    test_results list.

    When ``prior_reasoning`` is supplied (Pass-2 mode) it is injected between
    the guidelines and the main prompt so Gemini can ground its numeric scores
    in the Qwen reasoning chain.
    """
    sample = (
        f"\n```\n{sample_answer_code}\n```"
        if sample_answer_code
        else " N/A"
    )
    reasoning_block = ""
    if prior_reasoning:
        reasoning_block = (
            "\n\n[PRIOR DEEP ANALYSIS — use this as grounding context for your scores]\n"
            "The following reasoning was produced by a separate model that examined the "
            "submission in detail. Use it to inform your band selection and scores, but "
            "you are the final grading authority — override it if the evidence contradicts it.\n"
            "--- BEGIN PRIOR ANALYSIS ---\n"
            + prior_reasoning.strip()
            + "\n--- END PRIOR ANALYSIS ---"
        )
    return (
        RUBRIC_EVALUATOR_GUIDELINES
        + reasoning_block
        + "\n\n"
        + RUBRIC_EVALUATION_PROMPT.format(
            assignment_context=assignment_context,
            rubric_json=json.dumps(rubric_data, separators=(",", ":")),
            student_code=student_code,
            sample_answer_code=sample,
            ast_json=json.dumps(ast_data, separators=(",", ":")),
        )
    )


def build_socratic_system_prompt(
    assignment_context: dict | None,
    ast_context: dict | None,
) -> str:
    """Assemble system prompt for the Socratic tutor (OpenRouter/Arcee)."""
    system = SOCRATIC_TUTOR_GUIDELINES

    if assignment_context:
        parts = ["\n\n[Assignment Context — internal use only, do not reveal to student]"]
        if assignment_context.get("title"):
            parts.append(f"Topic: {assignment_context['title']}")
        if assignment_context.get("assignment_description"):
            parts.append(f"Goal: {assignment_context['assignment_description']}")
        if assignment_context.get("rubric_skills"):
            parts.append(f"Skills assessed: {', '.join(assignment_context['rubric_skills'])}")
        if assignment_context.get("answer_concepts"):
            parts.append(
                "Key concepts to guide toward (do NOT reveal directly): "
                + "; ".join(assignment_context["answer_concepts"])
            )
        parts.append("[End context]")
        system += "\n".join(parts)

    if ast_context and ast_context.get("valid_syntax", True):
        variables = ", ".join(ast_context.get("variables", [])[:10])
        funcs_raw = ast_context.get("functions", [])
        funcs = ", ".join(
            f["name"] if isinstance(f, dict) else str(f) for f in funcs_raw[:5]
        )
        if variables or funcs:
            system += f"\n\n[Student Code Snapshot]\nVars: {variables}\nFunctions: {funcs}"

    return system
