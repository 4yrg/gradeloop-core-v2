import type { LanguageConfig } from "@/types/assessment.types";

export const PROGRAMMING_LANGUAGES: LanguageConfig[] = [
  {
    id: "python",
    name: "Python",
    monacoId: "python",
    extension: ".py",
    defaultCode: `# Python Assignment\n# Write your code below\n\ndef solution():\n    # Your code here\n    pass\n\nif __name__ == "__main__":\n    solution()`,
  },
  {
    id: "javascript",
    name: "JavaScript",
    monacoId: "javascript",
    extension: ".js",
    defaultCode: `// JavaScript Assignment\n// Write your code below\n\nfunction solution() {\n    // Your code here\n}\n\nsolution();`,
  },
  {
    id: "typescript",
    name: "TypeScript",
    monacoId: "typescript",
    extension: ".ts",
    defaultCode: `// TypeScript Assignment\n// Write your code below\n\nfunction solution(): void {\n    // Your code here\n}\n\nsolution();`,
  },
  {
    id: "java",
    name: "Java",
    monacoId: "java",
    extension: ".java",
    defaultCode: `// Java Assignment\n// Write your code below\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}`,
  },
  {
    id: "cpp",
    name: "C++",
    monacoId: "cpp",
    extension: ".cpp",
    defaultCode: `// C++ Assignment\n// Write your code below\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}`,
  },
  {
    id: "c",
    name: "C",
    monacoId: "c",
    extension: ".c",
    defaultCode: `// C Assignment\n// Write your code below\n\n#include <stdio.h>\n\nint main() {\n    // Your code here\n    return 0;\n}`,
  },
  {
    id: "go",
    name: "Go",
    monacoId: "go",
    extension: ".go",
    defaultCode: `// Go Assignment\n// Write your code below\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n    // Your code here\n}`,
  },
  {
    id: "rust",
    name: "Rust",
    monacoId: "rust",
    extension: ".rs",
    defaultCode: `// Rust Assignment\n// Write your code below\n\nfn main() {\n    // Your code here\n}`,
  },
  {
    id: "php",
    name: "PHP",
    monacoId: "php",
    extension: ".php",
    defaultCode: `<?php\n// PHP Assignment\n// Write your code below\n\nfunction solution() {\n    // Your code here\n}\n\nsolution();\n?>`,
  },
  {
    id: "ruby",
    name: "Ruby",
    monacoId: "ruby",
    extension: ".rb",
    defaultCode: `# Ruby Assignment\n# Write your code below\n\ndef solution\n    # Your code here\nend\n\nsolution`,
  },
  {
    id: "kotlin",
    name: "Kotlin",
    monacoId: "kotlin",
    extension: ".kt",
    defaultCode: `// Kotlin Assignment\n// Write your code below\n\nfun main() {\n    // Your code here\n}`,
  },
  {
    id: "swift",
    name: "Swift",
    monacoId: "swift",
    extension: ".swift",
    defaultCode: `// Swift Assignment\n// Write your code below\n\nfunc solution() {\n    // Your code here\n}\n\nsolution()`,
  },
];

export const getLanguageById = (id: string): LanguageConfig | undefined => {
  return PROGRAMMING_LANGUAGES.find((lang) => lang.id === id);
};

export const getDefaultLanguage = (): LanguageConfig => {
  return PROGRAMMING_LANGUAGES[0]; // Python as default
};
