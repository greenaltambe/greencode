export const PROBLEM_TAGS = [
  // ==========================
  // Data Structures
  // ==========================
  { id: "array", label: "Array", category: "Data Structures" },
  { id: "string", label: "String", category: "Data Structures" },
  { id: "hash-table", label: "Hash Table", category: "Data Structures" },
  { id: "linked-list", label: "Linked List", category: "Data Structures" },
  { id: "doubly-linked-list", label: "Doubly Linked List", category: "Data Structures" },
  { id: "stack", label: "Stack", category: "Data Structures" },
  { id: "queue", label: "Queue", category: "Data Structures" },
  { id: "heap", label: "Heap (Priority Queue)", category: "Data Structures" },
  { id: "tree", label: "Tree", category: "Data Structures" },
  { id: "binary-tree", label: "Binary Tree", category: "Data Structures" },
  { id: "binary-search-tree", label: "Binary Search Tree", category: "Data Structures" },
  { id: "trie", label: "Trie", category: "Data Structures" },
  { id: "graph", label: "Graph", category: "Data Structures" },
  { id: "matrix", label: "Matrix", category: "Data Structures" },

  // ==========================
  // Algorithms
  // ==========================
  { id: "binary-search", label: "Binary Search", category: "Algorithms" },
  { id: "two-pointers", label: "Two Pointers", category: "Algorithms" },
  { id: "sliding-window", label: "Sliding Window", category: "Algorithms" },
  { id: "prefix-sum", label: "Prefix Sum", category: "Algorithms" },
  { id: "sorting", label: "Sorting", category: "Algorithms" },
  { id: "merge-sort", label: "Merge Sort", category: "Algorithms" },
  { id: "counting-sort", label: "Counting Sort", category: "Algorithms" },
  { id: "radix-sort", label: "Radix Sort", category: "Algorithms" },
  { id: "bucket-sort", label: "Bucket Sort", category: "Algorithms" },
  { id: "quickselect", label: "Quickselect", category: "Algorithms" },
  { id: "bit-manipulation", label: "Bit Manipulation", category: "Algorithms" },
  { id: "bitmask", label: "Bitmask", category: "Algorithms" },
  { id: "recursion", label: "Recursion", category: "Algorithms" },
  { id: "backtracking", label: "Backtracking", category: "Algorithms" },
  { id: "divide-and-conquer", label: "Divide and Conquer", category: "Algorithms" },
  { id: "greedy", label: "Greedy", category: "Algorithms" },
  { id: "dynamic-programming", label: "Dynamic Programming", category: "Algorithms" },
  { id: "memoization", label: "Memoization", category: "Algorithms" },
  { id: "simulation", label: "Simulation", category: "Algorithms" },
  { id: "enumeration", label: "Enumeration", category: "Algorithms" },

  // ==========================
  // Graph Algorithms
  // ==========================
  { id: "dfs", label: "Depth-First Search", category: "Graph Algorithms" },
  { id: "bfs", label: "Breadth-First Search", category: "Graph Algorithms" },
  { id: "shortest-path", label: "Shortest Path", category: "Graph Algorithms" },
  { id: "topological-sort", label: "Topological Sort", category: "Graph Algorithms" },
  { id: "minimum-spanning-tree", label: "Minimum Spanning Tree", category: "Graph Algorithms" },
  { id: "union-find", label: "Union-Find", category: "Graph Algorithms" },
  { id: "strongly-connected-components", label: "Strongly Connected Components", category: "Graph Algorithms" },
  { id: "eulerian-circuit", label: "Eulerian Circuit", category: "Graph Algorithms" },

  // ==========================
  // Advanced Data Structures
  // ==========================
  { id: "segment-tree", label: "Segment Tree", category: "Advanced Data Structures" },
  { id: "binary-indexed-tree", label: "Binary Indexed Tree", category: "Advanced Data Structures" },
  { id: "ordered-set", label: "Ordered Set", category: "Advanced Data Structures" },
  { id: "monotonic-stack", label: "Monotonic Stack", category: "Advanced Data Structures" },
  { id: "monotonic-queue", label: "Monotonic Queue", category: "Advanced Data Structures" },

  // ==========================
  // Mathematics
  // ==========================
  { id: "math", label: "Math", category: "Mathematics" },
  { id: "number-theory", label: "Number Theory", category: "Mathematics" },
  { id: "combinatorics", label: "Combinatorics", category: "Mathematics" },
  { id: "probability", label: "Probability & Statistics", category: "Mathematics" },
  { id: "geometry", label: "Geometry", category: "Mathematics" },
  { id: "counting", label: "Counting", category: "Mathematics" },

  // ==========================
  // Strings
  // ==========================
  { id: "string-matching", label: "String Matching", category: "Strings" },
  { id: "rolling-hash", label: "Rolling Hash", category: "Strings" },
  { id: "hash-function", label: "Hash Function", category: "Strings" },

  // ==========================
  // Miscellaneous
  // ==========================
  { id: "design", label: "Design", category: "Miscellaneous" },
  { id: "randomized", label: "Randomized", category: "Miscellaneous" },
  { id: "game-theory", label: "Game Theory", category: "Miscellaneous" },
];

export const PROBLEM_TAG_IDS = PROBLEM_TAGS.map(tag => tag.id);

export const PROBLEM_TAG_MAP = Object.fromEntries(
  PROBLEM_TAGS.map(tag => [tag.id, tag])
);

export const TAG_CATEGORIES = [
  "Data Structures",
  "Algorithms",
  "Graph Algorithms",
  "Advanced Data Structures",
  "Mathematics",
  "Strings",
  "Miscellaneous",
];
