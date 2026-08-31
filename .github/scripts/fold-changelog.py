#!/usr/bin/env python3
"""Fold a new version section into the changelog.

Usage: fold-changelog.py <changelog-path> <section-path>

Inserts the section before the first released-version heading, keeping an
Unreleased block (if any) at the top. Deterministic -- no network, no agent.
Called only by .github/workflows/version-bump.yml.
"""
import re
import sys

cl_path, sec_path = sys.argv[1], sys.argv[2]
with open(cl_path, encoding="utf-8") as f:
    cl = f.read()
with open(sec_path, encoding="utf-8") as f:
    sec = f.read().rstrip() + "\n"

lines = cl.splitlines(keepends=True)
idx = None
for i, ln in enumerate(lines):
    if re.match(r"^##\s", ln) and not re.match(r"^##\s*\[?unreleased", ln, re.I):
        idx = i
        break
if idx is None:
    out = cl.rstrip() + "\n\n" + sec
else:
    out = "".join(lines[:idx]) + sec + "\n" + "".join(lines[idx:])
with open(cl_path, "w", encoding="utf-8", newline="") as f:
    f.write(out)
