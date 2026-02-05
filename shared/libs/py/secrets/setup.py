from setuptools import setup, find_packages

setup(
    name="gradeloop-secrets",
    version="1.0.0",
    description="GradeLoop Secrets Client for HashiCorp Vault",
    author="GradeLoop Team",
    packages=find_packages(),
    install_requires=[
        "hvac>=2.1.0,<3.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "pytest-mock>=3.10.0",
            "ruff>=0.1.0",
            "black>=23.0.0",
            "bandit>=1.7.0",
            "mypy>=1.0.0",
        ],
        "test": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "pytest-mock>=3.10.0",
        ],
    },
    python_requires=">=3.11",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3.11",
    ],
)
