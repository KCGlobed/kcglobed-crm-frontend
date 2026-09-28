import { createSlice } from '@reduxjs/toolkit';

export const exhibitSlice = createSlice({
  name: 'exhibit',
  initialState: { exhibits: [] as any[] },
  reducers: {
    addExhibit: (state, action) => { state.exhibits.push(action.payload); },
    removeExhibit: (state, action) => { state.exhibits = state.exhibits.filter(e => e !== action.payload); },
  },
});

export const { addExhibit, removeExhibit } = exhibitSlice.actions;
export default exhibitSlice.reducer;
