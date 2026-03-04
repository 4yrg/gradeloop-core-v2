import { create } from "zustand";

export interface StepperStep {
    id: string;
    title: string;
    description?: string;
}

interface AssignmentCreateState {
    currentStep: number;
    highestStepVisited: number;
    steps: StepperStep[];
    setStep: (step: number) => void;
    setHighestStepVisited: (step: number) => void;
    reset: () => void;
}

const defaultSteps: StepperStep[] = [
    { id: "basic", title: "Basic Info" },
    { id: "config", title: "Configuration" },
    { id: "tools", title: "Tools Selection" },
    { id: "grading", title: "Grading Settings" },
    { id: "review", title: "Review & Publish" },
];

export const useAssignmentCreateStore = create<AssignmentCreateState>((set) => ({
    currentStep: 1,
    highestStepVisited: 1,
    steps: defaultSteps,
    setStep: (step) => set((state) => ({
        currentStep: step,
        highestStepVisited: Math.max(state.highestStepVisited, step)
    })),
    setHighestStepVisited: (step) => set({ highestStepVisited: step }),
    reset: () => set({ currentStep: 1, highestStepVisited: 1 }),
}));
