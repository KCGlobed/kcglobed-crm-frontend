import React, { useState, type ReactNode } from "react";
import type { StepProps } from "../../utils/types";

type Step = {
  title: string;
  content: (props: StepProps) => ReactNode;
};

type Props = {
  steps: Step[];
  onSubmit: (values: Record<string, any>) => void;
  onStepChange?: (step:string) =>void;
  showNextPrevButtons:boolean;
};

const MultiStepForm: React.FC<Props> = ({ steps, onSubmit, showNextPrevButtons=true, onStepChange }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const stepKey = steps[currentStep].title.toLowerCase().replace(/\s+/g, "_");

  const updateData = (key: string, values: Record<string, any>) => {
    setFormData((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...values,
      },
    }));
  };

  const handleGotoStep = (idx: number) => {
    setCurrentStep(idx);
    const step = steps[idx].title.toLowerCase().replace(/\s+/g, "_");
    onStepChange && onStepChange(step);
  };

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleFinalSubmit = () => {
    onSubmit(formData);
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="mx-auto bg-white rounded-2xl space-y-6 w-full">
      {/* Step Indicator */}
      <div className="flex justify-between mb-6 sticky top-0 z-50 bg-[#f2f2f2] p-2 gap-3 rounded-full">
        {steps.map((step, idx) => (
          <div
            key={idx}
            onClick={() => handleGotoStep(idx)}
            className={`flex-1 text-center py-2 rounded-full font-medium text-sm cursor-pointer transition ${
              idx === currentStep
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {step.title}
          </div>
        ))}
      </div>

      {/* Dynamic Step Content */}
      <div className="space-y-4">
        {steps[currentStep].content({
          stepKey,
          data: formData[stepKey] || {},
          updateData,
        })}
      </div>

      {/* Navigation Buttons */}
      {showNextPrevButtons && 
        <div className="flex justify-between sticky -bottom-0 bg-[#FFF] p-1">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-2 bg-gray-300 rounded-xl hover:bg-gray-400 transition"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={isLastStep ? handleFinalSubmit : handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            {isLastStep ? "Submit" : "Next"}
          </button>
        </div>
      }
    </div>
  );
};

export default MultiStepForm;
