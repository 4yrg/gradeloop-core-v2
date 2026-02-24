"""
Performance benchmark harness for the CIPAS Syntactic Normalisation Pipeline (E10/US02).

Target SLO
───────────
≤ 100ms wall-clock per 500 LOC granule (full Type-1 + Type-2 pipeline,
excluding Redis I/O, measured on a single synchronous call to
run_normalization_worker() without executor round-trip overhead).

What is benchmarked
────────────────────
run_normalization_worker() from cipas.normalization.type2 — the exact function
submitted to ProcessPoolExecutor in production.  Benchmarking it directly
avoids IPC serialisation overhead so the measurement isolates pure CPU cost:
  CST stripping  +  pretty-printing  +  canonicalisation  +  SHA-256 hashing.

Note on pretty-printer latency
──────────────────────────────
If black / google-java-format / clang-format are not installed in the test
environment, PrettyPrinter falls back to stripped text and the benchmark
measures stripped-text hashing only.  The SLO still applies: stripping +
hashing must be ≤ 100ms at 500 LOC.

Pytest-benchmark integration
──────────────────────────────
pytest-benchmark (^4.0.0) is used for statistical timing.  Each benchmark
is wrapped with benchmark.pedantic() for warm-up rounds and min-rounds control.
Run with:
    pytest tests/benchmarks/test_normalization_perf.py -v --benchmark-sort=mean

Individual timing assertions (assert elapsed < 0.100) are included as hard
failure gates for CI pipelines that do not use pytest-benchmark.

Fixtures
─────────
_python_500loc   — ~500-line Python function with nested loops, classes,
                   docstrings, and comments.
_java_500loc     — ~500-line Java class with methods, comments, Javadoc.
_c_500loc        — ~500-line C translation unit with structs, functions,
                   comments, and block comments.
"""

from __future__ import annotations

import time
from typing import Any

import pytest

from cipas.normalization.type1 import run_type1_direct
from cipas.normalization.type2 import run_normalization_worker, run_type2_direct

# ---------------------------------------------------------------------------
# Source fixtures — approximately 500 LOC each
# ---------------------------------------------------------------------------


def _make_python_500loc() -> bytes:
    """
    Generate a ~500-line Python source string covering:
      - Module docstring
      - Module-level comments
      - Import statements
      - Constants
      - A dataclass
      - Three standalone functions with docstrings and inline comments
      - A class with class-level docstring, __init__, and multiple methods
      - Nested loops, conditionals, list comprehensions
    """
    lines: list[str] = []

    # Module docstring + comments
    lines.append('"""Matrix computation utilities for academic grading."""')
    lines.append("")
    lines.append("# Standard library imports")
    lines.append("import math")
    lines.append("import hashlib")
    lines.append("from typing import List, Optional, Dict, Tuple")
    lines.append("from dataclasses import dataclass, field")
    lines.append("")
    lines.append("# Constants")
    lines.append("MAX_STUDENTS = 500")
    lines.append("MIN_SCORE = 0.0")
    lines.append("MAX_SCORE = 100.0")
    lines.append("PASS_THRESHOLD = 50.0")
    lines.append("DISTINCTION_THRESHOLD = 75.0")
    lines.append('DEFAULT_COURSE = "CS101"')
    lines.append("")

    # Dataclass
    lines.append("")
    lines.append("@dataclass")
    lines.append("class StudentRecord:")
    lines.append('    """Immutable record of a single student\'s submission."""')
    lines.append("    student_id: str")
    lines.append("    name: str")
    lines.append("    scores: List[float] = field(default_factory=list)")
    lines.append("    course: str = DEFAULT_COURSE")
    lines.append("    is_enrolled: bool = True")
    lines.append("")
    lines.append("    def average_score(self) -> float:")
    lines.append('        """Return the arithmetic mean of all scores."""')
    lines.append("        # Guard against empty score list")
    lines.append("        if not self.scores:")
    lines.append("            return 0.0")
    lines.append("        return sum(self.scores) / len(self.scores)")
    lines.append("")
    lines.append("    def is_passing(self) -> bool:")
    lines.append(
        '        """Return True if the average score meets the pass threshold."""'
    )
    lines.append("        return self.average_score() >= PASS_THRESHOLD")
    lines.append("")
    lines.append("    def grade_letter(self) -> str:")
    lines.append('        """Convert average score to a letter grade."""')
    lines.append("        avg = self.average_score()")
    lines.append("        if avg >= DISTINCTION_THRESHOLD:")
    lines.append('            return "A"')
    lines.append("        elif avg >= 65.0:")
    lines.append('            return "B"')
    lines.append("        elif avg >= PASS_THRESHOLD:")
    lines.append('            return "C"')
    lines.append("        else:")
    lines.append('            return "F"')
    lines.append("")

    # Three standalone functions
    lines.append("")
    lines.append("def compute_cohort_statistics(")
    lines.append("    students: List[StudentRecord],")
    lines.append("    include_unenrolled: bool = False,")
    lines.append(") -> Dict[str, float]:")
    lines.append('    """')
    lines.append("    Compute aggregate statistics for a cohort of students.")
    lines.append("")
    lines.append("    Args:")
    lines.append("        students: List of StudentRecord instances.")
    lines.append("        include_unenrolled: Whether to include unenrolled students.")
    lines.append("")
    lines.append("    Returns:")
    lines.append(
        "        Dict with keys: mean, median, std_dev, pass_rate, distinction_rate."
    )
    lines.append('    """')
    lines.append("    # Filter enrolled students unless requested otherwise")
    lines.append(
        "    active = [s for s in students if include_unenrolled or s.is_enrolled]"
    )
    lines.append("    if not active:")
    lines.append('        return {"mean": 0.0, "median": 0.0, "std_dev": 0.0,')
    lines.append('                "pass_rate": 0.0, "distinction_rate": 0.0}')
    lines.append("")
    lines.append("    averages = [s.average_score() for s in active]")
    lines.append("    n = len(averages)")
    lines.append("")
    lines.append("    # Arithmetic mean")
    lines.append("    mean = sum(averages) / n")
    lines.append("")
    lines.append("    # Median — requires sorted copy")
    lines.append("    sorted_avgs = sorted(averages)")
    lines.append("    mid = n // 2")
    lines.append("    if n % 2 == 0:")
    lines.append("        median = (sorted_avgs[mid - 1] + sorted_avgs[mid]) / 2.0")
    lines.append("    else:")
    lines.append("        median = sorted_avgs[mid]")
    lines.append("")
    lines.append("    # Population standard deviation")
    lines.append("    variance = sum((x - mean) ** 2 for x in averages) / n")
    lines.append("    std_dev = math.sqrt(variance)")
    lines.append("")
    lines.append("    # Pass and distinction rates")
    lines.append("    pass_rate = sum(1 for a in averages if a >= PASS_THRESHOLD) / n")
    lines.append(
        "    distinction_rate = sum(1 for a in averages if a >= DISTINCTION_THRESHOLD) / n"
    )
    lines.append("")
    lines.append("    return {")
    lines.append('        "mean": round(mean, 4),')
    lines.append('        "median": round(median, 4),')
    lines.append('        "std_dev": round(std_dev, 4),')
    lines.append('        "pass_rate": round(pass_rate, 4),')
    lines.append('        "distinction_rate": round(distinction_rate, 4),')
    lines.append("    }")
    lines.append("")

    lines.append("")
    lines.append("def rank_students(")
    lines.append("    students: List[StudentRecord],")
    lines.append("    top_n: int = 10,")
    lines.append("    ascending: bool = False,")
    lines.append(") -> List[Tuple[int, StudentRecord]]:")
    lines.append('    """')
    lines.append("    Rank students by average score and return the top N.")
    lines.append("")
    lines.append("    Args:")
    lines.append("        students:  List of StudentRecord instances.")
    lines.append("        top_n:     Number of top-ranked students to return.")
    lines.append("        ascending: If True, return the bottom N instead.")
    lines.append("")
    lines.append("    Returns:")
    lines.append("        List of (rank, StudentRecord) tuples, 1-indexed.")
    lines.append('    """')
    lines.append("    # Only rank enrolled students")
    lines.append("    enrolled = [s for s in students if s.is_enrolled]")
    lines.append("    # Sort: descending by default (highest score first)")
    lines.append("    sorted_students = sorted(")
    lines.append("        enrolled,")
    lines.append("        key=lambda s: s.average_score(),")
    lines.append("        reverse=not ascending,")
    lines.append("    )")
    lines.append("    top = sorted_students[:top_n]")
    lines.append("    return [(rank + 1, student) for rank, student in enumerate(top)]")
    lines.append("")

    lines.append("")
    lines.append("def generate_report(")
    lines.append("    course_id: str,")
    lines.append("    students: List[StudentRecord],")
    lines.append("    include_statistics: bool = True,")
    lines.append(") -> str:")
    lines.append('    """Generate a human-readable report for the given course."""')
    lines.append("    # Build header")
    lines.append("    lines_out: List[str] = []")
    lines.append('    lines_out.append(f"Course Report: {course_id}")')
    lines.append('    lines_out.append("=" * 60)')
    lines.append('    lines_out.append(f"Total students: {len(students)}")')
    lines.append("")
    lines.append("    if include_statistics:")
    lines.append("        stats = compute_cohort_statistics(students)")
    lines.append("        for key, value in stats.items():")
    lines.append('            lines_out.append(f"  {key}: {value:.2f}")')
    lines.append("")
    lines.append("    # Individual student summary")
    lines.append('    lines_out.append("")')
    lines.append('    lines_out.append("Student Grades:")')
    lines.append("    for student in sorted(students, key=lambda s: s.student_id):")
    lines.append("        grade = student.grade_letter()")
    lines.append("        avg = student.average_score()")
    lines.append('        status = "PASS" if student.is_passing() else "FAIL"')
    lines.append("        lines_out.append(")
    lines.append('            f"  {student.student_id:<12} {student.name:<20} "')
    lines.append('            f"Avg={avg:5.1f}  Grade={grade}  {status}"')
    lines.append("        )")
    lines.append("")
    lines.append('    return "\\n".join(lines_out)')
    lines.append("")

    # Large class
    lines.append("")
    lines.append("class GradeBook:")
    lines.append('    """')
    lines.append("    Manages a complete set of student records for a course.")
    lines.append("")
    lines.append(
        "    Supports adding students, recording scores, computing statistics,"
    )
    lines.append("    exporting reports, and detecting potential plagiarism via simple")
    lines.append("    hash-based duplicate detection.")
    lines.append('    """')
    lines.append("")
    lines.append("    def __init__(self, course_id: str, instructor: str) -> None:")
    lines.append('        """Initialise an empty grade book for the given course."""')
    lines.append("        self.course_id = course_id")
    lines.append("        self.instructor = instructor")
    lines.append("        self._students: Dict[str, StudentRecord] = {}")
    lines.append("        self._submission_hashes: Dict[str, str] = {}")
    lines.append("        self._locked: bool = False")
    lines.append("")
    lines.append("    def enroll(self, student_id: str, name: str) -> StudentRecord:")
    lines.append(
        '        """Enroll a new student, raising ValueError if already enrolled."""'
    )
    lines.append("        if student_id in self._students:")
    lines.append(
        f'            raise ValueError(f"Student {{student_id!r}} already enrolled")'
    )
    lines.append("        record = StudentRecord(")
    lines.append("            student_id=student_id,")
    lines.append("            name=name,")
    lines.append("            course=self.course_id,")
    lines.append("        )")
    lines.append("        self._students[student_id] = record")
    lines.append("        return record")
    lines.append("")
    lines.append("    def record_score(")
    lines.append("        self,")
    lines.append("        student_id: str,")
    lines.append("        score: float,")
    lines.append("        assignment_name: str = '',")
    lines.append("    ) -> None:")
    lines.append('        """Record a score for a student, validating the range."""')
    lines.append("        if self._locked:")
    lines.append(
        '            raise RuntimeError("GradeBook is locked — no further scores accepted")'
    )
    lines.append("        if student_id not in self._students:")
    lines.append(
        f'            raise KeyError(f"Student {{student_id!r}} not enrolled")'
    )
    lines.append("        if not (MIN_SCORE <= score <= MAX_SCORE):")
    lines.append("            raise ValueError(")
    lines.append(
        f'                f"Score {{score}} is out of range [{{MIN_SCORE}}, {{MAX_SCORE}}]"'
    )
    lines.append("            )")
    lines.append("        self._students[student_id].scores.append(score)")
    lines.append("")
    lines.append("    def lock(self) -> None:")
    lines.append('        """Lock the grade book, preventing further score entries."""')
    lines.append("        self._locked = True")
    lines.append("")
    lines.append("    def get_passing_students(self) -> List[StudentRecord]:")
    lines.append('        """Return all students who are currently passing."""')
    lines.append(
        "        return [s for s in self._students.values() if s.is_passing()]"
    )
    lines.append("")
    lines.append("    def get_failing_students(self) -> List[StudentRecord]:")
    lines.append('        """Return all students who are currently failing."""')
    lines.append(
        "        return [s for s in self._students.values() if not s.is_passing()]"
    )
    lines.append("")
    lines.append("    def compute_statistics(self) -> Dict[str, float]:")
    lines.append(
        '        """Delegate to the module-level cohort statistics function."""'
    )
    lines.append(
        "        return compute_cohort_statistics(list(self._students.values()))"
    )
    lines.append("")
    lines.append(
        "    def top_students(self, n: int = 5) -> List[Tuple[int, StudentRecord]]:"
    )
    lines.append('        """Return the top N students by average score."""')
    lines.append("        return rank_students(list(self._students.values()), top_n=n)")
    lines.append("")
    lines.append("    def export_report(self) -> str:")
    lines.append('        """Generate and return the full course report."""')
    lines.append("        return generate_report(")
    lines.append("            self.course_id,")
    lines.append("            list(self._students.values()),")
    lines.append("            include_statistics=True,")
    lines.append("        )")
    lines.append("")
    lines.append(
        "    def detect_duplicates(self, submissions: Dict[str, str]) -> Dict[str, List[str]]:"
    )
    lines.append('        """')
    lines.append("        Detect duplicate submissions by comparing SHA-256 hashes.")
    lines.append("")
    lines.append("        Args:")
    lines.append("            submissions: Mapping of student_id → submission text.")
    lines.append("")
    lines.append("        Returns:")
    lines.append(
        "            Mapping of hash → list of student IDs with identical submissions."
    )
    lines.append("            Only groups with more than one student are returned.")
    lines.append('        """')
    lines.append("        hash_groups: Dict[str, List[str]] = {}")
    lines.append("        for student_id, text in submissions.items():")
    lines.append("            # Normalise whitespace before hashing")
    lines.append('            normalised = " ".join(text.split())')
    lines.append("            digest = hashlib.sha256(normalised.encode()).hexdigest()")
    lines.append("            if digest not in hash_groups:")
    lines.append("                hash_groups[digest] = []")
    lines.append("            hash_groups[digest].append(student_id)")
    lines.append("        # Only return groups with duplicates")
    lines.append("        return {")
    lines.append("            h: ids for h, ids in hash_groups.items() if len(ids) > 1")
    lines.append("        }")
    lines.append("")
    lines.append("    def __len__(self) -> int:")
    lines.append('        """Return the number of enrolled students."""')
    lines.append("        return len(self._students)")
    lines.append("")
    lines.append("    def __contains__(self, student_id: str) -> bool:")
    lines.append('        """Return True if the student is enrolled."""')
    lines.append("        return student_id in self._students")
    lines.append("")
    lines.append("    def __repr__(self) -> str:")
    lines.append("        return (")
    lines.append('            f"GradeBook(course={self.course_id!r}, "')
    lines.append('            f"students={len(self)}, locked={self._locked})"')
    lines.append("        )")
    lines.append("")

    # Pad to ~500 lines
    while len(lines) < 490:
        lines.append(f"# padding line {len(lines)}")

    source = "\n".join(lines)
    return source.encode("utf-8")


def _make_java_500loc() -> bytes:
    """
    Generate a ~500-line Java source string covering:
      - Package declaration
      - Import statements
      - Javadoc comments on class and methods
      - Line comments
      - Block comments
      - A public class with instance fields, constructor, multiple methods
      - Nested loops and conditionals
    """
    lines: list[str] = []

    lines.append("package com.gradeloop.cipas.benchmark;")
    lines.append("")
    lines.append("import java.util.ArrayList;")
    lines.append("import java.util.Collections;")
    lines.append("import java.util.HashMap;")
    lines.append("import java.util.List;")
    lines.append("import java.util.Map;")
    lines.append("import java.util.Optional;")
    lines.append("import java.util.stream.Collectors;")
    lines.append("")
    lines.append("/**")
    lines.append(" * GradeBook manages student records and computes cohort statistics.")
    lines.append(" *")
    lines.append(
        " * <p>This class is NOT thread-safe. External synchronisation is required"
    )
    lines.append(" * for concurrent access from multiple threads.</p>")
    lines.append(" *")
    lines.append(" * @author Benchmark Generator")
    lines.append(" * @version 1.0")
    lines.append(" */")
    lines.append("public class GradeBook {")
    lines.append("")
    lines.append("    // Constants")
    lines.append("    private static final double MIN_SCORE = 0.0;")
    lines.append("    private static final double MAX_SCORE = 100.0;")
    lines.append("    private static final double PASS_THRESHOLD = 50.0;")
    lines.append("    private static final double DISTINCTION_THRESHOLD = 75.0;")
    lines.append('    private static final String DEFAULT_COURSE = "CS101";')
    lines.append("")
    lines.append("    // Instance fields")
    lines.append("    private final String courseId;")
    lines.append("    private final String instructor;")
    lines.append("    private final Map<String, List<Double>> scores;")
    lines.append("    private final List<String> enrolledStudents;")
    lines.append("    private boolean locked;")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Constructs a new GradeBook for the specified course.")
    lines.append("     *")
    lines.append("     * @param courseId   unique identifier for the course")
    lines.append("     * @param instructor name of the instructor")
    lines.append("     */")
    lines.append("    public GradeBook(String courseId, String instructor) {")
    lines.append("        this.courseId = courseId;")
    lines.append("        this.instructor = instructor;")
    lines.append("        this.scores = new HashMap<>();")
    lines.append("        this.enrolledStudents = new ArrayList<>();")
    lines.append("        this.locked = false;")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Enrols a student in this course.")
    lines.append("     *")
    lines.append("     * @param studentId unique student identifier")
    lines.append(
        "     * @throws IllegalStateException if the student is already enrolled"
    )
    lines.append("     */")
    lines.append("    public void enroll(String studentId) {")
    lines.append("        // Prevent duplicate enrolment")
    lines.append("        if (enrolledStudents.contains(studentId)) {")
    lines.append(
        '            throw new IllegalStateException("Student already enrolled: " + studentId);'
    )
    lines.append("        }")
    lines.append("        enrolledStudents.add(studentId);")
    lines.append("        scores.put(studentId, new ArrayList<>());")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Records a score for a student on a specific assignment.")
    lines.append("     *")
    lines.append("     * @param studentId      the student receiving the score")
    lines.append("     * @param score          the score value (must be in [0, 100])")
    lines.append("     * @throws IllegalArgumentException if the score is out of range")
    lines.append("     * @throws IllegalStateException    if the grade book is locked")
    lines.append("     */")
    lines.append("    public void recordScore(String studentId, double score) {")
    lines.append("        if (locked) {")
    lines.append('            throw new IllegalStateException("GradeBook is locked");')
    lines.append("        }")
    lines.append("        if (score < MIN_SCORE || score > MAX_SCORE) {")
    lines.append(
        '            throw new IllegalArgumentException("Score out of range: " + score);'
    )
    lines.append("        }")
    lines.append("        if (!scores.containsKey(studentId)) {")
    lines.append(
        '            throw new IllegalArgumentException("Student not enrolled: " + studentId);'
    )
    lines.append("        }")
    lines.append("        scores.get(studentId).add(score);")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Returns the arithmetic mean of all scores for a student.")
    lines.append("     *")
    lines.append("     * @param studentId the student whose average is requested")
    lines.append("     * @return average score, or 0.0 if no scores recorded")
    lines.append("     */")
    lines.append("    public double getAverage(String studentId) {")
    lines.append("        List<Double> studentScores = scores.get(studentId);")
    lines.append("        if (studentScores == null || studentScores.isEmpty()) {")
    lines.append("            return 0.0;")
    lines.append("        }")
    lines.append("        /* Sum all scores and divide by count */")
    lines.append("        double total = 0.0;")
    lines.append("        for (double s : studentScores) {")
    lines.append("            total += s;")
    lines.append("        }")
    lines.append("        return total / studentScores.size();")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append(
        "     * Returns the letter grade for a student based on their average score."
    )
    lines.append("     *")
    lines.append("     * @param studentId the student")
    lines.append("     * @return letter grade: A, B, C, or F")
    lines.append("     */")
    lines.append("    public String getLetterGrade(String studentId) {")
    lines.append("        double avg = getAverage(studentId);")
    lines.append("        // Map numeric average to letter grade")
    lines.append("        if (avg >= DISTINCTION_THRESHOLD) {")
    lines.append('            return "A";')
    lines.append("        } else if (avg >= 65.0) {")
    lines.append('            return "B";')
    lines.append("        } else if (avg >= PASS_THRESHOLD) {")
    lines.append('            return "C";')
    lines.append("        } else {")
    lines.append('            return "F";')
    lines.append("        }")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Computes cohort-wide statistics.")
    lines.append("     *")
    lines.append(
        "     * @return map with keys: mean, median, stdDev, passRate, distinctionRate"
    )
    lines.append("     */")
    lines.append("    public Map<String, Double> computeStatistics() {")
    lines.append("        List<Double> averages = new ArrayList<>();")
    lines.append("        for (String studentId : enrolledStudents) {")
    lines.append("            averages.add(getAverage(studentId));")
    lines.append("        }")
    lines.append("        if (averages.isEmpty()) {")
    lines.append("            return Collections.emptyMap();")
    lines.append("        }")
    lines.append("        int n = averages.size();")
    lines.append("        // Compute mean")
    lines.append("        double sum = 0.0;")
    lines.append("        for (double a : averages) {")
    lines.append("            sum += a;")
    lines.append("        }")
    lines.append("        double mean = sum / n;")
    lines.append("        // Compute median")
    lines.append("        List<Double> sorted = new ArrayList<>(averages);")
    lines.append("        Collections.sort(sorted);")
    lines.append("        double median;")
    lines.append("        if (n % 2 == 0) {")
    lines.append(
        "            median = (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;"
    )
    lines.append("        } else {")
    lines.append("            median = sorted.get(n / 2);")
    lines.append("        }")
    lines.append("        // Compute standard deviation")
    lines.append("        double variance = 0.0;")
    lines.append("        for (double a : averages) {")
    lines.append("            variance += (a - mean) * (a - mean);")
    lines.append("        }")
    lines.append("        double stdDev = Math.sqrt(variance / n);")
    lines.append("        // Compute pass and distinction rates")
    lines.append("        long passCount = averages.stream()")
    lines.append("            .filter(a -> a >= PASS_THRESHOLD).count();")
    lines.append("        long distinctionCount = averages.stream()")
    lines.append("            .filter(a -> a >= DISTINCTION_THRESHOLD).count();")
    lines.append("        Map<String, Double> stats = new HashMap<>();")
    lines.append('        stats.put("mean", mean);')
    lines.append('        stats.put("median", median);')
    lines.append('        stats.put("stdDev", stdDev);')
    lines.append('        stats.put("passRate", (double) passCount / n);')
    lines.append('        stats.put("distinctionRate", (double) distinctionCount / n);')
    lines.append("        return stats;")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Returns the top N students by average score.")
    lines.append("     *")
    lines.append("     * @param topN number of students to return")
    lines.append("     * @return list of student IDs, highest average first")
    lines.append("     */")
    lines.append("    public List<String> getTopStudents(int topN) {")
    lines.append("        // Sort by descending average score")
    lines.append("        return enrolledStudents.stream()")
    lines.append(
        "            .sorted((a, b) -> Double.compare(getAverage(b), getAverage(a)))"
    )
    lines.append("            .limit(topN)")
    lines.append("            .collect(Collectors.toList());")
    lines.append("    }")
    lines.append("")
    lines.append("    /** Locks this grade book, preventing further score entries. */")
    lines.append("    public void lock() {")
    lines.append("        this.locked = true;")
    lines.append("    }")
    lines.append("")
    lines.append("    /** Returns true if this grade book is locked. */")
    lines.append("    public boolean isLocked() {")
    lines.append("        return locked;")
    lines.append("    }")
    lines.append("")
    lines.append("    /** Returns the total number of enrolled students. */")
    lines.append("    public int size() {")
    lines.append("        return enrolledStudents.size();")
    lines.append("    }")
    lines.append("")
    lines.append("    /**")
    lines.append("     * Returns a human-readable summary of this grade book.")
    lines.append("     *")
    lines.append("     * @return formatted summary string")
    lines.append("     */")
    lines.append("    @Override")
    lines.append("    public String toString() {")
    lines.append('        return "GradeBook{courseId=\'" + courseId + "\'"')
    lines.append('            + ", instructor=\'" + instructor + "\'"')
    lines.append('            + ", students=" + enrolledStudents.size()')
    lines.append('            + ", locked=" + locked + "}";')
    lines.append("    }")
    lines.append("}")
    lines.append("")

    # Pad to ~500 lines
    while len(lines) < 490:
        lines.append(f"// padding line {len(lines)}")

    source = "\n".join(lines)
    return source.encode("utf-8")


def _make_c_500loc() -> bytes:
    """
    Generate a ~500-line C source string covering:
      - Block comments and line comments
      - #include directives
      - struct definitions
      - Multiple functions with parameters
      - Nested loops and conditionals
      - String and numeric literals
    """
    lines: list[str] = []

    lines.append("/*")
    lines.append(" * grade_book.c — student grade management for CIPAS benchmark.")
    lines.append(" * Implements cohort statistics, ranking, and duplicate detection.")
    lines.append(" */")
    lines.append("")
    lines.append("#include <stdio.h>")
    lines.append("#include <stdlib.h>")
    lines.append("#include <string.h>")
    lines.append("#include <math.h>")
    lines.append("")
    lines.append("/* Constants */")
    lines.append("#define MAX_STUDENTS 500")
    lines.append("#define MAX_NAME_LEN 64")
    lines.append("#define MAX_SCORES   20")
    lines.append("#define MIN_SCORE    0.0")
    lines.append("#define MAX_SCORE    100.0")
    lines.append("#define PASS_THRESHOLD        50.0")
    lines.append("#define DISTINCTION_THRESHOLD 75.0")
    lines.append("")
    lines.append("/* Student record structure */")
    lines.append("typedef struct {")
    lines.append("    char student_id[16];")
    lines.append("    char name[MAX_NAME_LEN];")
    lines.append("    double scores[MAX_SCORES];")
    lines.append("    int num_scores;")
    lines.append("    int is_enrolled;")
    lines.append("} StudentRecord;")
    lines.append("")
    lines.append("/* Grade book structure */")
    lines.append("typedef struct {")
    lines.append("    StudentRecord students[MAX_STUDENTS];")
    lines.append("    int num_students;")
    lines.append("    char course_id[32];")
    lines.append("    char instructor[MAX_NAME_LEN];")
    lines.append("    int locked;")
    lines.append("} GradeBook;")
    lines.append("")
    lines.append("/* Statistics output structure */")
    lines.append("typedef struct {")
    lines.append("    double mean;")
    lines.append("    double median;")
    lines.append("    double std_dev;")
    lines.append("    double pass_rate;")
    lines.append("    double distinction_rate;")
    lines.append("} CohortStats;")
    lines.append("")

    # Functions
    lines.append("/**")
    lines.append(" * Initialise a GradeBook with the given course and instructor.")
    lines.append(" */")
    lines.append(
        "void grade_book_init(GradeBook *gb, const char *course_id, const char *instructor) {"
    )
    lines.append("    memset(gb, 0, sizeof(GradeBook));")
    lines.append("    strncpy(gb->course_id, course_id, sizeof(gb->course_id) - 1);")
    lines.append("    strncpy(gb->instructor, instructor, sizeof(gb->instructor) - 1);")
    lines.append("    gb->num_students = 0;")
    lines.append("    gb->locked = 0;")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(
        " * Enrol a student, returning 0 on success or -1 if the book is full."
    )
    lines.append(" */")
    lines.append(
        "int grade_book_enroll(GradeBook *gb, const char *student_id, const char *name) {"
    )
    lines.append("    int i;")
    lines.append("    /* Check for duplicate */")
    lines.append("    for (i = 0; i < gb->num_students; i++) {")
    lines.append("        if (strcmp(gb->students[i].student_id, student_id) == 0) {")
    lines.append(
        '            fprintf(stderr, "Student %s already enrolled\\n", student_id);'
    )
    lines.append("            return -1;")
    lines.append("        }")
    lines.append("    }")
    lines.append("    if (gb->num_students >= MAX_STUDENTS) {")
    lines.append('        fprintf(stderr, "Grade book is full\\n");')
    lines.append("        return -1;")
    lines.append("    }")
    lines.append("    StudentRecord *rec = &gb->students[gb->num_students];")
    lines.append(
        "    strncpy(rec->student_id, student_id, sizeof(rec->student_id) - 1);"
    )
    lines.append("    strncpy(rec->name, name, sizeof(rec->name) - 1);")
    lines.append("    rec->num_scores = 0;")
    lines.append("    rec->is_enrolled = 1;")
    lines.append("    gb->num_students++;")
    lines.append("    return 0;")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * Record a score for a student.")
    lines.append(" * Returns 0 on success, -1 on error.")
    lines.append(" */")
    lines.append(
        "int grade_book_record_score(GradeBook *gb, const char *student_id, double score) {"
    )
    lines.append("    int i;")
    lines.append("    if (gb->locked) {")
    lines.append('        fprintf(stderr, "GradeBook is locked\\n");')
    lines.append("        return -1;")
    lines.append("    }")
    lines.append("    if (score < MIN_SCORE || score > MAX_SCORE) {")
    lines.append('        fprintf(stderr, "Score %.2f is out of range\\n", score);')
    lines.append("        return -1;")
    lines.append("    }")
    lines.append("    for (i = 0; i < gb->num_students; i++) {")
    lines.append("        if (strcmp(gb->students[i].student_id, student_id) == 0) {")
    lines.append("            StudentRecord *rec = &gb->students[i];")
    lines.append("            if (rec->num_scores >= MAX_SCORES) {")
    lines.append(
        '                fprintf(stderr, "Max scores reached for %s\\n", student_id);'
    )
    lines.append("                return -1;")
    lines.append("            }")
    lines.append("            rec->scores[rec->num_scores++] = score;")
    lines.append("            return 0;")
    lines.append("        }")
    lines.append("    }")
    lines.append('    fprintf(stderr, "Student %s not found\\n", student_id);')
    lines.append("    return -1;")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * Compute the average score for a student.")
    lines.append(" * Returns 0.0 if no scores have been recorded.")
    lines.append(" */")
    lines.append("double compute_average(const StudentRecord *rec) {")
    lines.append("    int i;")
    lines.append("    double total;")
    lines.append("    if (rec->num_scores == 0) {")
    lines.append("        return 0.0;")
    lines.append("    }")
    lines.append("    total = 0.0;")
    lines.append("    /* Sum all recorded scores */")
    lines.append("    for (i = 0; i < rec->num_scores; i++) {")
    lines.append("        total += rec->scores[i];")
    lines.append("    }")
    lines.append("    return total / (double)rec->num_scores;")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * Return the letter grade for a numeric average.")
    lines.append(" */")
    lines.append("char get_letter_grade(double average) {")
    lines.append("    if (average >= DISTINCTION_THRESHOLD) return 'A';")
    lines.append("    if (average >= 65.0)                  return 'B';")
    lines.append("    if (average >= PASS_THRESHOLD)        return 'C';")
    lines.append("    return 'F';")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * Compute cohort statistics and populate the CohortStats struct.")
    lines.append(" */")
    lines.append("void compute_cohort_stats(const GradeBook *gb, CohortStats *out) {")
    lines.append("    int i;")
    lines.append("    double averages[MAX_STUDENTS];")
    lines.append("    int n = 0;")
    lines.append("    double sum, mean, variance;")
    lines.append("    int pass_count, distinction_count;")
    lines.append("    /* Collect averages for enrolled students */")
    lines.append("    for (i = 0; i < gb->num_students; i++) {")
    lines.append("        if (gb->students[i].is_enrolled) {")
    lines.append("            averages[n++] = compute_average(&gb->students[i]);")
    lines.append("        }")
    lines.append("    }")
    lines.append("    if (n == 0) {")
    lines.append("        memset(out, 0, sizeof(CohortStats));")
    lines.append("        return;")
    lines.append("    }")
    lines.append("    /* Mean */")
    lines.append("    sum = 0.0;")
    lines.append("    for (i = 0; i < n; i++) sum += averages[i];")
    lines.append("    mean = sum / (double)n;")
    lines.append("    /* Variance and std dev */")
    lines.append("    variance = 0.0;")
    lines.append("    for (i = 0; i < n; i++) {")
    lines.append("        double diff = averages[i] - mean;")
    lines.append("        variance += diff * diff;")
    lines.append("    }")
    lines.append("    out->mean = mean;")
    lines.append("    out->std_dev = sqrt(variance / (double)n);")
    lines.append("    /* Simple insertion sort for median */")
    lines.append("    double sorted[MAX_STUDENTS];")
    lines.append("    memcpy(sorted, averages, n * sizeof(double));")
    lines.append("    int j;")
    lines.append("    for (i = 1; i < n; i++) {")
    lines.append("        double key = sorted[i];")
    lines.append("        j = i - 1;")
    lines.append("        while (j >= 0 && sorted[j] > key) {")
    lines.append("            sorted[j + 1] = sorted[j];")
    lines.append("            j--;")
    lines.append("        }")
    lines.append("        sorted[j + 1] = key;")
    lines.append("    }")
    lines.append("    if (n % 2 == 0) {")
    lines.append("        out->median = (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;")
    lines.append("    } else {")
    lines.append("        out->median = sorted[n / 2];")
    lines.append("    }")
    lines.append("    /* Pass and distinction rates */")
    lines.append("    pass_count = 0;")
    lines.append("    distinction_count = 0;")
    lines.append("    for (i = 0; i < n; i++) {")
    lines.append("        if (averages[i] >= PASS_THRESHOLD) pass_count++;")
    lines.append(
        "        if (averages[i] >= DISTINCTION_THRESHOLD) distinction_count++;"
    )
    lines.append("    }")
    lines.append("    out->pass_rate = (double)pass_count / (double)n;")
    lines.append("    out->distinction_rate = (double)distinction_count / (double)n;")
    lines.append("}")
    lines.append("")

    # Pad to ~500 lines
    while len(lines) < 490:
        lines.append(f"/* padding line {len(lines)} */")

    source = "\n".join(lines)
    return source.encode("utf-8")


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def python_500loc() -> bytes:
    """~500-line Python source bytes for benchmarking."""
    return _make_python_500loc()


@pytest.fixture(scope="module")
def java_500loc() -> bytes:
    """~500-line Java source bytes for benchmarking."""
    return _make_java_500loc()


@pytest.fixture(scope="module")
def c_500loc() -> bytes:
    """~500-line C source bytes for benchmarking."""
    return _make_c_500loc()


# ---------------------------------------------------------------------------
# Benchmark helpers
# ---------------------------------------------------------------------------


def _build_worker_dict(source_bytes: bytes, language: str, granule_id: str) -> dict:
    """Build the plain dict that NormalizationService passes to the worker."""
    return {
        "granule_id": granule_id,
        "language": language,
        "source_bytes": source_bytes,
        # Formatter config — use defaults (formatter may not be installed in CI)
        "java_formatter_jar": "",
        "black_version_prefix": "24.",
        "clang_format_major_version": 0,
    }


def _run_and_time(request_dict: dict) -> tuple[dict, float]:
    """Run run_normalization_worker and return (result, elapsed_seconds)."""
    start = time.perf_counter()
    result = run_normalization_worker(request_dict)
    elapsed = time.perf_counter() - start
    return result, elapsed


# ---------------------------------------------------------------------------
# SLO constants
# ---------------------------------------------------------------------------

SLO_SECONDS = 0.100  # 100 ms per 500 LOC


# ---------------------------------------------------------------------------
# Type-1 pipeline benchmarks
# ---------------------------------------------------------------------------


class TestType1PipelinePerformance:
    """Benchmark the Type-1 pipeline (strip + pretty-print) at ≤100ms/500LOC."""

    def test_python_type1_latency(self, python_500loc: bytes) -> None:
        """Type-1 Python normalisation must complete in ≤100ms for 500 LOC."""
        source_bytes = python_500loc
        # Warm-up: one unmetered run to trigger lazy initialisation
        run_type1_direct(source_bytes, "python", granule_id="warmup-py")

        # Measured runs
        timings: list[float] = []
        for i in range(5):
            start = time.perf_counter()
            text, h = run_type1_direct(
                source_bytes, "python", granule_id=f"bench-py-{i}"
            )
            elapsed = time.perf_counter() - start
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        max_ms = max(timings) * 1000
        p99_ms = (
            sorted(timings)[int(len(timings) * 0.99) - 1] * 1000
            if len(timings) >= 100
            else max_ms
        )

        print(
            f"\n[Python Type-1] mean={mean_ms:.2f}ms max={max_ms:.2f}ms "
            f"SLO={SLO_SECONDS * 1000:.0f}ms source_lines={source_bytes.count(b'\\n')}"
        )

        # Hard SLO gate: mean must be ≤ 100ms.
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"Python Type-1 mean latency {mean_ms:.2f}ms exceeds SLO of "
            f"{SLO_SECONDS * 1000:.0f}ms for 500 LOC"
        )

        # Verify output is non-empty and deterministic.
        text_a, h_a = run_type1_direct(source_bytes, "python", granule_id="det-a")
        text_b, h_b = run_type1_direct(source_bytes, "python", granule_id="det-b")
        assert h_a == h_b, "Type-1 Python hash must be deterministic across calls"
        assert len(text_a) > 0, "Type-1 Python output must not be empty"

    def test_java_type1_latency(self, java_500loc: bytes) -> None:
        """Type-1 Java normalisation must complete in ≤100ms for 500 LOC."""
        source_bytes = java_500loc
        # Warm-up
        run_type1_direct(source_bytes, "java", granule_id="warmup-java")

        timings: list[float] = []
        for i in range(5):
            start = time.perf_counter()
            run_type1_direct(source_bytes, "java", granule_id=f"bench-java-{i}")
            elapsed = time.perf_counter() - start
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        max_ms = max(timings) * 1000

        print(
            f"\n[Java Type-1] mean={mean_ms:.2f}ms max={max_ms:.2f}ms "
            f"SLO={SLO_SECONDS * 1000:.0f}ms"
        )

        assert mean_ms <= SLO_SECONDS * 1000, (
            f"Java Type-1 mean latency {mean_ms:.2f}ms exceeds SLO"
        )

        text_a, h_a = run_type1_direct(source_bytes, "java", granule_id="det-a")
        text_b, h_b = run_type1_direct(source_bytes, "java", granule_id="det-b")
        assert h_a == h_b, "Type-1 Java hash must be deterministic"

    def test_c_type1_latency(self, c_500loc: bytes) -> None:
        """Type-1 C normalisation must complete in ≤100ms for 500 LOC."""
        source_bytes = c_500loc
        # Warm-up
        run_type1_direct(source_bytes, "c", granule_id="warmup-c")

        timings: list[float] = []
        for i in range(5):
            start = time.perf_counter()
            run_type1_direct(source_bytes, "c", granule_id=f"bench-c-{i}")
            elapsed = time.perf_counter() - start
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        max_ms = max(timings) * 1000

        print(
            f"\n[C Type-1] mean={mean_ms:.2f}ms max={max_ms:.2f}ms "
            f"SLO={SLO_SECONDS * 1000:.0f}ms"
        )

        assert mean_ms <= SLO_SECONDS * 1000, (
            f"C Type-1 mean latency {mean_ms:.2f}ms exceeds SLO"
        )

        text_a, h_a = run_type1_direct(source_bytes, "c", granule_id="det-a")
        text_b, h_b = run_type1_direct(source_bytes, "c", granule_id="det-b")
        assert h_a == h_b, "Type-1 C hash must be deterministic"


# ---------------------------------------------------------------------------
# Type-2 pipeline benchmarks
# ---------------------------------------------------------------------------


class TestType2PipelinePerformance:
    """Benchmark the Type-2 pipeline (canonicalisation) at ≤100ms/500LOC."""

    def test_python_type2_latency(self, python_500loc: bytes) -> None:
        """Type-2 Python normalisation must complete in ≤100ms for 500 LOC."""
        # First get type1 output
        type1_text, _ = run_type1_direct(python_500loc, "python", granule_id="pre")

        # Warm-up
        run_type2_direct(type1_text, "python", granule_id="warmup")

        timings: list[float] = []
        for i in range(5):
            start = time.perf_counter()
            run_type2_direct(type1_text, "python", granule_id=f"bench-{i}")
            elapsed = time.perf_counter() - start
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        print(f"\n[Python Type-2] mean={mean_ms:.2f}ms SLO={SLO_SECONDS * 1000:.0f}ms")
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"Python Type-2 mean latency {mean_ms:.2f}ms exceeds SLO"
        )

    def test_java_type2_latency(self, java_500loc: bytes) -> None:
        """Type-2 Java normalisation must complete in ≤100ms for 500 LOC."""
        type1_text, _ = run_type1_direct(java_500loc, "java", granule_id="pre")
        run_type2_direct(type1_text, "java", granule_id="warmup")  # warm-up

        timings: list[float] = []
        for i in range(5):
            start = time.perf_counter()
            run_type2_direct(type1_text, "java", granule_id=f"bench-{i}")
            elapsed = time.perf_counter() - start
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        print(f"\n[Java Type-2] mean={mean_ms:.2f}ms SLO={SLO_SECONDS * 1000:.0f}ms")
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"Java Type-2 mean latency {mean_ms:.2f}ms exceeds SLO"
        )

    def test_c_type2_latency(self, c_500loc: bytes) -> None:
        """Type-2 C normalisation must complete in ≤100ms for 500 LOC."""
        type1_text, _ = run_type1_direct(c_500loc, "c", granule_id="pre")
        run_type2_direct(type1_text, "c", granule_id="warmup")  # warm-up

        timings: list[float] = []
        for i in range(5):
            start = time.perf_counter()
            run_type2_direct(type1_text, "c", granule_id=f"bench-{i}")
            elapsed = time.perf_counter() - start
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        print(f"\n[C Type-2] mean={mean_ms:.2f}ms SLO={SLO_SECONDS * 1000:.0f}ms")
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"C Type-2 mean latency {mean_ms:.2f}ms exceeds SLO"
        )


# ---------------------------------------------------------------------------
# Full pipeline (Type-1 + Type-2) benchmarks
# ---------------------------------------------------------------------------


class TestFullPipelinePerformance:
    """Benchmark run_normalization_worker (Type-1 + Type-2) at ≤100ms/500LOC."""

    def test_python_full_pipeline_latency(self, python_500loc: bytes) -> None:
        """
        Full Python pipeline (strip + format + canonicalise) ≤100ms for 500 LOC.
        """
        req = _build_worker_dict(python_500loc, "python", "warmup-py-full")
        run_normalization_worker(req)  # warm-up

        timings: list[float] = []
        for i in range(5):
            req = _build_worker_dict(python_500loc, "python", f"bench-py-full-{i}")
            _, elapsed = _run_and_time(req)
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        max_ms = max(timings) * 1000
        print(
            f"\n[Python Full] mean={mean_ms:.2f}ms max={max_ms:.2f}ms "
            f"SLO={SLO_SECONDS * 1000:.0f}ms"
        )
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"Python full pipeline mean latency {mean_ms:.2f}ms exceeds SLO"
        )

    def test_java_full_pipeline_latency(self, java_500loc: bytes) -> None:
        """Full Java pipeline (strip + format + canonicalise) ≤100ms for 500 LOC."""
        req = _build_worker_dict(java_500loc, "java", "warmup-java-full")
        run_normalization_worker(req)  # warm-up

        timings: list[float] = []
        for i in range(5):
            req = _build_worker_dict(java_500loc, "java", f"bench-java-full-{i}")
            _, elapsed = _run_and_time(req)
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        max_ms = max(timings) * 1000
        print(
            f"\n[Java Full] mean={mean_ms:.2f}ms max={max_ms:.2f}ms "
            f"SLO={SLO_SECONDS * 1000:.0f}ms"
        )
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"Java full pipeline mean latency {mean_ms:.2f}ms exceeds SLO"
        )

    def test_c_full_pipeline_latency(self, c_500loc: bytes) -> None:
        """Full C pipeline (strip + format + canonicalise) ≤100ms for 500 LOC."""
        req = _build_worker_dict(c_500loc, "c", "warmup-c-full")
        run_normalization_worker(req)  # warm-up

        timings: list[float] = []
        for i in range(5):
            req = _build_worker_dict(c_500loc, "c", f"bench-c-full-{i}")
            _, elapsed = _run_and_time(req)
            timings.append(elapsed)

        mean_ms = (sum(timings) / len(timings)) * 1000
        max_ms = max(timings) * 1000
        print(
            f"\n[C Full] mean={mean_ms:.2f}ms max={max_ms:.2f}ms "
            f"SLO={SLO_SECONDS * 1000:.0f}ms"
        )
        assert mean_ms <= SLO_SECONDS * 1000, (
            f"C full pipeline mean latency {mean_ms:.2f}ms exceeds SLO"
        )

    def test_mixed_language_batch_throughput(
        self,
        python_500loc: bytes,
        java_500loc: bytes,
        c_500loc: bytes,
    ) -> None:
        """
        30 mixed-language granules must all complete within the SLO individually.

        This test exercises the pipeline with interleaved languages to ensure
        that parser state from one language does not contaminate another.
        """
        sources = [
            (python_500loc, "python"),
            (java_500loc, "java"),
            (c_500loc, "c"),
        ]

        # Warm-up all three
        for src, lang in sources:
            run_normalization_worker(_build_worker_dict(src, lang, f"warmup-{lang}"))

        violations: list[str] = []
        for run_idx in range(10):
            for src, lang in sources:
                req = _build_worker_dict(src, lang, f"mixed-{run_idx}-{lang}")
                _, elapsed = _run_and_time(req)
                if elapsed > SLO_SECONDS:
                    violations.append(
                        f"  run={run_idx} lang={lang} elapsed={elapsed * 1000:.2f}ms"
                    )

        assert not violations, f"SLO violations in mixed-language batch:\n" + "\n".join(
            violations
        )


# ---------------------------------------------------------------------------
# pytest-benchmark integration (optional — runs only when pytest-benchmark installed)
# ---------------------------------------------------------------------------


def test_python_type1_benchmark(benchmark: Any, python_500loc: bytes) -> None:
    """
    pytest-benchmark wrapper for Python Type-1 latency.

    Run with: pytest tests/benchmarks/ --benchmark-sort=mean -v
    """
    req = _build_worker_dict(python_500loc, "python", "bench-py-t1")
    # warm-up handled by benchmark.pedantic()
    result = benchmark.pedantic(
        run_normalization_worker,
        args=(req,),
        iterations=5,
        rounds=3,
        warmup_rounds=1,
    )
    assert "type1" in result
    assert "type2" in result
    # Hard gate on the benchmark's mean
    mean_s = benchmark.stats.get("mean", 0.0)
    if mean_s:
        assert mean_s <= SLO_SECONDS, (
            f"Python benchmark mean {mean_s * 1000:.2f}ms exceeds SLO {SLO_SECONDS * 1000:.0f}ms"
        )


def test_java_type1_benchmark(benchmark: Any, java_500loc: bytes) -> None:
    """pytest-benchmark wrapper for Java Type-1 latency."""
    req = _build_worker_dict(java_500loc, "java", "bench-java-t1")
    result = benchmark.pedantic(
        run_normalization_worker,
        args=(req,),
        iterations=5,
        rounds=3,
        warmup_rounds=1,
    )
    assert "type1" in result
    mean_s = benchmark.stats.get("mean", 0.0)
    if mean_s:
        assert mean_s <= SLO_SECONDS, (
            f"Java benchmark mean {mean_s * 1000:.2f}ms exceeds SLO"
        )


def test_c_type1_benchmark(benchmark: Any, c_500loc: bytes) -> None:
    """pytest-benchmark wrapper for C Type-1 latency."""
    req = _build_worker_dict(c_500loc, "c", "bench-c-t1")
    result = benchmark.pedantic(
        run_normalization_worker,
        args=(req,),
        iterations=5,
        rounds=3,
        warmup_rounds=1,
    )
    assert "type1" in result
    mean_s = benchmark.stats.get("mean", 0.0)
    if mean_s:
        assert mean_s <= SLO_SECONDS, (
            f"C benchmark mean {mean_s * 1000:.2f}ms exceeds SLO"
        )
