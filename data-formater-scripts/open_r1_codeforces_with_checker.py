import json
from pathlib import Path

from datasets import load_dataset, load_from_disk
from tqdm import tqdm

# ==========================================================
# Config
# ==========================================================

DATASET_DIR = Path("datasets/codeforces")
OUTPUT_DIR = Path("algorithms")

BATCH_SIZE = 100

# ==========================================================
# Difficulty Mapping
# ==========================================================

def map_difficulty(rating):
    if rating is None or rating <= 1200:
        return "easy"
    elif rating <= 1800:
        return "medium"
    return "hard"


# ==========================================================
# Tag Mapping
# ==========================================================

CODEFORCES_TAG_MAP = {
    "dp": "dynamic-programming",
    "graphs": "graph",
    "dfs and similar": "dfs",
    "sortings": "sorting",
    "bitmasks": "bitmask",
    "hashing": "hash-table",
    "probabilities": "probability",
    "games": "game-theory",
    "flows": "maximum-flow",
    "graph matchings": "graph-matching",
    "trees": "tree",
    "strings": "string",
    "matrices": "matrix",
    "two pointers": "two-pointers",
    "binary search": "binary-search",
    "constructive algorithms": "constructive-algorithms",
    "brute force": "brute-force",
    "implementation": "implementation",
    "greedy": "greedy",
    "math": "math",
    "number theory": "number-theory",
    "geometry": "geometry",
    "combinatorics": "combinatorics",
    "divide and conquer": "divide-and-conquer",
    "meet-in-the-middle": "meet-in-the-middle",
    "ternary search": "ternary-search",
    "interactive": "interactive",
    "expression parsing": "expression-parsing",
    "string suffix structures": "suffix-array",
    "fft": "fft",
    "2-sat": "2-sat",
    "chinese remainder theorem": "chinese-remainder-theorem",
    "data structures": "data-structures",
    "dsu": "union-find",
    "*special": "special",
    "schedules": "schedules",
}


def map_tags(tags):
    if not tags:
        return []

    mapped = []

    for tag in tags:
        mapped_tag = CODEFORCES_TAG_MAP.get(tag.lower())
        if mapped_tag:
            mapped.append(mapped_tag)

    return sorted(set(mapped))


# ==========================================================
# Load Dataset
# ==========================================================

if DATASET_DIR.exists():
    print("Loading cached dataset...")
    ds = load_from_disk(DATASET_DIR)
else:
    print("Downloading dataset...")
    ds = load_dataset("open-r1/codeforces", "default")
    ds.save_to_disk(DATASET_DIR)

train = ds["train"]

OUTPUT_DIR.mkdir(exist_ok=True)

# ==========================================================
# Generate Problems
# ==========================================================

for index, problem in enumerate(tqdm(train, desc="Formatting"), start=1):

    batch_number = (index - 1) // BATCH_SIZE + 1
    batch_dir = OUTPUT_DIR / f"batch_{batch_number:04d}"

    slug = problem["id"].replace("/", "_")

    problem_dir = batch_dir / slug
    tests_dir = problem_dir / "tests"

    tests_dir.mkdir(parents=True, exist_ok=True)

    # ======================================================
    # Description
    # ======================================================

    description = f"""
{problem.get("description") or ""}

## Input

{problem.get("input_format") or ""}

## Output

{problem.get("output_format") or ""}

## Time Limit

{problem.get("time_limit")} seconds

## Memory Limit

{problem.get("memory_limit")} MB
""".strip()

    note = problem.get("note") or ""

    if note.strip():
        description += f"""

## Note

{note}
"""

    # ======================================================
    # Samples
    # ======================================================

    samples = []

    examples = problem.get("examples") or []

    for example in examples:

        input_text = example.get("input", "")
        output_text = example.get("output", "")

        samples.append(
            {
                "input": input_text,
                "expectedOutput": output_text,
            }
        )

    # ======================================================
    # Checker
    # ======================================================

    checker = problem.get("generated_checker") or ""

    has_checker = bool(checker.strip())

    # ======================================================
    # Metadata
    # ======================================================

    problem_json = {
        "title": problem.get("title"),
        "description": description,
        "difficulty": map_difficulty(problem.get("rating")),
        "tags": map_tags(problem.get("tags") or []),
        "timeLimit": problem.get("time_limit"),
        "memoryLimit": problem.get("memory_limit"),
        "testCases": samples,
        "checker": {
            "type": "python" if has_checker else "default"
        },
    }

    with open(
        problem_dir / "problem.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(problem_json, f, indent=4, ensure_ascii=False)

    # ======================================================
    # Official Tests
    # ======================================================

    tests = problem.get("official_tests") or []

    for test_index, test in enumerate(tests, start=1):

        with open(
            tests_dir / f"input_{test_index}.txt",
            "w",
            encoding="utf-8",
            newline=""
        ) as f:
            f.write(test.get("input", ""))

        with open(
            tests_dir / f"output_{test_index}.txt",
            "w",
            encoding="utf-8",
            newline=""
        ) as f:
            f.write(test.get("output", ""))

    # ======================================================
    # Checker
    # ======================================================

    if has_checker:

        with open(
            problem_dir / "checker.py",
            "w",
            encoding="utf-8",
            newline="\n"
        ) as f:
            f.write(checker)

print(f"\nFinished formatting {len(train)} problems.")