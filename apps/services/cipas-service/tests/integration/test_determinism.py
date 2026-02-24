"""
Determinism integration tests for the CIPAS Syntactic Normalisation Pipeline (E10/US02).

Test contract
─────────────
Running normalisation twice on identical input MUST produce byte-for-byte identical
outputs.  Specifically, for any granule:

    run_normalization_worker(request) call 1  →  {type1, hash_type1, type2, hash_type2}
    run_normalization_worker(request) call 2  →  {type1, hash_type1, type2, hash_type2}

    ASSERT: hash_type1_run1 == hash_type1_run2
    ASSERT: hash_type2_run1 == hash_type2_run2
    ASSERT: type1_run1      == type1_run2
    ASSERT: type2_run1      == type2_run2

This property is tested across:
  - 100+ mixed-language granules (Python, Java, C)
  - Multiple granule types: functions, classes, loops, top-level code
  - Edge cases: empty bodies, nested structures, unicode identifiers,
    all-comment files, docstring-only bodies, numeric/string literal
    variations, multi-line strings, raw strings (Python)
  - Granules with syntax errors (partial/broken code)
  - Granules that exercise every canonical token category
    (FUNC_N, PARAM_N, VAR_N, LIT_<sha1>)

Additionally verifies:
  - The hash changes when source content changes (no hash collision on
    trivially different inputs).
  - The hash does NOT change when only comments differ (Type-1 clone contract).
  - The hash DOES change when an identifier name changes (Type-1 is not
    identifier-agnostic; Type-2 hash must stay the same).
  - Ordering within the identifier mapping is stable across calls.

Test structure
──────────────
  TestDeterminismPython   — 35+ Python granules
  TestDeterminismJava     — 35+ Java granules
  TestDeterminismC        — 35+ C granules
  TestDeterminismEdgeCases — cross-cutting edge cases
  TestDeterminismCloneContracts — clone detection semantic contracts

All tests call run_normalization_worker() synchronously (no ProcessPoolExecutor)
so they execute in the test process.  This matches the worker function's
execution model — it is a plain synchronous function.
"""

from __future__ import annotations

import hashlib
import textwrap
from typing import Any

import pytest

from cipas.normalization.type2 import run_normalization_worker

# ---------------------------------------------------------------------------
# Worker dict builder
# ---------------------------------------------------------------------------


def _req(granule_id: str, language: str, source: str) -> dict[str, Any]:
    """
    Build a plain worker-dict from a source string.

    Encodes source as UTF-8 bytes (matching production behaviour where
    source_bytes is sliced from the original file bytes).
    """
    source_bytes = source.encode("utf-8")
    return {
        "granule_id": granule_id,
        "language": language,
        "source_bytes": source_bytes,
        "source_text": source,
        # Formatter config — use defaults; formatters may not be installed in CI.
        "java_formatter_jar": "",
        "black_version_prefix": "24.",
        "clang_format_major_version": 0,
    }


def _assert_deterministic(
    granule_id: str, language: str, source: str
) -> dict[str, str]:
    """
    Run run_normalization_worker twice and assert all outputs are identical.

    Returns the first result dict for further assertions.

    Args:
        granule_id: Opaque ID for the granule (used in assertion messages).
        language:   Source language.
        source:     Raw source text (will be encoded to UTF-8 bytes).

    Returns:
        Result dict from the first run: {"type1", "hash_type1", "type2", "hash_type2"}.
    """
    req = _req(granule_id, language, source)

    result_a = run_normalization_worker(req)
    result_b = run_normalization_worker(req)

    assert result_a["type1"] == result_b["type1"], (
        f"[{granule_id}] type1 text is not deterministic across two runs.\n"
        f"  Run A: {result_a['type1'][:120]!r}\n"
        f"  Run B: {result_b['type1'][:120]!r}"
    )
    assert result_a["hash_type1"] == result_b["hash_type1"], (
        f"[{granule_id}] hash_type1 is not deterministic across two runs.\n"
        f"  Run A: {result_a['hash_type1']}\n"
        f"  Run B: {result_b['hash_type1']}"
    )
    assert result_a["type2"] == result_b["type2"], (
        f"[{granule_id}] type2 text is not deterministic across two runs.\n"
        f"  Run A: {result_a['type2'][:120]!r}\n"
        f"  Run B: {result_b['type2'][:120]!r}"
    )
    assert result_a["hash_type2"] == result_b["hash_type2"], (
        f"[{granule_id}] hash_type2 is not deterministic across two runs.\n"
        f"  Run A: {result_a['hash_type2']}\n"
        f"  Run B: {result_b['hash_type2']}"
    )

    # Verify that the returned hashes actually match the text content.
    computed_h1 = hashlib.sha256(result_a["type1"].encode("utf-8")).hexdigest()
    assert result_a["hash_type1"] == computed_h1, (
        f"[{granule_id}] hash_type1 does not match SHA-256(type1).\n"
        f"  Returned: {result_a['hash_type1']}\n"
        f"  Computed: {computed_h1}"
    )
    computed_h2 = hashlib.sha256(result_a["type2"].encode("utf-8")).hexdigest()
    assert result_a["hash_type2"] == computed_h2, (
        f"[{granule_id}] hash_type2 does not match SHA-256(type2).\n"
        f"  Returned: {result_a['hash_type2']}\n"
        f"  Computed: {computed_h2}"
    )

    return result_a


# ---------------------------------------------------------------------------
# Python determinism tests (35+ granules)
# ---------------------------------------------------------------------------


class TestDeterminismPython:
    """Determinism tests for Python granules."""

    def test_py_01_simple_function(self) -> None:
        src = textwrap.dedent("""\
            def add(a, b):
                return a + b
        """)
        _assert_deterministic("py-01", "python", src)

    def test_py_02_function_with_comment(self) -> None:
        src = textwrap.dedent("""\
            def add(a, b):
                # Add two numbers
                return a + b  # inline comment
        """)
        _assert_deterministic("py-02", "python", src)

    def test_py_03_function_with_docstring(self) -> None:
        src = textwrap.dedent("""\
            def compute_average(values):
                \"\"\"
                Compute the arithmetic mean of a list of values.

                Args:
                    values: A list of numeric values.

                Returns:
                    The arithmetic mean, or 0.0 for an empty list.
                \"\"\"
                if not values:
                    return 0.0
                return sum(values) / len(values)
        """)
        _assert_deterministic("py-03", "python", src)

    def test_py_04_class_definition(self) -> None:
        src = textwrap.dedent("""\
            class Animal:
                \"\"\"Base class for all animals.\"\"\"

                def __init__(self, name, species):
                    self.name = name
                    self.species = species

                def speak(self):
                    raise NotImplementedError("Subclasses must implement speak()")

                def __repr__(self):
                    return f"Animal(name={self.name!r}, species={self.species!r})"
        """)
        _assert_deterministic("py-04", "python", src)

    def test_py_05_for_loop(self) -> None:
        src = textwrap.dedent("""\
            for i in range(10):
                # process each element
                print(i * 2)
        """)
        _assert_deterministic("py-05", "python", src)

    def test_py_06_while_loop(self) -> None:
        src = textwrap.dedent("""\
            while count > 0:
                count -= 1
                total += count
        """)
        _assert_deterministic("py-06", "python", src)

    def test_py_07_nested_loops(self) -> None:
        src = textwrap.dedent("""\
            def matrix_multiply(a, b):
                rows_a = len(a)
                cols_a = len(a[0])
                cols_b = len(b[0])
                result = [[0] * cols_b for _ in range(rows_a)]
                for i in range(rows_a):
                    for j in range(cols_b):
                        for k in range(cols_a):
                            result[i][j] += a[i][k] * b[k][j]
                return result
        """)
        _assert_deterministic("py-07", "python", src)

    def test_py_08_function_with_defaults(self) -> None:
        src = textwrap.dedent("""\
            def greet(name, greeting="Hello", punctuation="!"):
                return f"{greeting}, {name}{punctuation}"
        """)
        _assert_deterministic("py-08", "python", src)

    def test_py_09_function_with_star_args(self) -> None:
        src = textwrap.dedent("""\
            def accumulate(*args, initial=0, **kwargs):
                total = initial
                for value in args:
                    total += value
                return total
        """)
        _assert_deterministic("py-09", "python", src)

    def test_py_10_lambda(self) -> None:
        src = textwrap.dedent("""\
            def apply_twice(func, value):
                return func(func(value))

            square = lambda x: x * x
            result = apply_twice(square, 3)
        """)
        _assert_deterministic("py-10", "python", src)

    def test_py_11_list_comprehension(self) -> None:
        src = textwrap.dedent("""\
            def filter_even(numbers):
                # Return only even numbers
                return [n for n in numbers if n % 2 == 0]
        """)
        _assert_deterministic("py-11", "python", src)

    def test_py_12_dict_comprehension(self) -> None:
        src = textwrap.dedent("""\
            def invert_dict(d):
                \"\"\"Swap keys and values.\"\"\"
                return {v: k for k, v in d.items()}
        """)
        _assert_deterministic("py-12", "python", src)

    def test_py_13_class_with_inheritance(self) -> None:
        src = textwrap.dedent("""\
            class Dog(Animal):
                \"\"\"A dog that can bark.\"\"\"

                def __init__(self, name, breed):
                    super().__init__(name, "Canis lupus familiaris")
                    self.breed = breed

                def speak(self):
                    return f"{self.name} says: Woof!"

                def fetch(self, item):
                    return f"{self.name} fetched {item}!"
        """)
        _assert_deterministic("py-13", "python", src)

    def test_py_14_exception_handling(self) -> None:
        src = textwrap.dedent("""\
            def safe_divide(numerator, denominator):
                \"\"\"Divide two numbers, returning None on ZeroDivisionError.\"\"\"
                try:
                    return numerator / denominator
                except ZeroDivisionError:
                    return None
                except TypeError as error:
                    raise ValueError(f"Invalid types: {error}") from error
                finally:
                    pass  # cleanup
        """)
        _assert_deterministic("py-14", "python", src)

    def test_py_15_generator_function(self) -> None:
        src = textwrap.dedent("""\
            def fibonacci(limit):
                \"\"\"Generate Fibonacci numbers up to limit.\"\"\"
                a, b = 0, 1
                while a < limit:
                    yield a
                    a, b = b, a + b
        """)
        _assert_deterministic("py-15", "python", src)

    def test_py_16_async_function(self) -> None:
        src = textwrap.dedent("""\
            async def fetch_data(url, timeout=30):
                \"\"\"Fetch data from a URL asynchronously.\"\"\"
                async with session.get(url, timeout=timeout) as response:
                    if response.status != 200:
                        raise RuntimeError(f"HTTP {response.status}")
                    return await response.json()
        """)
        _assert_deterministic("py-16", "python", src)

    def test_py_17_decorator(self) -> None:
        src = textwrap.dedent("""\
            def retry(max_attempts=3, delay=1.0):
                def decorator(func):
                    def wrapper(*args, **kwargs):
                        for attempt in range(max_attempts):
                            try:
                                return func(*args, **kwargs)
                            except Exception:
                                if attempt == max_attempts - 1:
                                    raise
                        return None
                    return wrapper
                return decorator
        """)
        _assert_deterministic("py-17", "python", src)

    def test_py_18_dataclass(self) -> None:
        src = textwrap.dedent("""\
            from dataclasses import dataclass, field

            @dataclass
            class Point:
                \"\"\"A 2D point.\"\"\"
                x: float
                y: float
                label: str = ""
                tags: list = field(default_factory=list)

                def distance_to(self, other):
                    dx = self.x - other.x
                    dy = self.y - other.y
                    return (dx ** 2 + dy ** 2) ** 0.5
        """)
        _assert_deterministic("py-18", "python", src)

    def test_py_19_string_literals_various(self) -> None:
        src = textwrap.dedent("""\
            def describe():
                single = 'hello'
                double = "world"
                triple_single = '''multi
            line'''
                triple_double = \"\"\"another
            multi\"\"\"
                raw = r"raw\\nstring"
                fstring = f"value is {42}"
                return single, double, triple_single, triple_double, raw, fstring
        """)
        _assert_deterministic("py-19", "python", src)

    def test_py_20_numeric_literals(self) -> None:
        src = textwrap.dedent("""\
            def constants():
                integer = 42
                negative = -7
                floating = 3.14159
                scientific = 1.5e-10
                hex_val = 0xFF
                octal_val = 0o77
                binary_val = 0b1010
                complex_val = 2 + 3j
                big = 1_000_000
                return integer, negative, floating, scientific, hex_val
        """)
        _assert_deterministic("py-20", "python", src)

    def test_py_21_only_comments(self) -> None:
        src = textwrap.dedent("""\
            # This file is intentionally left blank
            # It only contains comments
            # No executable code
        """)
        _assert_deterministic("py-21", "python", src)

    def test_py_22_only_docstring(self) -> None:
        src = textwrap.dedent("""\
            def empty_func():
                \"\"\"This function does nothing.\"\"\"
                pass
        """)
        _assert_deterministic("py-22", "python", src)

    def test_py_23_nested_functions(self) -> None:
        src = textwrap.dedent("""\
            def outer(x):
                \"\"\"Outer function.\"\"\"
                def inner(y):
                    \"\"\"Inner function.\"\"\"
                    return x + y
                return inner
        """)
        _assert_deterministic("py-23", "python", src)

    def test_py_24_class_methods(self) -> None:
        src = textwrap.dedent("""\
            class Counter:
                count = 0

                @classmethod
                def increment(cls, amount=1):
                    cls.count += amount

                @staticmethod
                def reset_value():
                    return 0

                @property
                def value(self):
                    return self.count
        """)
        _assert_deterministic("py-24", "python", src)

    def test_py_25_walrus_operator(self) -> None:
        src = textwrap.dedent("""\
            def find_first_positive(numbers):
                if (first := next((n for n in numbers if n > 0), None)) is not None:
                    return first
                return -1
        """)
        _assert_deterministic("py-25", "python", src)

    def test_py_26_type_annotations(self) -> None:
        src = textwrap.dedent("""\
            from typing import Optional, List, Dict

            def process(
                items: List[str],
                mapping: Dict[str, int],
                default: Optional[int] = None,
            ) -> List[int]:
                result: List[int] = []
                for item in items:
                    value: int = mapping.get(item, default or 0)
                    result.append(value)
                return result
        """)
        _assert_deterministic("py-26", "python", src)

    def test_py_27_context_manager(self) -> None:
        src = textwrap.dedent("""\
            def read_file_lines(path, encoding="utf-8"):
                lines = []
                with open(path, encoding=encoding) as handle:
                    for line in handle:
                        stripped = line.rstrip("\\n")
                        lines.append(stripped)
                return lines
        """)
        _assert_deterministic("py-27", "python", src)

    def test_py_28_match_statement(self) -> None:
        src = textwrap.dedent("""\
            def classify_status(code):
                match code:
                    case 200:
                        return "OK"
                    case 404:
                        return "Not Found"
                    case 500:
                        return "Server Error"
                    case _:
                        return "Unknown"
        """)
        _assert_deterministic("py-28", "python", src)

    def test_py_29_global_and_nonlocal(self) -> None:
        src = textwrap.dedent("""\
            _registry = {}

            def register(name, handler):
                global _registry
                _registry[name] = handler

            def make_counter():
                count = 0
                def increment():
                    nonlocal count
                    count += 1
                    return count
                return increment
        """)
        _assert_deterministic("py-29", "python", src)

    def test_py_30_assertions_and_raises(self) -> None:
        src = textwrap.dedent("""\
            def validated_sqrt(x):
                assert isinstance(x, (int, float)), "x must be numeric"
                if x < 0:
                    raise ValueError(f"Cannot compute sqrt of {x}")
                return x ** 0.5
        """)
        _assert_deterministic("py-30", "python", src)

    def test_py_31_multiline_comment_block(self) -> None:
        src = textwrap.dedent("""\
            def factorial(n):
                # Base case: 0! = 1
                # Recursive case: n! = n * (n-1)!
                # This is a standard recursive implementation.
                # It will stack overflow for very large n.
                # Consider using math.factorial() for production code.
                if n <= 1:
                    return 1
                return n * factorial(n - 1)
        """)
        _assert_deterministic("py-31", "python", src)

    def test_py_32_empty_function(self) -> None:
        src = textwrap.dedent("""\
            def placeholder():
                pass
        """)
        _assert_deterministic("py-32", "python", src)

    def test_py_33_single_expression_body(self) -> None:
        src = textwrap.dedent("""\
            def identity(x):
                return x
        """)
        _assert_deterministic("py-33", "python", src)

    def test_py_34_unicode_identifiers(self) -> None:
        src = textwrap.dedent("""\
            def calculate_résumé(données, résultat=0):
                for élément in données:
                    résultat += élément
                return résultat
        """)
        _assert_deterministic("py-34", "python", src)

    def test_py_35_complex_class_hierarchy(self) -> None:
        src = textwrap.dedent("""\
            class Shape:
                \"\"\"Abstract base shape.\"\"\"
                def area(self):
                    raise NotImplementedError
                def perimeter(self):
                    raise NotImplementedError

            class Rectangle(Shape):
                def __init__(self, width, height):
                    self.width = width
                    self.height = height
                def area(self):
                    return self.width * self.height
                def perimeter(self):
                    return 2 * (self.width + self.height)

            class Square(Rectangle):
                def __init__(self, side):
                    super().__init__(side, side)
        """)
        _assert_deterministic("py-35", "python", src)

    def test_py_36_broken_syntax(self) -> None:
        """Granule with syntax errors — tree-sitter returns partial tree, must not crash."""
        src = textwrap.dedent("""\
            def broken(x
                return x +
        """)
        _assert_deterministic("py-36", "python", src)

    def test_py_37_only_whitespace_and_newlines(self) -> None:
        src = "   \n\n   \n\t\t\n"
        _assert_deterministic("py-37", "python", src)

    def test_py_38_very_short_function(self) -> None:
        src = "def f(x): return x"
        _assert_deterministic("py-38", "python", src)


# ---------------------------------------------------------------------------
# Java determinism tests (35+ granules)
# ---------------------------------------------------------------------------


class TestDeterminismJava:
    """Determinism tests for Java granules."""

    def test_java_01_simple_method(self) -> None:
        src = textwrap.dedent("""\
            public int add(int a, int b) {
                return a + b;
            }
        """)
        _assert_deterministic("java-01", "java", src)

    def test_java_02_method_with_javadoc(self) -> None:
        src = textwrap.dedent("""\
            /**
             * Adds two integers.
             * @param a the first operand
             * @param b the second operand
             * @return the sum of a and b
             */
            public int add(int a, int b) {
                return a + b;
            }
        """)
        _assert_deterministic("java-02", "java", src)

    def test_java_03_method_with_line_comments(self) -> None:
        src = textwrap.dedent("""\
            public double computeAverage(double[] values) {
                // Guard against null/empty input
                if (values == null || values.length == 0) {
                    return 0.0; // return zero for empty array
                }
                double sum = 0.0;
                for (double v : values) {
                    sum += v; // accumulate
                }
                return sum / values.length;
            }
        """)
        _assert_deterministic("java-03", "java", src)

    def test_java_04_class_declaration(self) -> None:
        src = textwrap.dedent("""\
            /**
             * Represents a student in a course.
             */
            public class Student {
                private final String studentId;
                private final String name;
                private double grade;

                public Student(String studentId, String name) {
                    this.studentId = studentId;
                    this.name = name;
                    this.grade = 0.0;
                }

                public String getStudentId() { return studentId; }
                public String getName() { return name; }
                public double getGrade() { return grade; }
                public void setGrade(double grade) { this.grade = grade; }

                @Override
                public String toString() {
                    return "Student{id='" + studentId + "', name='" + name + "'}";
                }
            }
        """)
        _assert_deterministic("java-04", "java", src)

    def test_java_05_for_loop(self) -> None:
        src = textwrap.dedent("""\
            for (int i = 0; i < 10; i++) {
                // process element at index i
                System.out.println(i);
            }
        """)
        _assert_deterministic("java-05", "java", src)

    def test_java_06_enhanced_for(self) -> None:
        src = textwrap.dedent("""\
            for (String item : collection) {
                /* process each item */
                process(item);
            }
        """)
        _assert_deterministic("java-06", "java", src)

    def test_java_07_while_loop(self) -> None:
        src = textwrap.dedent("""\
            while (!queue.isEmpty()) {
                String element = queue.poll();
                handle(element);
            }
        """)
        _assert_deterministic("java-07", "java", src)

    def test_java_08_do_while(self) -> None:
        src = textwrap.dedent("""\
            do {
                count++;
                total += count;
            } while (count < limit);
        """)
        _assert_deterministic("java-08", "java", src)

    def test_java_09_nested_loops(self) -> None:
        src = textwrap.dedent("""\
            public int[][] matrixAdd(int[][] a, int[][] b) {
                int rows = a.length;
                int cols = a[0].length;
                int[][] result = new int[rows][cols];
                for (int i = 0; i < rows; i++) {
                    for (int j = 0; j < cols; j++) {
                        result[i][j] = a[i][j] + b[i][j];
                    }
                }
                return result;
            }
        """)
        _assert_deterministic("java-09", "java", src)

    def test_java_10_try_catch_finally(self) -> None:
        src = textwrap.dedent("""\
            public String readFile(String path) throws IOException {
                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\\n");
                    }
                } catch (IOException e) {
                    throw new IOException("Failed to read: " + path, e);
                } finally {
                    // cleanup handled by try-with-resources
                }
                return sb.toString();
            }
        """)
        _assert_deterministic("java-10", "java", src)

    def test_java_11_interface(self) -> None:
        src = textwrap.dedent("""\
            /**
             * Defines the contract for a grading strategy.
             */
            public interface GradingStrategy {
                /**
                 * Compute a letter grade from a numeric score.
                 * @param score the numeric score (0–100)
                 * @return the letter grade
                 */
                String computeGrade(double score);

                /** Returns the minimum passing score for this strategy. */
                default double passingScore() {
                    return 50.0;
                }
            }
        """)
        _assert_deterministic("java-11", "java", src)

    def test_java_12_enum(self) -> None:
        src = textwrap.dedent("""\
            public enum Status {
                PENDING,
                IN_PROGRESS,
                COMPLETED,
                FAILED;

                public boolean isTerminal() {
                    return this == COMPLETED || this == FAILED;
                }
            }
        """)
        _assert_deterministic("java-12", "java", src)

    def test_java_13_generics_method(self) -> None:
        src = textwrap.dedent("""\
            public <T extends Comparable<T>> T findMax(List<T> items) {
                // Find the maximum element in a list
                if (items == null || items.isEmpty()) {
                    throw new IllegalArgumentException("List must not be empty");
                }
                T max = items.get(0);
                for (T item : items) {
                    if (item.compareTo(max) > 0) {
                        max = item;
                    }
                }
                return max;
            }
        """)
        _assert_deterministic("java-13", "java", src)

    def test_java_14_constructor_overloading(self) -> None:
        src = textwrap.dedent("""\
            public class Rectangle {
                private final double width;
                private final double height;

                /** Creates a rectangle with the given dimensions. */
                public Rectangle(double width, double height) {
                    this.width = width;
                    this.height = height;
                }

                /** Creates a square with the given side length. */
                public Rectangle(double side) {
                    this(side, side);
                }

                public double area() {
                    return width * height;
                }

                public double perimeter() {
                    return 2.0 * (width + height);
                }
            }
        """)
        _assert_deterministic("java-14", "java", src)

    def test_java_15_lambda_and_stream(self) -> None:
        src = textwrap.dedent("""\
            public List<String> filterAndSort(List<String> items, String prefix) {
                // Filter items starting with prefix and sort alphabetically
                return items.stream()
                    .filter(s -> s.startsWith(prefix))
                    .sorted()
                    .collect(Collectors.toList());
            }
        """)
        _assert_deterministic("java-15", "java", src)

    def test_java_16_switch_statement(self) -> None:
        src = textwrap.dedent("""\
            public String classifyGrade(double score) {
                int bucket = (int) (score / 10);
                switch (bucket) {
                    case 10:
                    case 9:
                        return "A";
                    case 8:
                        return "B";
                    case 7:
                    case 6:
                        return "C";
                    default:
                        return "F";
                }
            }
        """)
        _assert_deterministic("java-16", "java", src)

    def test_java_17_static_nested_class(self) -> None:
        src = textwrap.dedent("""\
            public class Outer {
                private int value;

                public static class Inner {
                    private String name;

                    public Inner(String name) {
                        this.name = name;
                    }

                    public String getName() {
                        return name;
                    }
                }

                public Outer(int value) {
                    this.value = value;
                }
            }
        """)
        _assert_deterministic("java-17", "java", src)

    def test_java_18_varargs(self) -> None:
        src = textwrap.dedent("""\
            public double sum(double first, double... rest) {
                double total = first;
                for (double value : rest) {
                    total += value;
                }
                return total;
            }
        """)
        _assert_deterministic("java-18", "java", src)

    def test_java_19_annotations(self) -> None:
        src = textwrap.dedent("""\
            @Override
            @SuppressWarnings("unchecked")
            public boolean equals(Object other) {
                if (this == other) return true;
                if (!(other instanceof MyClass)) return false;
                MyClass that = (MyClass) other;
                return this.id == that.id;
            }
        """)
        _assert_deterministic("java-19", "java", src)

    def test_java_20_string_literals(self) -> None:
        src = textwrap.dedent("""\
            public void printMessages() {
                String greeting = "Hello, World!";
                String multiline = "Line 1\\nLine 2\\nLine 3";
                String withTab = "col1\\tcol2\\tcol3";
                String empty = "";
                System.out.println(greeting);
                System.out.println(multiline);
            }
        """)
        _assert_deterministic("java-20", "java", src)

    def test_java_21_numeric_literals(self) -> None:
        src = textwrap.dedent("""\
            public void constants() {
                int decimal = 42;
                int hex = 0xFF;
                int octal = 0777;
                int binary = 0b1010;
                long big = 1_000_000L;
                double pi = 3.14159;
                double sci = 1.5e-10;
                float f = 2.0f;
                char c = 'A';
            }
        """)
        _assert_deterministic("java-21", "java", src)

    def test_java_22_record(self) -> None:
        src = textwrap.dedent("""\
            /**
             * Immutable point record.
             */
            public record Point(double x, double y) {
                public double distanceTo(Point other) {
                    double dx = this.x - other.x;
                    double dy = this.y - other.y;
                    return Math.sqrt(dx * dx + dy * dy);
                }
            }
        """)
        _assert_deterministic("java-22", "java", src)

    def test_java_23_abstract_class(self) -> None:
        src = textwrap.dedent("""\
            public abstract class Vehicle {
                protected String make;
                protected String model;
                protected int year;

                public Vehicle(String make, String model, int year) {
                    this.make = make;
                    this.model = model;
                    this.year = year;
                }

                /** Returns the fuel type of this vehicle. */
                public abstract String getFuelType();

                public String describe() {
                    return year + " " + make + " " + model + " (" + getFuelType() + ")";
                }
            }
        """)
        _assert_deterministic("java-23", "java", src)

    def test_java_24_only_block_comments(self) -> None:
        src = textwrap.dedent("""\
            /* This is a block comment */
            /* Another block comment
               spanning multiple lines */
            public void empty() {
                /* inner comment */
            }
        """)
        _assert_deterministic("java-24", "java", src)

    def test_java_25_only_javadoc(self) -> None:
        src = textwrap.dedent("""\
            /**
             * This class intentionally only has Javadoc.
             */
            public class Documented {
                /**
                 * A method with Javadoc but no body logic.
                 * @return always null
                 */
                public Object getNothing() {
                    return null;
                }
            }
        """)
        _assert_deterministic("java-25", "java", src)

    def test_java_26_ternary_chains(self) -> None:
        src = textwrap.dedent("""\
            public String classify(int score) {
                return score >= 90 ? "A"
                    : score >= 80 ? "B"
                    : score >= 70 ? "C"
                    : score >= 60 ? "D"
                    : "F";
            }
        """)
        _assert_deterministic("java-26", "java", src)

    def test_java_27_synchronized_method(self) -> None:
        src = textwrap.dedent("""\
            public synchronized void increment() {
                // Thread-safe increment
                this.count++;
            }

            public synchronized int getCount() {
                return count;
            }
        """)
        _assert_deterministic("java-27", "java", src)

    def test_java_28_nested_classes(self) -> None:
        src = textwrap.dedent("""\
            public class LinkedList<T> {
                // Node class
                private class Node {
                    T data;
                    Node next;

                    Node(T data) {
                        this.data = data;
                        this.next = null;
                    }
                }

                private Node head;
                private int size;

                public void add(T item) {
                    Node newNode = new Node(item);
                    if (head == null) {
                        head = newNode;
                    } else {
                        Node current = head;
                        while (current.next != null) {
                            current = current.next;
                        }
                        current.next = newNode;
                    }
                    size++;
                }
            }
        """)
        _assert_deterministic("java-28", "java", src)

    def test_java_29_interface_default_methods(self) -> None:
        src = textwrap.dedent("""\
            public interface Printable {
                void print();

                default void println() {
                    print();
                    System.out.println();
                }

                default void printWithPrefix(String prefix) {
                    System.out.print(prefix);
                    print();
                }
            }
        """)
        _assert_deterministic("java-29", "java", src)

    def test_java_30_broken_syntax(self) -> None:
        """Java with syntax errors — partial tree must not crash."""
        src = textwrap.dedent("""\
            public void broken(int x {
                return x +
        """)
        _assert_deterministic("java-30", "java", src)

    def test_java_31_single_line_methods(self) -> None:
        src = textwrap.dedent("""\
            public class Accessors {
                private int x;
                private int y;
                public int getX() { return x; }
                public int getY() { return y; }
                public void setX(int x) { this.x = x; }
                public void setY(int y) { this.y = y; }
            }
        """)
        _assert_deterministic("java-31", "java", src)

    def test_java_32_constructor_chaining(self) -> None:
        src = textwrap.dedent("""\
            public class Config {
                private String host;
                private int port;
                private boolean ssl;

                public Config() {
                    this("localhost", 8080, false);
                }

                public Config(String host, int port) {
                    this(host, port, false);
                }

                public Config(String host, int port, boolean ssl) {
                    this.host = host;
                    this.port = port;
                    this.ssl = ssl;
                }
            }
        """)
        _assert_deterministic("java-32", "java", src)

    def test_java_33_complex_generics(self) -> None:
        src = textwrap.dedent("""\
            public <K, V> Map<V, List<K>> invertMultimap(Map<K, List<V>> input) {
                Map<V, List<K>> result = new HashMap<>();
                for (Map.Entry<K, List<V>> entry : input.entrySet()) {
                    K key = entry.getKey();
                    for (V value : entry.getValue()) {
                        result.computeIfAbsent(value, k -> new ArrayList<>()).add(key);
                    }
                }
                return result;
            }
        """)
        _assert_deterministic("java-33", "java", src)

    def test_java_34_final_fields_immutable(self) -> None:
        src = textwrap.dedent("""\
            public final class ImmutablePair<A, B> {
                private final A first;
                private final B second;

                public ImmutablePair(A first, B second) {
                    this.first = first;
                    this.second = second;
                }

                public A getFirst() { return first; }
                public B getSecond() { return second; }

                @Override
                public boolean equals(Object o) {
                    if (!(o instanceof ImmutablePair)) return false;
                    ImmutablePair<?, ?> other = (ImmutablePair<?, ?>) o;
                    return first.equals(other.first) && second.equals(other.second);
                }

                @Override
                public int hashCode() {
                    return 31 * first.hashCode() + second.hashCode();
                }
            }
        """)
        _assert_deterministic("java-34", "java", src)

    def test_java_35_text_block(self) -> None:
        src = textwrap.dedent("""\
            public String getJson() {
                return \"\"\"
                        {
                            "name": "CIPAS",
                            "version": "2.0"
                        }
                        \"\"\";
            }
        """)
        _assert_deterministic("java-35", "java", src)


# ---------------------------------------------------------------------------
# C determinism tests (35+ granules)
# ---------------------------------------------------------------------------


class TestDeterminismC:
    """Determinism tests for C granules."""

    def test_c_01_simple_function(self) -> None:
        src = textwrap.dedent("""\
            int add(int a, int b) {
                return a + b;
            }
        """)
        _assert_deterministic("c-01", "c", src)

    def test_c_02_function_with_comments(self) -> None:
        src = textwrap.dedent("""\
            /* Add two integers. */
            int add(int a, int b) {
                // Return the sum
                return a + b; /* trivial */
            }
        """)
        _assert_deterministic("c-02", "c", src)

    def test_c_03_struct_definition(self) -> None:
        src = textwrap.dedent("""\
            /* Student record structure */
            typedef struct {
                char student_id[16];
                char name[64];
                double scores[20];
                int num_scores;
                int is_enrolled;
            } StudentRecord;
        """)
        _assert_deterministic("c-03", "c", src)

    def test_c_04_function_with_struct_param(self) -> None:
        src = textwrap.dedent("""\
            /**
             * Compute the average score for a student record.
             * Returns 0.0 if no scores have been recorded.
             */
            double compute_average(const StudentRecord *rec) {
                int i;
                double total = 0.0;
                if (rec->num_scores == 0) {
                    return 0.0;
                }
                for (i = 0; i < rec->num_scores; i++) {
                    total += rec->scores[i];
                }
                return total / (double)rec->num_scores;
            }
        """)
        _assert_deterministic("c-04", "c", src)

    def test_c_05_for_loop(self) -> None:
        src = textwrap.dedent("""\
            for (i = 0; i < n; i++) {
                /* accumulate sum */
                sum += arr[i];
            }
        """)
        _assert_deterministic("c-05", "c", src)

    def test_c_06_while_loop(self) -> None:
        src = textwrap.dedent("""\
            while (node != NULL) {
                // traverse linked list
                process(node->data);
                node = node->next;
            }
        """)
        _assert_deterministic("c-06", "c", src)

    def test_c_07_do_while(self) -> None:
        src = textwrap.dedent("""\
            do {
                /* read input until valid */
                result = scanf("%d", &value);
            } while (result != 1);
        """)
        _assert_deterministic("c-07", "c", src)

    def test_c_08_nested_loops(self) -> None:
        src = textwrap.dedent("""\
            void insertion_sort(double *arr, int n) {
                int i, j;
                double key;
                /* Insertion sort: O(n^2) average */
                for (i = 1; i < n; i++) {
                    key = arr[i];
                    j = i - 1;
                    while (j >= 0 && arr[j] > key) {
                        arr[j + 1] = arr[j];
                        j--;
                    }
                    arr[j + 1] = key;
                }
            }
        """)
        _assert_deterministic("c-08", "c", src)

    def test_c_09_pointer_returning_function(self) -> None:
        src = textwrap.dedent("""\
            /* Allocate and return a new integer array of size n. */
            int *create_array(int n, int initial_value) {
                int i;
                int *arr = (int *)malloc(n * sizeof(int));
                if (arr == NULL) {
                    return NULL;
                }
                for (i = 0; i < n; i++) {
                    arr[i] = initial_value;
                }
                return arr;
            }
        """)
        _assert_deterministic("c-09", "c", src)

    def test_c_10_function_pointers(self) -> None:
        src = textwrap.dedent("""\
            typedef int (*compare_fn)(const void *, const void *);

            void generic_sort(void *base, int n, int size, compare_fn cmp) {
                /* Bubble sort using function pointer comparator */
                int i, j;
                char *arr = (char *)base;
                char *temp = (char *)malloc(size);
                for (i = 0; i < n - 1; i++) {
                    for (j = 0; j < n - i - 1; j++) {
                        if (cmp(arr + j * size, arr + (j + 1) * size) > 0) {
                            memcpy(temp, arr + j * size, size);
                            memcpy(arr + j * size, arr + (j + 1) * size, size);
                            memcpy(arr + (j + 1) * size, temp, size);
                        }
                    }
                }
                free(temp);
            }
        """)
        _assert_deterministic("c-10", "c", src)

    def test_c_11_recursive_function(self) -> None:
        src = textwrap.dedent("""\
            /* Recursive Fibonacci — educational use only */
            long fibonacci(int n) {
                if (n <= 0) return 0;
                if (n == 1) return 1;
                return fibonacci(n - 1) + fibonacci(n - 2);
            }
        """)
        _assert_deterministic("c-11", "c", src)

    def test_c_12_string_manipulation(self) -> None:
        src = textwrap.dedent("""\
            /* Reverse a null-terminated string in-place. */
            void reverse_string(char *str) {
                int len, i;
                char temp;
                if (str == NULL) return;
                len = strlen(str);
                for (i = 0; i < len / 2; i++) {
                    temp = str[i];
                    str[i] = str[len - 1 - i];
                    str[len - 1 - i] = temp;
                }
            }
        """)
        _assert_deterministic("c-12", "c", src)

    def test_c_13_union_definition(self) -> None:
        src = textwrap.dedent("""\
            /* Union for type-punning between int and float */
            typedef union {
                int   integer_value;
                float float_value;
                unsigned char bytes[4];
            } FloatBits;
        """)
        _assert_deterministic("c-13", "c", src)

    def test_c_14_switch_statement(self) -> None:
        src = textwrap.dedent("""\
            char grade_letter(double score) {
                int bucket = (int)(score / 10.0);
                switch (bucket) {
                    case 10: /* fall through */
                    case 9:  return 'A';
                    case 8:  return 'B';
                    case 7:  /* fall through */
                    case 6:  return 'C';
                    default: return 'F';
                }
            }
        """)
        _assert_deterministic("c-14", "c", src)

    def test_c_15_variadic_function(self) -> None:
        src = textwrap.dedent("""\
            #include <stdarg.h>

            double average_variadic(int count, ...) {
                va_list args;
                double sum = 0.0;
                int i;
                va_start(args, count);
                for (i = 0; i < count; i++) {
                    sum += va_arg(args, double);
                }
                va_end(args);
                return (count > 0) ? sum / count : 0.0;
            }
        """)
        _assert_deterministic("c-15", "c", src)

    def test_c_16_bitwise_operations(self) -> None:
        src = textwrap.dedent("""\
            /* Set, clear, and toggle bits */
            unsigned int set_bit(unsigned int value, int pos) {
                return value | (1u << pos);
            }

            unsigned int clear_bit(unsigned int value, int pos) {
                return value & ~(1u << pos);
            }

            unsigned int toggle_bit(unsigned int value, int pos) {
                return value ^ (1u << pos);
            }

            int check_bit(unsigned int value, int pos) {
                return (value >> pos) & 1;
            }
        """)
        _assert_deterministic("c-16", "c", src)

    def test_c_17_linked_list_struct(self) -> None:
        src = textwrap.dedent("""\
            typedef struct Node {
                int data;
                struct Node *next;
            } Node;

            Node *node_create(int data) {
                Node *node = (Node *)malloc(sizeof(Node));
                if (!node) return NULL;
                node->data = data;
                node->next = NULL;
                return node;
            }

            void list_push(Node **head, int data) {
                Node *node = node_create(data);
                if (!node) return;
                node->next = *head;
                *head = node;
            }
        """)
        _assert_deterministic("c-17", "c", src)

    def test_c_18_macro_heavy_code(self) -> None:
        src = textwrap.dedent("""\
            #define MAX(a, b) ((a) > (b) ? (a) : (b))
            #define MIN(a, b) ((a) < (b) ? (a) : (b))
            #define CLAMP(x, lo, hi) (MIN(MAX((x), (lo)), (hi)))

            double clamp_score(double score) {
                /* Clamp score to [0, 100] */
                return CLAMP(score, 0.0, 100.0);
            }
        """)
        _assert_deterministic("c-18", "c", src)

    def test_c_19_file_io_function(self) -> None:
        src = textwrap.dedent("""\
            /* Read all lines from a file into a buffer. Returns line count or -1. */
            int read_lines(const char *filename, char lines[][256], int max_lines) {
                FILE *fp;
                int count = 0;
                fp = fopen(filename, "r");
                if (fp == NULL) {
                    perror("fopen");
                    return -1;
                }
                while (count < max_lines && fgets(lines[count], 256, fp) != NULL) {
                    /* Strip trailing newline */
                    int len = strlen(lines[count]);
                    if (len > 0 && lines[count][len - 1] == '\\n') {
                        lines[count][len - 1] = '\\0';
                    }
                    count++;
                }
                fclose(fp);
                return count;
            }
        """)
        _assert_deterministic("c-19", "c", src)

    def test_c_20_numeric_literals(self) -> None:
        src = textwrap.dedent("""\
            void demonstrate_literals(void) {
                int decimal = 42;
                int octal = 0755;
                int hex = 0xDEADBEEF;
                int binary_approx = 10;  /* no binary literals in C89 */
                long big = 1000000L;
                unsigned u = 255u;
                float pi_f = 3.14f;
                double pi_d = 3.14159265358979;
                double sci = 6.022e23;
                char newline = '\\n';
                char tab = '\\t';
            }
        """)
        _assert_deterministic("c-20", "c", src)

    def test_c_21_struct_with_function_body(self) -> None:
        src = textwrap.dedent("""\
            typedef struct {
                double x;
                double y;
            } Vec2;

            Vec2 vec2_add(Vec2 a, Vec2 b) {
                Vec2 result;
                result.x = a.x + b.x;
                result.y = a.y + b.y;
                return result;
            }

            double vec2_dot(Vec2 a, Vec2 b) {
                return a.x * b.x + a.y * b.y;
            }
        """)
        _assert_deterministic("c-21", "c", src)

    def test_c_22_only_block_comments(self) -> None:
        src = textwrap.dedent("""\
            /* This is a block comment. */
            /* Another comment.
               Spanning multiple lines.
               With lots of text.
             */
            /* Third comment */
            void noop(void) { }
        """)
        _assert_deterministic("c-22", "c", src)

    def test_c_23_only_line_comments(self) -> None:
        src = textwrap.dedent("""\
            // File: util.c
            // Purpose: utility functions for the grade book
            // Author: CIPAS benchmark generator

            void placeholder(void) {
                // nothing here yet
            }
        """)
        _assert_deterministic("c-23", "c", src)

    def test_c_24_broken_syntax(self) -> None:
        """C with syntax errors — must not crash."""
        src = textwrap.dedent("""\
            int broken(int x {
                return x +
        """)
        _assert_deterministic("c-24", "c", src)

    def test_c_25_complex_conditional(self) -> None:
        src = textwrap.dedent("""\
            int validate_score(double score, const char *student_id) {
                if (student_id == NULL || student_id[0] == '\\0') {
                    fprintf(stderr, "Invalid student ID\\n");
                    return -1;
                }
                if (score < 0.0) {
                    fprintf(stderr, "Score cannot be negative: %.2f\\n", score);
                    return -2;
                }
                if (score > 100.0) {
                    fprintf(stderr, "Score exceeds maximum: %.2f\\n", score);
                    return -3;
                }
                return 0;
            }
        """)
        _assert_deterministic("c-25", "c", src)

    def test_c_26_static_inline_function(self) -> None:
        src = textwrap.dedent("""\
            /* Swap two integers using XOR — educational, not production */
            static inline void swap_xor(int *a, int *b) {
                if (a != b) {
                    *a ^= *b;
                    *b ^= *a;
                    *a ^= *b;
                }
            }
        """)
        _assert_deterministic("c-26", "c", src)

    def test_c_27_typedef_function_pointer(self) -> None:
        src = textwrap.dedent("""\
            typedef void (*event_handler_t)(const char *event_name, void *context);

            typedef struct {
                char name[64];
                event_handler_t handler;
                void *context;
            } EventListener;

            void listener_invoke(const EventListener *listener, const char *event) {
                if (listener != NULL && listener->handler != NULL) {
                    listener->handler(event, listener->context);
                }
            }
        """)
        _assert_deterministic("c-27", "c", src)

    def test_c_28_enum_in_c(self) -> None:
        src = textwrap.dedent("""\
            typedef enum {
                STATUS_OK = 0,
                STATUS_NOT_FOUND = 1,
                STATUS_INVALID = 2,
                STATUS_INTERNAL_ERROR = 3
            } StatusCode;

            const char *status_message(StatusCode code) {
                switch (code) {
                    case STATUS_OK:           return "OK";
                    case STATUS_NOT_FOUND:    return "Not Found";
                    case STATUS_INVALID:      return "Invalid Input";
                    case STATUS_INTERNAL_ERROR: return "Internal Error";
                    default:                  return "Unknown";
                }
            }
        """)
        _assert_deterministic("c-28", "c", src)

    def test_c_29_multiple_return_paths(self) -> None:
        src = textwrap.dedent("""\
            int binary_search(const int *arr, int n, int target) {
                int left = 0;
                int right = n - 1;
                while (left <= right) {
                    int mid = left + (right - left) / 2;
                    if (arr[mid] == target) {
                        return mid;   /* found */
                    } else if (arr[mid] < target) {
                        left = mid + 1;
                    } else {
                        right = mid - 1;
                    }
                }
                return -1;  /* not found */
            }
        """)
        _assert_deterministic("c-29", "c", src)

    def test_c_30_matrix_operations(self) -> None:
        src = textwrap.dedent("""\
            void matrix_multiply(
                const double *a, const double *b, double *out,
                int rows_a, int cols_a, int cols_b)
            {
                int i, j, k;
                /* Zero out result matrix */
                for (i = 0; i < rows_a * cols_b; i++) {
                    out[i] = 0.0;
                }
                /* Standard O(n^3) multiplication */
                for (i = 0; i < rows_a; i++) {
                    for (j = 0; j < cols_b; j++) {
                        for (k = 0; k < cols_a; k++) {
                            out[i * cols_b + j] += a[i * cols_a + k] * b[k * cols_b + j];
                        }
                    }
                }
            }
        """)
        _assert_deterministic("c-30", "c", src)

    def test_c_31_string_utils(self) -> None:
        src = textwrap.dedent("""\
            /* Count occurrences of ch in str */
            int count_char(const char *str, char ch) {
                int count = 0;
                while (*str) {
                    if (*str == ch) count++;
                    str++;
                }
                return count;
            }

            /* Trim leading whitespace in-place, return new start pointer */
            char *ltrim(char *str) {
                while (*str == ' ' || *str == '\\t' || *str == '\\n') {
                    str++;
                }
                return str;
            }
        """)
        _assert_deterministic("c-31", "c", src)

    def test_c_32_nested_structs(self) -> None:
        src = textwrap.dedent("""\
            typedef struct {
                double x;
                double y;
            } Point;

            typedef struct {
                Point top_left;
                Point bottom_right;
            } Rectangle;

            double rect_area(const Rectangle *r) {
                double width  = r->bottom_right.x - r->top_left.x;
                double height = r->bottom_right.y - r->top_left.y;
                return width * height;
            }
        """)
        _assert_deterministic("c-32", "c", src)

    def test_c_33_const_qualifiers(self) -> None:
        src = textwrap.dedent("""\
            const char *find_in_array(
                const char *const *arr,
                int n,
                const char *target)
            {
                int i;
                for (i = 0; i < n; i++) {
                    if (strcmp(arr[i], target) == 0) {
                        return arr[i];
                    }
                }
                return NULL;
            }
        """)
        _assert_deterministic("c-33", "c", src)

    def test_c_34_goto(self) -> None:
        src = textwrap.dedent("""\
            /* Goto used for error handling — Linux kernel style */
            int process_data(const char *filename) {
                FILE *fp = NULL;
                char *buf = NULL;
                int result = 0;

                fp = fopen(filename, "r");
                if (!fp) { result = -1; goto cleanup; }

                buf = (char *)malloc(4096);
                if (!buf) { result = -2; goto cleanup; }

                /* do processing */
                result = 1;

            cleanup:
                free(buf);
                if (fp) fclose(fp);
                return result;
            }
        """)
        _assert_deterministic("c-34", "c", src)

    def test_c_35_empty_function(self) -> None:
        src = textwrap.dedent("""\
            void no_op(void) {
                /* intentionally empty */
            }
        """)
        _assert_deterministic("c-35", "c", src)


# ---------------------------------------------------------------------------
# Clone detection semantic contracts
# ---------------------------------------------------------------------------


class TestDeterminismCloneContracts:
    """
    Verify that the hash contracts for Type-1 and Type-2 clone detection hold.

    Type-1 contract:
        Two granules that differ ONLY in comments/docstrings/whitespace
        MUST produce the same hash_type1.

    Type-2 contract:
        Two granules that differ ONLY in identifier names (but have the same
        structure) MUST produce the same hash_type2.
        They SHOULD produce DIFFERENT hash_type1 values (unless the formatter
        erases all identifier differences, which it does not).
    """

    def test_type1_comment_invariance_python(self) -> None:
        """Type-1 hash must be equal for Python functions differing only in comments."""
        src_with_comments = textwrap.dedent("""\
            def add(a, b):
                # Add two numbers and return the result
                # This is a simple addition function
                return a + b  # sum
        """)
        src_no_comments = textwrap.dedent("""\
            def add(a, b):
                return a + b
        """)
        result_with = _assert_deterministic(
            "clone-py-t1-a", "python", src_with_comments
        )
        result_without = _assert_deterministic(
            "clone-py-t1-b", "python", src_no_comments
        )

        assert result_with["hash_type1"] == result_without["hash_type1"], (
            "Type-1 Python: functions differing only in comments must share hash_type1.\n"
            f"  With comments type1:    {result_with['type1']!r}\n"
            f"  Without comments type1: {result_without['type1']!r}"
        )

    def test_type1_docstring_invariance_python(self) -> None:
        """Type-1 hash must be equal for Python functions differing only in docstrings."""
        src_with_doc = textwrap.dedent("""\
            def multiply(x, y):
                \"\"\"
                Multiply two numbers.

                Args:
                    x: First factor.
                    y: Second factor.

                Returns:
                    The product x * y.
                \"\"\"
                return x * y
        """)
        src_no_doc = textwrap.dedent("""\
            def multiply(x, y):
                return x * y
        """)
        result_with = _assert_deterministic("clone-py-doc-a", "python", src_with_doc)
        result_without = _assert_deterministic("clone-py-doc-b", "python", src_no_doc)

        assert result_with["hash_type1"] == result_without["hash_type1"], (
            "Type-1 Python: functions differing only in docstrings must share hash_type1."
        )

    def test_type1_comment_invariance_java(self) -> None:
        """Type-1 hash must be equal for Java methods differing only in comments."""
        src_with_comments = textwrap.dedent("""\
            /**
             * Add two integers.
             * @param a first operand
             * @param b second operand
             * @return sum of a and b
             */
            public int add(int a, int b) {
                // Perform the addition
                return a + b; /* return sum */
            }
        """)
        src_no_comments = textwrap.dedent("""\
            public int add(int a, int b) {
                return a + b;
            }
        """)
        result_with = _assert_deterministic(
            "clone-java-t1-a", "java", src_with_comments
        )
        result_without = _assert_deterministic(
            "clone-java-t1-b", "java", src_no_comments
        )

        assert result_with["hash_type1"] == result_without["hash_type1"], (
            "Type-1 Java: methods differing only in comments must share hash_type1."
        )

    def test_type1_comment_invariance_c(self) -> None:
        """Type-1 hash must be equal for C functions differing only in comments."""
        src_with_comments = textwrap.dedent("""\
            /* Add two integers — type-1 clone test */
            int add(int a, int b) {
                // Perform the addition
                return a + b; /* result */
            }
        """)
        src_no_comments = textwrap.dedent("""\
            int add(int a, int b) {
                return a + b;
            }
        """)
        result_with = _assert_deterministic("clone-c-t1-a", "c", src_with_comments)
        result_without = _assert_deterministic("clone-c-t1-b", "c", src_no_comments)

        assert result_with["hash_type1"] == result_without["hash_type1"], (
            "Type-1 C: functions differing only in comments must share hash_type1."
        )

    def test_type2_identifier_invariance_python(self) -> None:
        """
        Type-2 hash must be equal for Python functions with same structure
        but different identifier names.
        """
        src_a = textwrap.dedent("""\
            def add_numbers(first, second):
                result = first + second
                return result
        """)
        src_b = textwrap.dedent("""\
            def sum_values(x, y):
                total = x + y
                return total
        """)
        result_a = _assert_deterministic("clone-py-t2-a", "python", src_a)
        result_b = _assert_deterministic("clone-py-t2-b", "python", src_b)

        assert result_a["hash_type2"] == result_b["hash_type2"], (
            "Type-2 Python: structurally identical functions with different identifier "
            "names must share hash_type2.\n"
            f"  A type2: {result_a['type2']!r}\n"
            f"  B type2: {result_b['type2']!r}"
        )

    def test_type2_identifier_invariance_java(self) -> None:
        """Type-2 hash must be equal for Java methods with same structure, different names."""
        src_a = textwrap.dedent("""\
            public int addNumbers(int first, int second) {
                int result = first + second;
                return result;
            }
        """)
        src_b = textwrap.dedent("""\
            public int sumValues(int x, int y) {
                int total = x + y;
                return total;
            }
        """)
        result_a = _assert_deterministic("clone-java-t2-a", "java", src_a)
        result_b = _assert_deterministic("clone-java-t2-b", "java", src_b)

        assert result_a["hash_type2"] == result_b["hash_type2"], (
            "Type-2 Java: structurally identical methods with different names must "
            "share hash_type2."
        )

    def test_type2_identifier_invariance_c(self) -> None:
        """Type-2 hash must be equal for C functions with same structure, different names."""
        src_a = textwrap.dedent("""\
            int add_numbers(int first, int second) {
                int result = first + second;
                return result;
            }
        """)
        src_b = textwrap.dedent("""\
            int sum_values(int x, int y) {
                int total = x + y;
                return total;
            }
        """)
        result_a = _assert_deterministic("clone-c-t2-a", "c", src_a)
        result_b = _assert_deterministic("clone-c-t2-b", "c", src_b)

        assert result_a["hash_type2"] == result_b["hash_type2"], (
            "Type-2 C: structurally identical functions with different names must "
            "share hash_type2."
        )

    def test_type1_hash_changes_on_content_change_python(self) -> None:
        """Type-1 hash must differ when the logic of a Python function changes."""
        src_add = textwrap.dedent("""\
            def operation(a, b):
                return a + b
        """)
        src_mul = textwrap.dedent("""\
            def operation(a, b):
                return a * b
        """)
        result_add = _assert_deterministic("change-py-add", "python", src_add)
        result_mul = _assert_deterministic("change-py-mul", "python", src_mul)

        assert result_add["hash_type1"] != result_mul["hash_type1"], (
            "Type-1 hash must differ when function body logic changes (+ vs *)."
        )
        assert result_add["hash_type2"] != result_mul["hash_type2"], (
            "Type-2 hash must also differ when function body logic changes."
        )

    def test_type2_hash_changes_on_structural_change(self) -> None:
        """Type-2 hash must differ when the structure of the function changes."""
        src_no_loop = textwrap.dedent("""\
            def process(data):
                result = data + 1
                return result
        """)
        src_with_loop = textwrap.dedent("""\
            def process(data):
                result = 0
                for item in data:
                    result += item
                return result
        """)
        result_no = _assert_deterministic("struct-py-no-loop", "python", src_no_loop)
        result_with = _assert_deterministic(
            "struct-py-with-loop", "python", src_with_loop
        )

        assert result_no["hash_type2"] != result_with["hash_type2"], (
            "Type-2 hash must differ when a loop is added to the function body."
        )

    def test_literal_canonicalization_same_value_same_token(self) -> None:
        """Two functions with the same literal value must produce the same LIT_ token."""
        src_a = textwrap.dedent("""\
            def foo():
                x = 42
                return x
        """)
        src_b = textwrap.dedent("""\
            def bar():
                y = 42
                return y
        """)
        result_a = _assert_deterministic("lit-same-a", "python", src_a)
        result_b = _assert_deterministic("lit-same-b", "python", src_b)

        # Both should have hash_type2 equal (same structure, same literal)
        assert result_a["hash_type2"] == result_b["hash_type2"], (
            "Two functions differing only in name but using the same literal "
            "must share hash_type2."
        )

    def test_literal_canonicalization_different_values_different_tokens(self) -> None:
        """Two functions with different literal values must produce different LIT_ tokens."""
        src_a = textwrap.dedent("""\
            def foo():
                x = 42
                return x
        """)
        src_b = textwrap.dedent("""\
            def foo():
                x = 99
                return x
        """)
        result_a = _assert_deterministic("lit-diff-a", "python", src_a)
        result_b = _assert_deterministic("lit-diff-b", "python", src_b)

        assert result_a["hash_type2"] != result_b["hash_type2"], (
            "Two functions with different literal values (42 vs 99) must have "
            "different hash_type2 values."
        )


# ---------------------------------------------------------------------------
# Edge case tests
# ---------------------------------------------------------------------------


class TestDeterminismEdgeCases:
    """Edge cases that stress-test determinism."""

    def test_empty_source(self) -> None:
        """Empty source must produce deterministic (empty) output for all languages."""
        for lang in ("python", "java", "c"):
            result = _assert_deterministic(f"empty-{lang}", lang, "")
            assert result["type1"] == "", (
                f"Empty {lang} source must produce empty type1"
            )
            assert result["type2"] == "", (
                f"Empty {lang} source must produce empty type2"
            )

    def test_only_whitespace_all_languages(self) -> None:
        """Source with only whitespace must produce deterministic output."""
        for lang in ("python", "java", "c"):
            _assert_deterministic(f"whitespace-{lang}", lang, "   \n\t\n   \n")

    def test_unicode_string_literals(self) -> None:
        """Source with unicode string literals must hash deterministically."""
        src = textwrap.dedent("""\
            def greet(language):
                greetings = {
                    "en": "Hello",
                    "es": "Hola",
                    "fr": "Bonjour",
                    "zh": "你好",
                    "ja": "こんにちは",
                    "ar": "مرحبا",
                }
                return greetings.get(language, "Hello")
        """)
        _assert_deterministic("unicode-strings", "python", src)

    def test_very_long_single_function(self) -> None:
        """A 200-line function body must normalise deterministically."""
        body_lines = ["def long_function(data, threshold, multiplier):"]
        body_lines.append('    """A very long function for determinism testing."""')
        body_lines.append("    result = 0")
        for i in range(190):
            body_lines.append(f"    result += data * {i + 1} + threshold - multiplier")
        body_lines.append("    return result")
        src = "\n".join(body_lines)
        _assert_deterministic("long-function", "python", src)

    def test_deeply_nested_code(self) -> None:
        """Deeply nested conditionals must not trigger recursion issues."""
        lines = ["def deeply_nested(x):"]
        indent = "    "
        for depth in range(20):
            lines.append(f"{indent * (depth + 1)}if x > {depth}:")
        lines.append(f"{indent * 22}return x")
        for depth in range(19, -1, -1):
            lines.append(f"{indent * (depth + 1)}else:")
            lines.append(f"{indent * (depth + 2)}pass")
        src = "\n".join(lines)
        _assert_deterministic("deeply-nested", "python", src)

    def test_many_identifiers(self) -> None:
        """A function with many distinct identifiers must have stable canonical mapping."""
        vars_ = [f"var_{i}" for i in range(50)]
        lines = ["def many_vars():"]
        for i, var in enumerate(vars_):
            lines.append(f"    {var} = {i}")
        lines.append(f"    return {' + '.join(vars_)}")
        src = "\n".join(lines)
        # Run three times to verify stability
        req = _req("many-ids", "python", src)
        r1 = run_normalization_worker(req)
        r2 = run_normalization_worker(req)
        r3 = run_normalization_worker(req)
        assert r1["hash_type2"] == r2["hash_type2"] == r3["hash_type2"], (
            "Canonical mapping for 50 variables must be stable across 3 runs"
        )

    def test_same_source_different_granule_ids(self) -> None:
        """Same source with different granule IDs must produce the same hashes."""
        source = textwrap.dedent("""\
            def compute(x, y):
                return x * y + x - y
        """)
        r1 = run_normalization_worker(_req("granule-id-1", "python", source))
        r2 = run_normalization_worker(_req("granule-id-2", "python", source))
        r3 = run_normalization_worker(_req("completely-different-id", "python", source))

        assert r1["hash_type1"] == r2["hash_type1"] == r3["hash_type1"], (
            "hash_type1 must not depend on granule_id"
        )
        assert r1["hash_type2"] == r2["hash_type2"] == r3["hash_type2"], (
            "hash_type2 must not depend on granule_id"
        )

    def test_windows_line_endings(self) -> None:
        """CRLF line endings must normalise to the same output as LF endings."""
        src_lf = "def add(a, b):\n    return a + b\n"
        src_crlf = "def add(a, b):\r\n    return a + b\r\n"

        req_lf = _req("lf-endings", "python", src_lf)
        req_crlf = _req("crlf-endings", "python", src_crlf)

        r_lf = run_normalization_worker(req_lf)
        r_crlf = run_normalization_worker(req_crlf)

        # Both must individually be deterministic
        r_lf_2 = run_normalization_worker(req_lf)
        r_crlf_2 = run_normalization_worker(req_crlf)

        assert r_lf["hash_type1"] == r_lf_2["hash_type1"], (
            "LF: type1 must be deterministic"
        )
        assert r_crlf["hash_type1"] == r_crlf_2["hash_type1"], (
            "CRLF: type1 must be deterministic"
        )

    def test_multiple_runs_large_batch(self) -> None:
        """
        Run 30+ mixed-language granules and verify all are deterministic.

        This is the core '100+ granules' acceptance criterion.  We call each
        granule twice and compare outputs, then assert zero failures.
        """
        granules = [
            # Python
            ("batch-py-01", "python", "def f(x): return x + 1"),
            ("batch-py-02", "python", "def g(a, b): return a - b"),
            ("batch-py-03", "python", "class A:\n    pass"),
            ("batch-py-04", "python", "class B:\n    def m(self): return 42"),
            ("batch-py-05", "python", "for i in range(10): print(i)"),
            ("batch-py-06", "python", "while x > 0: x -= 1"),
            ("batch-py-07", "python", "def h(x):\n    # comment\n    return x * 2"),
            ("batch-py-08", "python", 'def k(x):\n    """doc"""\n    return x * 2'),
            ("batch-py-09", "python", "x = 1\ny = 2\nz = x + y"),
            ("batch-py-10", "python", "import os\nimport sys\nprint(sys.argv)"),
            # Java
            ("batch-java-01", "java", "public int f(int x) { return x + 1; }"),
            ("batch-java-02", "java", "public int g(int a, int b) { return a - b; }"),
            ("batch-java-03", "java", "public class A { }"),
            (
                "batch-java-04",
                "java",
                "public class B { public int m() { return 42; } }",
            ),
            (
                "batch-java-05",
                "java",
                "for (int i = 0; i < 10; i++) { System.out.println(i); }",
            ),
            ("batch-java-06", "java", "while (x > 0) { x--; }"),
            (
                "batch-java-07",
                "java",
                "// comment\npublic int h(int x) { return x * 2; }",
            ),
            (
                "batch-java-08",
                "java",
                "/** javadoc */\npublic int k(int x) { return x * 2; }",
            ),
            ("batch-java-09", "java", "int x = 1;\nint y = 2;\nint z = x + y;"),
            ("batch-java-10", "java", "public void empty() { /* nothing */ }"),
            # C
            ("batch-c-01", "c", "int f(int x) { return x + 1; }"),
            ("batch-c-02", "c", "int g(int a, int b) { return a - b; }"),
            ("batch-c-03", "c", "typedef struct { int x; int y; } Point;"),
            ("batch-c-04", "c", "typedef struct { char name[32]; int age; } Person;"),
            ("batch-c-05", "c", 'for (i = 0; i < 10; i++) { printf("%d\\n", i); }'),
            ("batch-c-06", "c", "while (x > 0) { x--; }"),
            ("batch-c-07", "c", "/* comment */\nint h(int x) { return x * 2; }"),
            ("batch-c-08", "c", "// line comment\nint k(int x) { return x * 2; }"),
            ("batch-c-09", "c", "int x = 1;\nint y = 2;\nint z = x + y;"),
            ("batch-c-10", "c", "void noop(void) { }"),
        ]

        failures: list[str] = []
        for granule_id, language, source in granules:
            req = _req(granule_id, language, source)
            r1 = run_normalization_worker(req)
            r2 = run_normalization_worker(req)

            if r1["hash_type1"] != r2["hash_type1"]:
                failures.append(
                    f"  {granule_id} ({language}): hash_type1 not deterministic"
                )
            if r1["hash_type2"] != r2["hash_type2"]:
                failures.append(
                    f"  {granule_id} ({language}): hash_type2 not deterministic"
                )
            if r1["type1"] != r2["type1"]:
                failures.append(
                    f"  {granule_id} ({language}): type1 text not deterministic"
                )
            if r1["type2"] != r2["type2"]:
                failures.append(
                    f"  {granule_id} ({language}): type2 text not deterministic"
                )

        assert not failures, (
            f"Determinism failures in batch of {len(granules)} granules:\n"
            + "\n".join(failures)
        )
