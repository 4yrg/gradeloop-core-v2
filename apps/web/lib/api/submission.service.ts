import axios from 'axios';
import { SubmissionPayload } from '@/types/code-editor.types';

const SUBMISSION_API_BASE = process.env.NEXT_PUBLIC_SUBMISSION_SERVICE_URL || 'http://localhost:8081/api/v1';

interface SubmissionResponse {
  submissionId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
  estimatedTime?: number;
  message: string;
}

interface SubmissionStatusResponse {
  submissionId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
  result?: {
    compiled: boolean;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    executionTime?: number;
    memoryUsed?: number;
    testResults?: Array<{
      name: string;
      passed: boolean;
      output?: string;
      error?: string;
    }>;
  };
  feedback?: string;
  grade?: number;
  submittedAt: string;
  processedAt?: string;
}

interface SubmissionHistoryItem {
  submissionId: string;
  assignmentId: string;
  userId: string;
  status: string;
  grade?: number;
  submittedAt: string;
}

export const submissionService = {
  /**
   * Submit code for evaluation - enqueues to RabbitMQ
   */
  async submitCode(payload: SubmissionPayload): Promise<SubmissionResponse> {
    try {
      const response = await axios.post<SubmissionResponse>(
        `${SUBMISSION_API_BASE}/submissions/submit`,
        payload,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Submission failed:', error);
      throw new Error('Failed to submit code for evaluation');
    }
  },

  /**
   * Get submission status
   */
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatusResponse> {
    try {
      const response = await axios.get<SubmissionStatusResponse>(
        `${SUBMISSION_API_BASE}/submissions/${submissionId}/status`,
        {
          withCredentials: true,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get submission status:', error);
      throw new Error('Failed to retrieve submission status');
    }
  },

  /**
   * Get submission history for a user
   */
  async getSubmissionHistory(userId: string, assignmentId?: string): Promise<SubmissionHistoryItem[]> {
    try {
      const response = await axios.get<{ submissions: SubmissionHistoryItem[] }>(
        `${SUBMISSION_API_BASE}/submissions/history`,
        {
          params: {
            userId,
            assignmentId,
          },
          withCredentials: true,
        }
      );

      return response.data.submissions;
    } catch (error) {
      console.error('Failed to get submission history:', error);
      throw new Error('Failed to retrieve submission history');
    }
  },

  /**
   * Poll submission status until completion
   */
  async pollSubmissionStatus(
    submissionId: string,
    intervalMs: number = 2000,
    maxAttempts: number = 30
  ): Promise<SubmissionStatusResponse> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getSubmissionStatus(submissionId);

          if (status.status === 'completed' || status.status === 'failed') {
            resolve(status);
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error('Submission polling timeout'));
            return;
          }

          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  },

  /**
   * Cancel a queued submission
   */
  async cancelSubmission(submissionId: string): Promise<void> {
    try {
      await axios.post(
        `${SUBMISSION_API_BASE}/submissions/${submissionId}/cancel`,
        {},
        {
          withCredentials: true,
        }
      );
    } catch (error) {
      console.error('Failed to cancel submission:', error);
      throw new Error('Failed to cancel submission');
    }
  },

  /**
   * Resubmit a failed submission
   */
  async resubmit(submissionId: string): Promise<SubmissionResponse> {
    try {
      const response = await axios.post<SubmissionResponse>(
        `${SUBMISSION_API_BASE}/submissions/${submissionId}/resubmit`,
        {},
        {
          withCredentials: true,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Resubmission failed:', error);
      throw new Error('Failed to resubmit code');
    }
  },

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queueLength: number;
    processing: number;
    averageWaitTime: number;
  }> {
    try {
      const response = await axios.get(
        `${SUBMISSION_API_BASE}/submissions/queue/stats`,
        {
          withCredentials: true,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      throw new Error('Failed to retrieve queue statistics');
    }
  },
};
