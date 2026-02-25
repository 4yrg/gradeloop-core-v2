"""
Pytest configuration and fixtures for clone detection tests.
"""

from pathlib import Path

import pytest


@pytest.fixture
def sample_python_code():
    """Sample Python code for testing."""
    return """
def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total

def calculate_product(numbers):
    result = 1
    for num in numbers:
        result *= num
    return result

class Calculator:
    def __init__(self):
        self.history = []

    def add(self, a, b):
        result = a + b
        self.history.append(result)
        return result
"""


@pytest.fixture
def sample_java_code():
    """Sample Java code for testing."""
    return """
public class Calculator {
    public int sum(int[] numbers) {
        int total = 0;
        for (int num : numbers) {
            total += num;
        }
        return total;
    }

    public int product(int[] numbers) {
        int result = 1;
        for (int num : numbers) {
            result *= num;
        }
        return result;
    }
}
"""


@pytest.fixture
def sample_c_code():
    """Sample C code for testing."""
    return """
int sum(int numbers[], int size) {
    int total = 0;
    for (int i = 0; i < size; i++) {
        total += numbers[i];
    }
    return total;
}

int product(int numbers[], int size) {
    int result = 1;
    for (int i = 0; i < size; i++) {
        result *= numbers[i];
    }
    return result;
}
"""


@pytest.fixture
def clone_pair_python():
    """Sample Python clone pair for testing."""
    code_a = """
def find_max(numbers):
    max_val = numbers[0]
    for num in numbers:
        if num > max_val:
            max_val = num
    return max_val
"""

    code_b = """
def find_min(numbers):
    min_val = numbers[0]
    for num in numbers:
        if num < min_val:
            min_val = num
    return min_val
"""

    return code_a, code_b


@pytest.fixture
def clone_pair_java():
    """Sample Java clone pair for testing."""
    code_a = """
public void sortAscending(int[] arr) {
    for (int i = 0; i < arr.length; i++) {
        for (int j = i + 1; j < arr.length; j++) {
            if (arr[i] > arr[j]) {
                int temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }
        }
    }
}
"""

    code_b = """
public void sortDescending(int[] arr) {
    for (int i = 0; i < arr.length; i++) {
        for (int j = i + 1; j < arr.length; j++) {
            if (arr[i] < arr[j]) {
                int temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }
        }
    }
}
"""

    return code_a, code_b


@pytest.fixture
def test_data_dir(tmp_path):
    """Create a test data directory."""
    data_dir = tmp_path / "test_data"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def sample_feature_vectors():
    """Sample 6D feature vectors for ML testing."""
    import numpy as np

    # Clones (high similarity)
    clones = np.array(
        [
            [5.0, 0.9, 0.92, 0.95, 0.85, 0.90],
            [3.0, 0.85, 0.88, 0.92, 0.80, 0.85],
            [8.0, 0.8, 0.82, 0.88, 0.75, 0.80],
        ]
    )

    # Non-clones (low similarity)
    non_clones = np.array(
        [
            [50.0, 0.3, 0.35, 0.40, 0.20, 0.25],
            [45.0, 0.25, 0.30, 0.35, 0.15, 0.20],
            [60.0, 0.2, 0.25, 0.30, 0.10, 0.15],
        ]
    )

    return clones, non_clones
