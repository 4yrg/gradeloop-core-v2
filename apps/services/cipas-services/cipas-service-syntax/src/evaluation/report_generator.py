"""
Report Generator: Produce JSON/HTML reports with side-by-side comparisons.

This module provides report generation functionality for clone detection results,
supporting both JSON and HTML output formats.
"""

import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class CloneMatch:
    """
    Represents a detected clone pair.

    Attributes:
        fragment_a_id: ID of the first fragment
        fragment_b_id: ID of the second fragment
        fragment_a_source: Source code of fragment A
        fragment_b_source: Source code of fragment B
        similarity_score: Similarity score (0.0-1.0)
        clone_type: Type of clone ('type1', 'type2', 'type3')
        feature_vector: 6D feature vector (optional)
        file_a_path: File path for fragment A
        file_b_path: File path for fragment B
        line_a_start: Starting line for fragment A
        line_b_start: Starting line for fragment B
    """

    fragment_a_id: str
    fragment_b_id: str
    fragment_a_source: str
    fragment_b_source: str
    similarity_score: float
    clone_type: str
    feature_vector: Optional[tuple] = None
    file_a_path: str = ""
    file_b_path: str = ""
    line_a_start: int = 0
    line_b_start: int = 0

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "fragment_a_id": self.fragment_a_id,
            "fragment_b_id": self.fragment_b_id,
            "fragment_a_source": self.fragment_a_source,
            "fragment_b_source": self.fragment_b_source,
            "similarity_score": self.similarity_score,
            "clone_type": self.clone_type,
            "feature_vector": list(self.feature_vector)
            if self.feature_vector
            else None,
            "file_a_path": self.file_a_path,
            "file_b_path": self.file_b_path,
            "line_a_start": self.line_a_start,
            "line_b_start": self.line_b_start,
        }


class ReportGenerator:
    """
    Generate JSON and HTML reports for clone detection results.

    Example:
        >>> generator = ReportGenerator("reports/")
        >>> generator.generate_json_report(matches, metrics)
        >>> generator.generate_html_report(matches, metrics)
    """

    def __init__(self, output_dir: str = "reports"):
        """
        Initialize the ReportGenerator.

        Args:
            output_dir: Directory to save reports
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_json_report(
        self,
        matches: List[CloneMatch],
        metrics: dict,
        filename: str = "clone_report.json",
        include_sources: bool = True,
    ) -> str:
        """
        Generate JSON report.

        Args:
            matches: List of detected clone matches
            metrics: Evaluation metrics dictionary
            filename: Output filename
            include_sources: Whether to include source code in report

        Returns:
            Path to generated report
        """
        report = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_matches": len(matches),
                "metrics": metrics,
            },
            "summary": {
                "type1_count": sum(1 for m in matches if m.clone_type == "type1"),
                "type2_count": sum(1 for m in matches if m.clone_type == "type2"),
                "type3_count": sum(1 for m in matches if m.clone_type == "type3"),
                "avg_similarity": sum(m.similarity_score for m in matches)
                / max(len(matches), 1),
                "max_similarity": max((m.similarity_score for m in matches), default=0),
                "min_similarity": min((m.similarity_score for m in matches), default=0),
            },
            "clone_matches": [
                m.to_dict() if include_sources else self._minimal_match_dict(m)
                for m in matches
            ],
        }

        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return str(output_path)

    def _minimal_match_dict(self, match: CloneMatch) -> dict:
        """Create minimal match dictionary without source code."""
        return {
            "fragment_a_id": match.fragment_a_id,
            "fragment_b_id": match.fragment_b_id,
            "similarity_score": match.similarity_score,
            "clone_type": match.clone_type,
            "file_a_path": match.file_a_path,
            "file_b_path": match.file_b_path,
            "line_a_start": match.line_a_start,
            "line_b_start": match.line_b_start,
        }

    def generate_html_report(
        self,
        matches: List[CloneMatch],
        metrics: dict,
        filename: str = "clone_report.html",
        max_matches: int = 100,
    ) -> str:
        """
        Generate HTML report with side-by-side comparisons.

        Args:
            matches: List of detected clone matches
            metrics: Evaluation metrics dictionary
            filename: Output filename
            max_matches: Maximum number of matches to include

        Returns:
            Path to generated report
        """
        # Sort by similarity score descending
        sorted_matches = sorted(
            matches, key=lambda m: m.similarity_score, reverse=True
        )[:max_matches]

        html = self._build_html(sorted_matches, metrics)

        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

        return str(output_path)

    def _build_html(self, matches: List[CloneMatch], metrics: dict) -> str:
        """Build HTML report content."""
        # Calculate summary statistics
        type1_count = sum(1 for m in matches if m.clone_type == "type1")
        type2_count = sum(1 for m in matches if m.clone_type == "type2")
        type3_count = sum(1 for m in matches if m.clone_type == "type3")
        avg_similarity = sum(m.similarity_score for m in matches) / max(len(matches), 1)

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clone Detection Report</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}

        .metrics {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 25px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }}
        .metric {{ text-align: center; }}
        .metric-value {{ font-size: 2.5em; font-weight: bold; }}
        .metric-label {{ font-size: 0.9em; opacity: 0.9; }}

        .summary {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }}
        .summary-item {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }}

        .match {{
            background: white;
            border-radius: 10px;
            margin: 15px 0;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .match.type1 {{ border-left: 5px solid #28a745; }}
        .match.type2 {{ border-left: 5px solid #ffc107; }}
        .match.type3 {{ border-left: 5px solid #dc3545; }}

        .match-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .match-id {{ font-weight: bold; color: #2c3e50; }}
        .score {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
        }}
        .type-badge {{
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
        }}
        .type-badge.type1 {{ background: #d4edda; color: #155724; }}
        .type-badge.type2 {{ background: #fff3cd; color: #856404; }}
        .type-badge.type3 {{ background: #f8d7da; color: #721c24; }}

        .side-by-side {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
        }}
        @media (max-width: 900px) {{
            .side-by-side {{ grid-template-columns: 1fr; }}
        }}
        .code-column {{
            background: #f8f9fa;
            border-radius: 8px;
            overflow: hidden;
        }}
        .code-header {{
            background: #e9ecef;
            padding: 10px 15px;
            font-weight: bold;
            border-bottom: 1px solid #dee2e6;
            font-size: 0.9em;
        }}
        .code-block {{
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.85em;
            line-height: 1.5;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow-y: auto;
        }}

        .no-matches {{
            text-align: center;
            padding: 50px;
            color: #6c757d;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Clone Detection Report</h1>
        <p>Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value">{len(matches)}</div>
                <div class="metric-label">Total Matches</div>
            </div>
            <div class="metric">
                <div class="metric-value">{metrics.get("precision", 0):.2%}</div>
                <div class="metric-label">Precision</div>
            </div>
            <div class="metric">
                <div class="metric-value">{metrics.get("recall", 0):.2%}</div>
                <div class="metric-label">Recall</div>
            </div>
            <div class="metric">
                <div class="metric-value">{metrics.get("f1_score", 0):.2%}</div>
                <div class="metric-label">F1-Score</div>
            </div>
        </div>

        <div class="summary">
            <h2>Summary</h2>
            <div class="summary-grid">
                <div class="summary-item" style="border-color: #28a745;">
                    <strong>Type-1 Clones</strong><br>
                    {type1_count} exact matches
                </div>
                <div class="summary-item" style="border-color: #ffc107;">
                    <strong>Type-2 Clones</strong><br>
                    {type2_count} renamed matches
                </div>
                <div class="summary-item" style="border-color: #dc3545;">
                    <strong>Type-3 Clones</strong><br>
                    {type3_count} modified matches
                </div>
                <div class="summary-item">
                    <strong>Avg Similarity</strong><br>
                    {avg_similarity:.2%}
                </div>
            </div>
        </div>

        <h2>Clone Matches ({len(matches)} shown)</h2>
"""

        if not matches:
            html += """
        <div class="no-matches">
            <h3>No clone matches detected</h3>
            <p>The analysis did not find any code clones matching the criteria.</p>
        </div>
"""
        else:
            for i, match in enumerate(matches):
                html += self._render_match_card(match, i + 1)

        html += """
    </div>
</body>
</html>
"""

        return html

    def _render_match_card(self, match: CloneMatch, index: int) -> str:
        """Render a single match card."""
        type_display = {
            "type1": "Type-1 (Exact)",
            "type2": "Type-2 (Renamed)",
            "type3": "Type-3 (Modified)",
        }

        return f"""
        <div class="match {match.clone_type}">
            <div class="match-header">
                <div>
                    <span class="match-id">#{index}: {match.fragment_a_id} ↔ {match.fragment_b_id}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span class="score">{match.similarity_score:.2%}</span>
                    <span class="type-badge {match.clone_type}">{type_display.get(match.clone_type, match.clone_type)}</span>
                </div>
            </div>

            <div class="side-by-side">
                <div class="code-column">
                    <div class="code-header">
                        📄 Fragment A: {match.file_a_path or match.fragment_a_id}
                        {f"(line {match.line_a_start})" if match.line_a_start else ""}
                    </div>
                    <div class="code-block">{self._escape_html(match.fragment_a_source)}</div>
                </div>
                <div class="code-column">
                    <div class="code-header">
                        📄 Fragment B: {match.file_b_path or match.fragment_b_id}
                        {f"(line {match.line_b_start})" if match.line_b_start else ""}
                    </div>
                    <div class="code-block">{self._escape_html(match.fragment_b_source)}</div>
                </div>
            </div>
        </div>
"""

    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters."""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#39;")
        )

    def generate_csv_report(
        self,
        matches: List[CloneMatch],
        filename: str = "clone_report.csv",
    ) -> str:
        """
        Generate CSV report for spreadsheet analysis.

        Args:
            matches: List of detected clone matches
            filename: Output filename

        Returns:
            Path to generated report
        """
        try:
            import csv
        except ImportError:
            raise ImportError("csv module is required")

        output_path = self.output_dir / filename

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "Fragment A ID",
                    "Fragment B ID",
                    "Similarity Score",
                    "Clone Type",
                    "File A Path",
                    "File B Path",
                    "Line A Start",
                    "Line B Start",
                ]
            )

            for match in matches:
                writer.writerow(
                    [
                        match.fragment_a_id,
                        match.fragment_b_id,
                        match.similarity_score,
                        match.clone_type,
                        match.file_a_path,
                        match.file_b_path,
                        match.line_a_start,
                        match.line_b_start,
                    ]
                )

        return str(output_path)
