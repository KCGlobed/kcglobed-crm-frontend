import { createSlice } from '@reduxjs/toolkit';

export const questionSlice = createSlice({
  name: 'question',
  initialState: { question: '', answer: '', title: '', exhibit: '' as any, questions: [] as any[], description: '', subQuestions: [] as any[] },
  reducers: {
    updateQuestion: (state, action) => { state.question = action.payload; },
    updateAnswer: (state, action) => { state.answer = action.payload; },
    updateQuestionTitle: (state, action) => { state.title = action.payload; },
    updateExhibit: (state, action) => { state.exhibit = action.payload; },
    addSubQuestion: (state, action) => { state.subQuestions.push(action.payload); },
    removeSubQuestion: (state, action) => { state.subQuestions = state.subQuestions.filter((_, i) => i !== action.payload); },
    setDescription: (state, action) => { state.description = action.payload; },
    updateSubQuestion: (state, action) => { 
        const { index, value } = action.payload;
        if (state.subQuestions[index]) {
            state.subQuestions[index] = value;
        }
    },
  },
});

export const { updateQuestion, updateAnswer, updateQuestionTitle, updateExhibit, addSubQuestion, removeSubQuestion, setDescription, updateSubQuestion } = questionSlice.actions;
export default questionSlice.reducer;
