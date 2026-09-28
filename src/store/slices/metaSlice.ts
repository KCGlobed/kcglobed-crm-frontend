import { createSlice } from '@reduxjs/toolkit';

export const metaSlice = createSlice({
  name: 'meta',
  initialState: { 
    simulationId: '', 
    difficulty: '', 
    cognitiveLevel: '', 
    bloomTaxonomy: '', 
    topics: [] as string[], 
    source: '', 
    note: '',
    course: '' as any,
    courseId: '',
    subjectId: '',
    chapterId: '',
    questionId: '',
    difficulty_level: '',
    pass_percentage: ''
  },
  reducers: {
    updateDifficulty: (state, action) => { state.difficulty = action.payload; },
    updateCognitiveLevel: (state, action) => { state.cognitiveLevel = action.payload; },
    updateBloomTaxonomy: (state, action) => { state.bloomTaxonomy = action.payload; },
    updateTopics: (state, action) => { state.topics = action.payload; },
    updateSource: (state, action) => { state.source = action.payload; },
    updateNote: (state, action) => { state.note = action.payload; },
    updateMeta: (state, action) => { Object.assign(state, action.payload); },
  },
});

export const { updateDifficulty, updateCognitiveLevel, updateBloomTaxonomy, updateTopics, updateSource, updateNote, updateMeta } = metaSlice.actions;
export default metaSlice.reducer;
