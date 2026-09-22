/**
 * DOM vs DesignContext Dimension & Geometry Verification
 */

export interface DimensionCheckResult {
  matched: boolean;
  widthDiff: number;
  heightDiff: number;
  tolerance: number;
  message: string;
}

/**
 * Compares measured DOM element dimensions with DesignContext layout bounds.
 */
export function compareDimensions(
  measured: { width: number; height: number },
  expected: { width: number; height: number },
  tolerance: number = 2
): DimensionCheckResult {
  const widthDiff = Math.abs(measured.width - expected.width);
  const heightDiff = Math.abs(measured.height - expected.height);
  const matched = widthDiff <= tolerance && heightDiff <= tolerance;

  return {
    matched,
    widthDiff,
    heightDiff,
    tolerance,
    message: matched
      ? `Dimensions matched within ${tolerance}px tolerance.`
      : `Dimension mismatch: width diff ${widthDiff}px, height diff ${heightDiff}px (tolerance: ${tolerance}px).`,
  };
}

export interface ConsistencyCoverageReport {
  screenId: string;
  revision: number;
  totalMapped: number;
  measuredCount: number;
  unmeasuredCount: number;
  coverageRatio: number;
  isApprovalBaseline: boolean;
  measurements: Record<string, unknown>;
}
