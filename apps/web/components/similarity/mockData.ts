export interface CodeSegment {
  segment_id: string;
  code: string;
  clone_type: 1 | 2 | 3;
  clones_with: string[];
}

export interface Submission {
  submission_id: string;
  student_name: string;
  similarity_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  ai_likelihood?: number;
  semantic_similarity_score?: number;
  segments: CodeSegment[];
}

export const mockSubmissions: Submission[] = [
  {
    submission_id: "S1",
    student_name: "Alex Rivers",
    similarity_score: 92,
    risk_level: "High",
    ai_likelihood: 0.85,
    semantic_similarity_score: 94,
    segments: [
      {
        segment_id: "S1_A",
        code: "public class PeakFinder {\n    public int findPeak(int[] arr) {\n        int n = arr.length;\n        for(int i=1; i<n-1; i++) {\n            if(arr[i] > arr[i-1] && arr[i] > arr[i+1]) return i;\n        }\n        return -1;\n    }\n}",
        clone_type: 1,
        clones_with: ["S2_A", "S5_A", "S6_A"]
      }
    ]
  },
  {
    submission_id: "S2",
    student_name: "Jordan Smith",
    similarity_score: 92,
    risk_level: "High",
    ai_likelihood: 0.12,
    semantic_similarity_score: 94,
    segments: [
      {
        segment_id: "S2_A",
        code: "public class Solution {\n    public int findPeak(int[] arr) {\n        int n = arr.length;\n        for(int i=1; i<n-1; i++) {\n            if(arr[i] > arr[i-1] && arr[i] > arr[i+1]) return i;\n        }\n        return -1;\n    }\n}",
        clone_type: 1,
        clones_with: ["S1_A", "S5_A", "S6_A"]
      }
    ]
  },
  {
    submission_id: "S3",
    student_name: "Casey Chen",
    similarity_score: 75,
    risk_level: "High",
    ai_likelihood: 0.78,
    semantic_similarity_score: 82,
    segments: [
      {
        segment_id: "S3_A",
        code: "public int searchPeak(int[] nums) {\n    int left = 0, right = nums.length - 1;\n    while (left < right) {\n        int mid = (left + right) / 2;\n        if (nums[mid] < nums[mid+1]) left = mid + 1;\n        else right = mid;\n    }\n    return left;\n}",
        clone_type: 2,
        clones_with: ["S4_A", "S7_A"]
      }
    ]
  },
  {
    submission_id: "S4",
    student_name: "Taylor Morgan",
    similarity_score: 75,
    risk_level: "High",
    ai_likelihood: 0.05,
    semantic_similarity_score: 82,
    segments: [
      {
        segment_id: "S4_A",
        code: "public int find(int[] arr) {\n    int low = 0, high = arr.length - 1;\n    while (low < high) {\n        int middle = (low + high) / 2;\n        if (arr[middle] < arr[middle+1]) low = middle + 1;\n        else high = middle;\n    }\n    return low;\n}",
        clone_type: 2,
        clones_with: ["S3_A", "S7_A"]
      }
    ]
  },
  {
    submission_id: "S5",
    student_name: "Riley Davis",
    similarity_score: 88,
    risk_level: "High",
    ai_likelihood: 0.92,
    semantic_similarity_score: 90,
    segments: [
      {
        segment_id: "S5_A",
        code: "public int getPeak(int[] a) {\n    int size = a.length;\n    for(int j=1; j<size-1; j++) {\n        if(a[j] > a[j-1] && a[j] > a[j+1]) return j;\n    }\n    return -1;\n}",
        clone_type: 2,
        clones_with: ["S1_A", "S2_A", "S6_A"]
      }
    ]
  },
  {
    submission_id: "S6",
    student_name: "Sam Wilson",
    similarity_score: 88,
    risk_level: "High",
    ai_likelihood: 0.15,
    semantic_similarity_score: 90,
    segments: [
      {
        segment_id: "S6_A",
        code: "public int peak(int[] array) {\n    int length = array.length;\n    for(int k=1; k<length-1; k++) {\n        if(array[k] > array[k-1] && array[k] > array[k+1]) return k;\n    }\n    return -1;\n}",
        clone_type: 2,
        clones_with: ["S1_A", "S2_A", "S5_A"]
      }
    ]
  },
  {
    submission_id: "S7",
    student_name: "Morgan Lee",
    similarity_score: 65,
    risk_level: "Medium",
    ai_likelihood: 0.08,
    semantic_similarity_score: 72,
    segments: [
      {
        segment_id: "S7_A",
        code: "public int solve(int[] input) {\n    int l = 0, r = input.length - 1;\n    while (l < r) {\n        int m = l + (r - l) / 2;\n        if (input[m] < input[m+1]) l = m + 1;\n        else r = m;\n    }\n    return l;\n}",
        clone_type: 3,
        clones_with: ["S3_A", "S4_A"]
      }
    ]
  },
  {
    submission_id: "S8",
    student_name: "Jamie Reed",
    similarity_score: 15,
    risk_level: "Low",
    ai_likelihood: 0.02,
    semantic_similarity_score: 18,
    segments: [
      {
        segment_id: "S8_A",
        code: "public int findLocalMaximum(int[] arr) {\n    if (arr.length == 1) return 0;\n    // unique implementation\n    return binarySearch(arr, 0, arr.length - 1);\n}",
        clone_type: 3,
        clones_with: []
      }
    ]
  },
  {
    submission_id: "S9",
    student_name: "Dakota Bell",
    similarity_score: 10,
    risk_level: "Low",
    ai_likelihood: 0.01,
    semantic_similarity_score: 12,
    segments: [
      {
        segment_id: "S9_A",
        code: "public int findPeak(int[] arr) {\n    return find(arr, 0, arr.length-1);\n}",
        clone_type: 3,
        clones_with: []
      }
    ]
  },
  {
    submission_id: "S10",
    student_name: "Skyler Gray",
    similarity_score: 5,
    risk_level: "Low",
    ai_likelihood: 0.04,
    semantic_similarity_score: 8,
    segments: [
      {
        segment_id: "S10_A",
        code: "public int getPeakIndex(int[] nums) {\n    for (int i = 0; i < nums.length; i++) {\n        boolean isLeftOk = (i == 0) || (nums[i] > nums[i-1]);\n        boolean isRightOk = (i == nums.length - 1) || (nums[i] > nums[i+1]);\n        if (isLeftOk && isRightOk) return i;\n    }\n    return 0;\n}",
        clone_type: 3,
        clones_with: []
      }
    ]
  }
];

export const getCytoscapeElements = (submissions: Submission[]) => {
  const elements: any[] = [];
  const edgeSet = new Set<string>();

  submissions.forEach(sub => {
    elements.push({
      data: { 
        id: sub.submission_id, 
        label: sub.student_name,
        type: 'submission',
        risk: sub.risk_level,
        aiLikelihood: sub.ai_likelihood,
        semanticSimilarityScore: sub.semantic_similarity_score
      }
    });

    sub.segments.forEach(seg => {
      elements.push({
        data: { 
          id: seg.segment_id, 
          label: seg.segment_id.split('_')[1],
          parent: sub.submission_id,
          code: seg.code,
          type: 'segment',
          cloneType: seg.clone_type
        }
      });

      seg.clones_with.forEach(targetId => {
        const edgeId = [seg.segment_id, targetId].sort().join('-');
        if (!edgeSet.has(edgeId)) {
          elements.push({
            data: { 
              id: edgeId, 
              source: seg.segment_id, 
              target: targetId,
              cloneType: seg.clone_type
            }
          });
          edgeSet.add(edgeId);
        }
      });
    });
  });

  return elements;
};
