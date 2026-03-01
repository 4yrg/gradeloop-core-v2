#!/usr/bin/env python3
"""
Build tree-sitter parsers for CIPAS AI service.

This script clones and builds tree-sitter grammar files for:
- Python
- Java
- C
- C++

The compiled .so files are placed in the models/ directory.

Usage:
    python scripts/build_parsers.py

Requirements:
    - Git
    - Python 3.10+
    - tree-sitter Python package
"""

import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MODELS_DIR = PROJECT_ROOT / "models"
PARSERS_DIR = PROJECT_ROOT / "tree-sitter-parsers"

# Tree-sitter grammar repositories
GRAMMARS = {
    "python": {
        "repo": "https://github.com/tree-sitter/tree-sitter-python.git",
        "output": "tree-sitter-python.so",
    },
    "java": {
        "repo": "https://github.com/tree-sitter/tree-sitter-java.git",
        "output": "tree-sitter-java.so",
    },
    "c": {
        "repo": "https://github.com/tree-sitter/tree-sitter-c.git",
        "output": "tree-sitter-c.so",
    },
    "cpp": {
        "repo": "https://github.com/tree-sitter/tree-sitter-cpp.git",
        "output": "tree-sitter-cpp.so",
    },
}


def check_dependencies() -> bool:
    """Check if required dependencies are installed."""
    missing = []

    # Check git
    try:
        subprocess.run(
            ["git", "--version"],
            check=True,
            capture_output=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        missing.append("git")

    # Check tree-sitter Python package
    try:
        import tree_sitter
    except ImportError:
        missing.append("tree-sitter (pip install tree-sitter)")

    if missing:
        logger.error("Missing dependencies: %s", ", ".join(missing))
        return False

    logger.info("All dependencies satisfied")
    return True


def clone_grammars() -> None:
    """Clone tree-sitter grammar repositories."""
    logger.info(f"Cloning grammars to {PARSERS_DIR}")

    PARSERS_DIR.mkdir(exist_ok=True)

    for name, config in GRAMMARS.items():
        parser_dir = PARSERS_DIR / name

        if parser_dir.exists():
            logger.info(f"Grammar '{name}' already exists, skipping...")
            continue

        logger.info(f"Cloning {name}...")
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", config["repo"], str(parser_dir)],
                check=True,
                capture_output=True,
            )
            logger.info(f"Cloned {name} successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to clone {name}: {e.stderr.decode()}")
            raise


def build_grammars() -> None:
    """Build tree-sitter grammar shared libraries."""
    from tree_sitter import Language

    logger.info("Building tree-sitter grammars...")

    # Create models directory
    MODELS_DIR.mkdir(exist_ok=True)

    built_grammars = []

    for name, config in GRAMMARS.items():
        parser_dir = PARSERS_DIR / name
        output_path = MODELS_DIR / config["output"]

        if output_path.exists():
            logger.info(f"Grammar '{name}' already built, skipping...")
            built_grammars.append(str(output_path))
            continue

        logger.info(f"Building {name}...")

        try:
            # Build using tree-sitter CLI if available
            subprocess.run(
                ["tree-sitter", "build", "-o", str(output_path)],
                cwd=parser_dir,
                check=True,
                capture_output=True,
            )
            logger.info(f"Built {name} successfully")
            built_grammars.append(str(output_path))

        except (subprocess.CalledProcessError, FileNotFoundError):
            # Fallback: Use Python tree-sitter build
            logger.info(f"tree-sitter CLI not found, using Python build for {name}...")

            try:
                # Try building with setup.py if available
                setup_py = parser_dir / "setup.py"
                if setup_py.exists():
                    subprocess.run(
                        [sys.executable, "setup.py", "build"],
                        cwd=parser_dir,
                        check=True,
                        capture_output=True,
                    )

                    # Find and copy the built .so file
                    build_dir = parser_dir / "build" / "Release"
                    if not build_dir.exists():
                        build_dir = parser_dir / "build"

                    for so_file in build_dir.glob("*.so"):
                        shutil.copy2(so_file, output_path)
                        logger.info(f"Copied {so_file} to {output_path}")
                        break

                    built_grammars.append(str(output_path))
                else:
                    # Manual build using tree-sitter Language.build
                    src_path = parser_dir / "src"

                    if not src_path.exists():
                        logger.warning(
                            f"Source directory not found for {name}, skipping..."
                        )
                        continue

                    Language.build(
                        [str(src_path / "parser.c")],
                        str(output_path),
                    )
                    logger.info(f"Built {name} successfully (Python fallback)")
                    built_grammars.append(str(output_path))

            except Exception as e:
                logger.error(f"Failed to build {name}: {e}")
                raise

    logger.info(f"Built {len(built_grammars)} grammars")
    return built_grammars


def verify_build() -> bool:
    """Verify that all grammars were built successfully."""
    logger.info("Verifying build...")

    all_good = True

    for name, config in GRAMMARS.items():
        output_path = MODELS_DIR / config["output"]

        if output_path.exists():
            logger.info(f"✓ {name}: {output_path}")

            # Try loading the grammar
            try:
                from tree_sitter import Language

                lang = Language(str(output_path))
                logger.info(f"  Language loaded successfully")
            except Exception as e:
                logger.warning(f"  Failed to load: {e}")
                all_good = False
        else:
            logger.error(f"✗ {name}: NOT BUILT")
            all_good = False

    return all_good


def cleanup() -> None:
    """Clean up temporary files."""
    if PARSERS_DIR.exists():
        logger.info(f"Cleaning up {PARSERS_DIR}...")
        shutil.rmtree(PARSERS_DIR)


def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("CIPAS AI - Tree-sitter Parser Builder")
    logger.info("=" * 60)

    # Check dependencies
    if not check_dependencies():
        logger.error("Please install missing dependencies")
        sys.exit(1)

    # Clone grammars
    clone_grammars()

    # Build grammars
    try:
        built_grammars = build_grammars()
    except Exception as e:
        logger.error(f"Build failed: {e}")
        sys.exit(1)

    # Verify build
    if not verify_build():
        logger.warning("Some grammars failed to build")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Build complete!")
    logger.info(f"Grammars are located in: {MODELS_DIR}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
