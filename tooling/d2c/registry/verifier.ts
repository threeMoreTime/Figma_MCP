/**
 * Static Module & Export Verifier for Component Registry
 *
 * Statically inspects modules using TypeScript AST without dynamically executing code.
 * Differentiates:
 * 1. modulePath / exportName field presence
 * 2. Module resolvable by target project rules (@/ alias, relative, node_modules)
 * 3. Designated export genuinely exists (default vs named matching)
 * 4. Props compatibility & boolean typing verification
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import ts from "typescript";
import type { ComponentRecord, Diagnostic } from "../contracts/schema.js";

export interface VerificationResult {
  verified: boolean;
  resolvedFilePath: string | null;
  exportKind: "default" | "named" | "none";
  diagnostics: Diagnostic[];
}

export function resolveModulePath(modulePath: string, repoRoot: string): string | null {
  if (!modulePath || modulePath.trim() === "") {
    return null;
  }

  // Handle external node module (e.g. antd)
  if (!modulePath.startsWith(".") && !modulePath.startsWith("@/") && !modulePath.startsWith("/")) {
    const candidateDirs = [
      resolve(repoRoot, "node_modules", modulePath),
      resolve("node_modules", modulePath),
    ];
    for (const dir of candidateDirs) {
      if (existsSync(dir)) {
        const pkgJsonPath = join(dir, "package.json");
        if (existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
            const typingsCandidate = pkg.typings || pkg.types || "index.d.ts";
            const fullTypingsPath = resolve(dir, typingsCandidate);
            if (existsSync(fullTypingsPath)) {
              return fullTypingsPath;
            }
          } catch {}
        }
      }
    }
    return null;
  }

  // Handle alias @/ -> repoRoot/src/
  let basePath = modulePath;
  if (modulePath.startsWith("@/")) {
    basePath = join(repoRoot, "src", modulePath.slice(2));
  } else if (!modulePath.startsWith(repoRoot)) {
    basePath = resolve(repoRoot, modulePath);
  }

  const candidateExtensions = [
    ".tsx",
    ".ts",
    ".jsx",
    ".js",
    "/index.tsx",
    "/index.ts",
    "/index.jsx",
    "/index.js",
    "",
  ];

  for (const ext of candidateExtensions) {
    const candidate = basePath + ext;
    if (existsSync(candidate)) {
      try {
        const stat = statSync(candidate);
        if (stat.isFile()) {
          return candidate;
        }
      } catch {}
    }
  }

  return null;
}

export function verifyComponentRecord(
  componentName: string,
  record: ComponentRecord,
  targetRepoPath: string
): VerificationResult {
  const diagnostics: Diagnostic[] = [];

  // 1. Check modulePath and exportName field presence
  if (!record.modulePath || record.modulePath.trim() === "") {
    diagnostics.push({
      code: "MODULE_PATH_EMPTY",
      message: `Component '${componentName}' has an empty or missing modulePath`,
      severity: "ERROR",
      path: `components.${componentName}.modulePath`,
    });
    return { verified: false, resolvedFilePath: null, exportKind: "none", diagnostics };
  }

  if (!record.exportName || record.exportName.trim() === "") {
    diagnostics.push({
      code: "EXPORT_NAME_EMPTY",
      message: `Component '${componentName}' has an empty or missing exportName`,
      severity: "ERROR",
      path: `components.${componentName}.exportName`,
    });
    return { verified: false, resolvedFilePath: null, exportKind: "none", diagnostics };
  }

  // 2. Check props typing and constraints
  for (const [propName, propMeta] of Object.entries(record.props || {})) {
    if (propMeta.type === "boolean" && propMeta.defaultValue !== undefined) {
      if (typeof propMeta.defaultValue === "string") {
        diagnostics.push({
          code: "BOOLEAN_STRINGIFIED",
          message: `Component '${componentName}' prop '${propName}' has stringified boolean defaultValue: "${propMeta.defaultValue}". Must be true or false boolean.`,
          severity: "ERROR",
          path: `components.${componentName}.props.${propName}.defaultValue`,
        });
      }
    }
    if (propMeta.type === "enum" && propMeta.enumOptions && propMeta.defaultValue !== undefined) {
      if (!propMeta.enumOptions.includes(String(propMeta.defaultValue))) {
        diagnostics.push({
          code: "INVALID_PROP_ENUM",
          message: `Component '${componentName}' prop '${propName}' defaultValue '${propMeta.defaultValue}' is not included in enumOptions: [${propMeta.enumOptions.join(", ")}].`,
          severity: "ERROR",
          path: `components.${componentName}.props.${propName}.defaultValue`,
        });
      }
    }
  }

  // 3. Resolve module path
  const resolvedPath = resolveModulePath(record.modulePath, targetRepoPath);
  if (!resolvedPath) {
    diagnostics.push({
      code: "MODULE_NOT_FOUND",
      message: `Module '${record.modulePath}' could not be resolved in target project '${targetRepoPath}'`,
      severity: "ERROR",
      path: `components.${componentName}.modulePath`,
    });
    return { verified: false, resolvedFilePath: null, exportKind: "none", diagnostics };
  }

  // 4. Static AST export verification for local and external module definitions
  try {
    const fileContent = readFileSync(resolvedPath, "utf-8");
    const sourceFile = ts.createSourceFile(
      resolvedPath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    let hasDefaultExport = false;
    const namedValueExports = new Set<string>();
    const namedTypeExports = new Set<string>();

    function visit(node: ts.Node) {
      // export default ...
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        hasDefaultExport = true;
      }

      // export default function / class
      if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      ) {
        hasDefaultExport = true;
      }

      // export const / function / class (named values)
      if (
        (ts.isVariableStatement(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node)) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
        !node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      ) {
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              namedValueExports.add(decl.name.text);
            }
          }
        } else if (node.name && ts.isIdentifier(node.name)) {
          namedValueExports.add(node.name.text);
        }
      }

      // export type / interface (type declarations cannot masquerade as components)
      if (
        (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        if (node.name && ts.isIdentifier(node.name)) {
          namedTypeExports.add(node.name.text);
        }
      }

      // export { A, B as C, D as default } or export type { T }
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        const isDeclarationTypeOnly = node.isTypeOnly;
        for (const spec of node.exportClause.elements) {
          const exportId = spec.name.text;
          const isSpecTypeOnly = isDeclarationTypeOnly || spec.isTypeOnly;

          if (isSpecTypeOnly) {
            namedTypeExports.add(exportId);
          } else {
            if (exportId === "default") {
              hasDefaultExport = true;
            } else {
              namedValueExports.add(exportId);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Check if export matches
    if (record.exportName === "default") {
      if (!hasDefaultExport) {
        if (namedValueExports.size > 0 || namedTypeExports.size > 0) {
          diagnostics.push({
            code: "EXPORT_KIND_MISMATCH",
            message: `Component '${componentName}' requested export 'default', but file has named exports: [${Array.from(namedValueExports).join(", ")}] and no default export.`,
            severity: "ERROR",
            path: `components.${componentName}.exportName`,
          });
        } else {
          diagnostics.push({
            code: "EXPORT_NOT_FOUND",
            message: `Component '${componentName}' export 'default' not found in '${resolvedPath}'`,
            severity: "ERROR",
            path: `components.${componentName}.exportName`,
          });
        }
      }
    } else {
      // Named export requested
      if (namedValueExports.has(record.exportName)) {
        // Valid named component export
      } else if (namedTypeExports.has(record.exportName)) {
        diagnostics.push({
          code: "TYPE_ONLY_EXPORT",
          message: `Component '${componentName}' references '${record.exportName}', which is a type or interface declaration, not a renderable component value.`,
          severity: "ERROR",
          path: `components.${componentName}.exportName`,
        });
      } else {
        if (hasDefaultExport) {
          diagnostics.push({
            code: "EXPORT_KIND_MISMATCH",
            message: `Component '${componentName}' requested named export '${record.exportName}', but file only has default export.`,
            severity: "ERROR",
            path: `components.${componentName}.exportName`,
          });
        } else {
          diagnostics.push({
            code: "EXPORT_NOT_FOUND",
            message: `Component '${componentName}' named export '${record.exportName}' not found in '${resolvedPath}'. Available: [${Array.from(namedValueExports).join(", ")}]`,
            severity: "ERROR",
            path: `components.${componentName}.exportName`,
          });
        }
      }
    }

    // 5. Scan imports for unresolvable external monorepo dependencies
    const unresolvableDeps: string[] = [];
    sourceFile.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const imp = node.moduleSpecifier.text;
        if (imp.startsWith("@monorepo/")) {
          unresolvableDeps.push(imp);
        }
      }
    });

    if (unresolvableDeps.length > 0) {
      diagnostics.push({
        code: "UNVERIFIED_EXTERNAL_DEPENDENCY",
        message: `Module imports external monorepo packages [${unresolvableDeps.join(", ")}] not installed in standalone environment. Marked UNVERIFIED.`,
        severity: "WARNING",
        path: `components.${componentName}.dependencies`,
        details: { dependencies: unresolvableDeps },
      });
    }

    const hasErrors = diagnostics.some((d) => d.severity === "ERROR");
    // Unverified external dependencies strictly prevent verified=true
    const verified = !hasErrors && unresolvableDeps.length === 0;

    return {
      verified,
      resolvedFilePath: resolvedPath,
      exportKind: record.exportName === "default" ? "default" : "named",
      diagnostics,
    };
  } catch (err: any) {
    diagnostics.push({
      code: "AST_PARSING_ERROR",
      message: `Failed to parse AST for '${resolvedPath}': ${err.message}`,
      severity: "ERROR",
    });
    return { verified: false, resolvedFilePath: resolvedPath, exportKind: "none", diagnostics };
  }
}
