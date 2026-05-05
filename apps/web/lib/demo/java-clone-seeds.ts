/**
 * 15 Java submissions for instructor similarity seeding.
 * Intentional near-duplicates (rename/reorder/comments) so CIPAS can form clusters.
 */

export interface JavaDemoSeedStudent {
  email: string;
  full_name: string;
  student_id: string;
  source: string;
}

function buildArrayStatsLab(opts: {
  className: string;
  mean: string;
  param: string;
  variance: string;
  maxFn: string;
  loopStyle: "index" | "forEach";
  tag: string;
  swapOrder: boolean;
}): string {
  const { className, mean, param, variance, maxFn, loopStyle, tag, swapOrder } = opts;

  const meanBody =
    loopStyle === "index"
      ? `    double total = 0.0;
    for (int i = 0; i < ${param}.length; i++) {
      total += (double) ${param}[i];
    }
    return total / (double) ${param}.length;`
      : `    double total = 0.0;
    for (int v : ${param}) {
      total += (double) v;
    }
    return total / (double) ${param}.length;`;

  const meanMethod = `  public static double ${mean}(int[] ${param}) {
    if (${param} == null || ${param}.length == 0) {
      return 0.0;
    }
${meanBody}
  }`;

  const varianceMethod = `  public static double ${variance}(int[] ${param}) {
    if (${param} == null || ${param}.length == 0) return 0.0;
    double mu = ${mean}(${param});
    double acc = 0.0;
    for (int j = 0; j < ${param}.length; j++) {
      double d = (double) ${param}[j] - mu;
      acc += d * d;
    }
    return acc / (double) ${param}.length;
  }`;

  const maxMethod = `  public static int ${maxFn}(int[] ${param}) {
    if (${param} == null || ${param}.length == 0) {
      throw new IllegalArgumentException("empty array");
    }
    int best = ${param}[0];
    for (int k = 1; k < ${param}.length; k++) {
      if (${param}[k] > best) {
        best = ${param}[k];
      }
    }
    return best;
  }`;

  const mainMethod = `  public static void main(String[] args) {
    int[] sample = {4, 11, 2, 9, 7, 5, 3};
    System.out.println(${mean}(sample));
    System.out.println(${variance}(sample));
    System.out.println(${maxFn}(sample));
  }`;

  const blk1 = swapOrder ? varianceMethod : meanMethod;
  const blk2 = swapOrder ? meanMethod : varianceMethod;

  return `// Seeded Java demo — ${tag}
public class ${className} {
${blk1}

${blk2}

${maxMethod}

${mainMethod}
}
`;
}

function javaSourceForIndex(i: number): string {
  const configs: Array<Parameters<typeof buildArrayStatsLab>[0]> = [
    { className: "ArrayStatsLab", mean: "computeMean", param: "values", variance: "populationVariance", maxFn: "findMax", loopStyle: "index", tag: "cluster-A-baseline", swapOrder: false },
    { className: "ArrayStatsLab", mean: "computeMean", param: "values", variance: "populationVariance", maxFn: "findMax", loopStyle: "index", tag: "cluster-A-type1-near-copy", swapOrder: false },
    { className: "ArrayStatsLab", mean: "computeMean", param: "values", variance: "populationVariance", maxFn: "findMax", loopStyle: "forEach", tag: "cluster-A-type2-loop-style", swapOrder: false },
    { className: "StatsHelper", mean: "mean", param: "arr", variance: "variance", maxFn: "maximum", loopStyle: "index", tag: "cluster-B-renamed", swapOrder: false },
    { className: "StatsHelper", mean: "mean", param: "arr", variance: "variance", maxFn: "maximum", loopStyle: "index", tag: "cluster-B-renamed-dup", swapOrder: false },
    { className: "StatsHelper", mean: "meanValue", param: "xs", variance: "popVar", maxFn: "maxVal", loopStyle: "forEach", tag: "cluster-B-type2", swapOrder: false },
    { className: "ArrayStatsLab", mean: "computeMean", param: "values", variance: "populationVariance", maxFn: "findMax", loopStyle: "index", tag: "cluster-A-reordered", swapOrder: true },
    { className: "StatsHelper", mean: "mean", param: "arr", variance: "variance", maxFn: "maximum", loopStyle: "forEach", tag: "cluster-B-reordered", swapOrder: true },
    { className: "NumericSummary", mean: "average", param: "nums", variance: "dispersion", maxFn: "upperBound", loopStyle: "index", tag: "cluster-C-mixed-names", swapOrder: false },
    { className: "NumericSummary", mean: "average", param: "nums", variance: "dispersion", maxFn: "upperBound", loopStyle: "index", tag: "cluster-C-mixed-names-dup", swapOrder: false },
    { className: "NumericSummary", mean: "avg", param: "data", variance: "varOf", maxFn: "maxOf", loopStyle: "forEach", tag: "cluster-C-type2", swapOrder: false },
    { className: "LabThreeArrays", mean: "computeMean", param: "a", variance: "populationVariance", maxFn: "findMax", loopStyle: "index", tag: "unique-short-params", swapOrder: false },
    { className: "LabThreeArrays", mean: "computeMean", param: "a", variance: "populationVariance", maxFn: "findMax", loopStyle: "forEach", tag: "unique-short-params-2", swapOrder: true },
    { className: "CourseStats", mean: "meanGrade", param: "scores", variance: "scoreVariance", maxFn: "topScore", loopStyle: "index", tag: "cluster-D-course-themed", swapOrder: false },
    { className: "CourseStats", mean: "meanGrade", param: "scores", variance: "scoreVariance", maxFn: "maxScore", loopStyle: "forEach", tag: "cluster-D-renamed-max", swapOrder: false },
  ];

  return buildArrayStatsLab(configs[i]);
}

/** Exactly 15 Java demo students. */
export const JAVA_DEMO_SEED_STUDENTS: JavaDemoSeedStudent[] = Array.from(
  { length: 15 },
  (_, i) => {
    const n = i + 1;
    return {
      email: `javademo.seed.${String(n).padStart(2, "0")}@demo.gradeloop.dev`,
      full_name: `Java Demo Student ${n}`,
      student_id: `JDEMO-2026-${String(n).padStart(2, "0")}`,
      source: javaSourceForIndex(i),
    };
  },
);
