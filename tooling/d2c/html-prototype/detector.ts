/**
 * Hardcoded Style Detector for HTML Prototype Generator (Phase 5B-1)
 *
 * Verifies that all generated styles and HTML inline styles reference Semantic CSS Variables
 * (e.g., var(--d2c-color-primary), var(--d2c-spacing-md)).
 * Strictly forbids raw hex colors (#1677ff) and raw dimensions (16px, 24px) outside of
 * root token definitions.
 */

export interface HardcodedStyleDiagnostic {
  filename: string;
  line: number;
  column?: number;
  snippet: string;
  type: "HEX_COLOR" | "RAW_DIMENSION" | "INLINE_STYLE";
  message: string;
}

// Prohibited hex color pattern outside var(--d2c-*)
const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;

// Prohibited dimension pattern in CSS property declarations (e.g. 16px, 24px, 8px, 4px)
// We specifically target layout/typography dimensions in rule bodies like "padding: 16px", "margin: 24px"
const RAW_DIMENSION_REGEX = /:\s*[^;{}]*?\b(\d+px)\b/g;

// Pattern detecting inline style attributes with raw values
const INLINE_STYLE_REGEX = /style=["']([^"']+)["']/gi;

/**
 * Scans a file's content for hardcoded styles.
 */
export function detectHardcodedStyles(
  content: string,
  filename: string = "unknown.css",
  options: { allowTokensFile?: boolean } = {}
): HardcodedStyleDiagnostic[] {
  const diagnostics: HardcodedStyleDiagnostic[] = [];

  // If this is the tokens definition file, root declarations like `--d2c-color-primary: #1677ff;` are allowed
  if (options.allowTokensFile || filename.endsWith("tokens.css")) {
    return [];
  }

  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for inline style attributes with hardcoded values in HTML
    if (filename.endsWith(".html") || filename.endsWith(".htm")) {
      let inlineMatch: RegExpExecArray | null;
      INLINE_STYLE_REGEX.lastIndex = 0;
      while ((inlineMatch = INLINE_STYLE_REGEX.exec(line)) !== null) {
        const styleContent = inlineMatch[1];
        if (HEX_COLOR_REGEX.test(styleContent) || RAW_DIMENSION_REGEX.test(`:${styleContent}`)) {
          diagnostics.push({
            filename,
            line: lineNum,
            snippet: line.trim(),
            type: "INLINE_STYLE",
            message: `Inline style contains hardcoded value in HTML: "${styleContent}". Must use semantic CSS classes referencing tokens.`,
          });
        }
      }
    }

    // Check for raw hex colors in CSS or JS files
    let hexMatch: RegExpExecArray | null;
    HEX_COLOR_REGEX.lastIndex = 0;
    while ((hexMatch = HEX_COLOR_REGEX.exec(line)) !== null) {
      diagnostics.push({
        filename,
        line: lineNum,
        snippet: line.trim(),
        type: "HEX_COLOR",
        message: `Hardcoded hex color "${hexMatch[0]}" forbidden. Must use var(--d2c-color-*) token.`,
      });
    }

    // Check for raw dimensions in CSS property values
    // Ignore lines that are comments or var() definitions
    if (!line.trim().startsWith("/*") && !line.trim().startsWith("*")) {
      let dimMatch: RegExpExecArray | null;
      RAW_DIMENSION_REGEX.lastIndex = 0;
      while ((dimMatch = RAW_DIMENSION_REGEX.exec(line)) !== null) {
        const fullMatch = dimMatch[0];
        const dimension = dimMatch[1];

        // If it's already inside a var() or calc() with var, skip
        if (fullMatch.includes("var(--d2c-")) {
          continue;
        }

        diagnostics.push({
          filename,
          line: lineNum,
          snippet: line.trim(),
          type: "RAW_DIMENSION",
          message: `Hardcoded dimension "${dimension}" forbidden in "${line.trim()}". Must use var(--d2c-spacing-*) or var(--d2c-fontSize-*) token.`,
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Asserts that none of the provided files contain hardcoded styles.
 * Throws an error with detailed diagnostics if any violation is detected.
 */
export function assertZeroHardcodedStyles(
  files: { filename: string; content: string; isTokensFile?: boolean }[]
): void {
  const allDiagnostics: HardcodedStyleDiagnostic[] = [];

  for (const file of files) {
    const diags = detectHardcodedStyles(file.content, file.filename, {
      allowTokensFile: file.isTokensFile,
    });
    allDiagnostics.push(...diags);
  }

  if (allDiagnostics.length > 0) {
    const errorDetails = allDiagnostics
      .map((d) => `  - [${d.type}] ${d.filename}:${d.line}: ${d.message} (snippet: "${d.snippet}")`)
      .join("\n");

    throw new Error(
      `HARDCODED_STYLE_VIOLATION: Detected ${allDiagnostics.length} hardcoded style violations outside tokens.css:\n${errorDetails}`
    );
  }
}
