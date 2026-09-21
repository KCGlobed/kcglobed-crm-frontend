import React from "react";
import LexicalEditor from "../TextEditor";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  addSubQuestion,
  removeSubQuestion,
  setDescription,
  updateSubQuestion,
} from "../../store/slices/questionSlice";
import type { StepProps } from "../../utils/types";

const EditEssayQuestion: React.FC<StepProps> = () => {
  const dispatch = useAppDispatch();
  const { description, subQuestions } = useAppSelector((state) => state.question);

  // Update main description
  const handleDescriptionChange = (value: string) => {
    if(value){
      dispatch(setDescription(value));
    }
  };

  // Update sub-question text
  const handleSubQuestionChange = (id: string, value: string) => {
    dispatch(updateSubQuestion({ id, question: value }));
  };

  // Update sub-question answer
  const handleAnswerChange = (id: string, value: string) => {
    dispatch(updateSubQuestion({ id, answer: value }));
  };

  

  return (
    <div className="space-y-6">
      {/* Main Description */}
      <div>
        <label className="block font-semibold mb-1 text-gray-700">Description</label>
        <LexicalEditor
          type="desc"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Enter essay question description..."
        />
      </div>

      {/* Sub Questions Section */}
      <div className="space-y-6">
        {subQuestions.map((qa, idx) => (
          <div
            key={qa.id}
            className="gap-6 bg-gray-100 p-4 rounded-lg border border-gray-300"
          >
            <div>
              <label className="block font-semibold mb-1 text-gray-700 flex justify-between">
                <span>Sub Question {idx + 1}</span>  <button  className="cursor-pointer ms-4 bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded shadow-sm transition duration-200" onClick={()=>dispatch(removeSubQuestion(qa.id))}>Delete</button>
              </label>
              <LexicalEditor
                type="question"
                value={qa.question}
                onChange={(val) => handleSubQuestionChange(qa.id, val)}
                placeholder="Enter sub-question..."
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-gray-700">
                Answer {idx + 1}
              </label>
              <LexicalEditor
                type="answer"
                value={qa.answer}
                onChange={(val) => handleAnswerChange(qa.id, val)}
                placeholder="Type answer..."
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Button */}
      <div>
        <button
          type="button"
          onClick={() => dispatch(addSubQuestion())}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Add Sub Question
        </button>
      </div>
    </div>
  );
};

export default EditEssayQuestion;
