import type { RawSubmission } from "@/lib/similarity-segment-graph/types";

const s = (
  id: string,
  code: string,
  t: 1 | 2 | 3,
  cw: string[],
) => ({ segment_id: id, code, clone_type: t, clones_with: cw });

/** 20 Java submissions, “Top Hill” — segment-level clone graph (instructor demo / lab). */
export const TOP_HILL_SUBMISSIONS: RawSubmission[] = [
  {
    submission_id: "S1",
    segments: [
      s("S1_A", "int n = arr.length;", 1, ["S2_A", "S3_A", "S4_A"]),
      s(
        "S1_B",
        "for(int i=1;i<n-1;i++){ if(arr[i]>arr[i-1] && arr[i]>arr[i+1]) return i; }",
        2,
        ["S2_B", "S5_B", "S6_B"],
      ),
    ],
  },
  {
    submission_id: "S2",
    segments: [
      s("S2_A", "int size = arr.length;", 1, ["S1_A", "S3_A", "S4_A"]),
      s(
        "S2_B",
        "for(int j=1;j<size-1;j++){ if(arr[j]>arr[j-1] && arr[j]>arr[j+1]) return j; }",
        2,
        ["S1_B", "S5_B", "S6_B"],
      ),
    ],
  },
  {
    submission_id: "S3",
    segments: [
      s("S3_A", "int len = arr.length;", 1, ["S1_A", "S2_A", "S4_A"]),
      s(
        "S3_B",
        "int l=0,r=len-1; while(l<r){ int m=(l+r)/2; if(arr[m]<arr[m+1]) l=m+1; else r=m; }",
        3,
        ["S4_B", "S7_B", "S8_B"],
      ),
    ],
  },
  {
    submission_id: "S4",
    segments: [
      s("S4_A", "int n = arr.length;", 1, ["S1_A", "S2_A", "S3_A"]),
      s(
        "S4_B",
        "while(left<right){ int mid=(left+right)/2; if(arr[mid]<arr[mid+1]) left=mid+1; else right=mid; }",
        3,
        ["S3_B", "S7_B", "S8_B"],
      ),
    ],
  },
  {
    submission_id: "S5",
    segments: [
      s("S5_A", "int n = arr.length;", 1, ["S6_A", "S7_A"]),
      s(
        "S5_B",
        "for(int i=1;i<n-1;i++){ if(arr[i]>arr[i-1] && arr[i]>arr[i+1]) return i; }",
        2,
        ["S1_B", "S2_B", "S6_B"],
      ),
    ],
  },
  {
    submission_id: "S6",
    segments: [
      s("S6_A", "int size = arr.length;", 1, ["S5_A", "S7_A"]),
      s(
        "S6_B",
        "for(int k=1;k<size-1;k++){ if(arr[k]>arr[k-1] && arr[k]>arr[k+1]) return k; }",
        2,
        ["S1_B", "S2_B", "S5_B"],
      ),
    ],
  },
  {
    submission_id: "S7",
    segments: [
      s("S7_A", "int len = arr.length;", 1, ["S5_A", "S6_A"]),
      s(
        "S7_B",
        "int low=0,high=len-1; while(low<high){ int mid=(low+high)/2; if(arr[mid]<arr[mid+1]) low=mid+1; else high=mid; }",
        3,
        ["S3_B", "S4_B", "S8_B"],
      ),
    ],
  },
  {
    submission_id: "S8",
    segments: [
      s("S8_A", "int n = arr.length;", 1, ["S9_A", "S10_A"]),
      s(
        "S8_B",
        "while(l<r){ int mid=(l+r)/2; if(arr[mid]<arr[mid+1]) l=mid+1; else r=mid; }",
        3,
        ["S3_B", "S4_B", "S7_B"],
      ),
    ],
  },
  {
    submission_id: "S9",
    segments: [
      s("S9_A", "int size = arr.length;", 1, ["S8_A", "S10_A"]),
      s("S9_B", "return binaryPeak(arr);", 2, ["S10_B", "S11_B"]),
    ],
  },
  {
    submission_id: "S10",
    segments: [
      s("S10_A", "int len = arr.length;", 1, ["S8_A", "S9_A"]),
      s("S10_B", "return binaryPeak(arr);", 2, ["S9_B", "S11_B"]),
    ],
  },
  {
    submission_id: "S11",
    segments: [
      s("S11_A", "int n = arr.length;", 1, ["S12_A", "S13_A"]),
      s("S11_B", "return binaryPeak(arr);", 2, ["S9_B", "S10_B"]),
    ],
  },
  {
    submission_id: "S12",
    segments: [
      s("S12_A", "int size = arr.length;", 1, ["S11_A", "S13_A"]),
      s("S12_B", "int mid=(l+r)/2;", 1, ["S13_B", "S14_B"]),
    ],
  },
  {
    submission_id: "S13",
    segments: [
      s("S13_A", "int len = arr.length;", 1, ["S11_A", "S12_A"]),
      s("S13_B", "int mid=(left+right)/2;", 1, ["S12_B", "S14_B"]),
    ],
  },
  {
    submission_id: "S14",
    segments: [
      s("S14_A", "int n = arr.length;", 1, ["S15_A", "S16_A"]),
      s("S14_B", "int mid=(l+r)/2;", 1, ["S12_B", "S13_B"]),
    ],
  },
  {
    submission_id: "S15",
    segments: [
      s("S15_A", "int size = arr.length;", 1, ["S14_A", "S16_A"]),
      s("S15_B", "if(arr[mid]<arr[mid+1])", 2, ["S16_B", "S17_B"]),
    ],
  },
  {
    submission_id: "S16",
    segments: [
      s("S16_A", "int len = arr.length;", 1, ["S14_A", "S15_A"]),
      s("S16_B", "if(arr[mid]<arr[mid+1])", 2, ["S15_B", "S17_B"]),
    ],
  },
  {
    submission_id: "S17",
    segments: [
      s("S17_A", "int n = arr.length;", 1, ["S18_A", "S19_A"]),
      s("S17_B", "if(arr[mid]<arr[mid+1])", 2, ["S15_B", "S16_B"]),
    ],
  },
  {
    submission_id: "S18",
    segments: [
      s("S18_A", "int size = arr.length;", 1, ["S17_A", "S19_A"]),
      s("S18_B", "return l;", 3, ["S19_B", "S20_B"]),
    ],
  },
  {
    submission_id: "S19",
    segments: [
      s("S19_A", "int len = arr.length;", 1, ["S17_A", "S18_A"]),
      s("S19_B", "return left;", 3, ["S18_B", "S20_B"]),
    ],
  },
  {
    submission_id: "S20",
    segments: [
      s("S20_A", "int n = arr.length;", 1, ["S18_A", "S19_A"]),
      s("S20_B", "return l;", 3, ["S18_B", "S19_B"]),
    ],
  },
];
