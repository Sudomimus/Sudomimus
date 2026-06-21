"""Codegen tasks for the Sudomimus Python SDK workspace.

Run from the workspace root:

    uv run python tasks.py generate
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent
SPECS_DIR = WORKSPACE_ROOT.parent.parent / "specs"

TARGETS = [
    ("connect", "sudomimus-connect", "sudomimus_connect"),
    ("device", "sudomimus-device", "sudomimus_device"),
    ("native", "sudomimus-native", "sudomimus_native"),
]


def generate() -> None:
    """Generate Pydantic models for every package from its spec."""
    for service, package, module in TARGETS:
        spec = SPECS_DIR / f"{service}.yaml"
        output_dir = WORKSPACE_ROOT / "packages" / package / "src" / module / "_generated"
        output = output_dir / "models.py"
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "__init__.py").write_text(
            '"""Generated models. Do not edit by hand."""\n',
            encoding="utf-8",
        )
        print(f"Generating {output.relative_to(WORKSPACE_ROOT)} from {spec.name}")
        subprocess.run(
            [
                "datamodel-codegen",
                "--input",
                str(spec),
                "--input-file-type",
                "openapi",
                "--output",
                str(output),
                "--output-model-type",
                "pydantic_v2.BaseModel",
                "--target-python-version",
                "3.11",
                "--use-schema-description",
                "--use-double-quotes",
                "--field-constraints",
                "--disable-timestamp",
            ],
            check=True,
        )


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    command = sys.argv[1]
    if command == "generate":
        generate()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
