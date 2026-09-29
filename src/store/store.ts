import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import roleReducer from "./slices/roleSlice";
import moduleReducer from "./slices/moduleSlice";
import userReducer from "./slices/userSlice";
import themeReducer from "./slices/themeSlice";
import reportingReducer from "./slices/reportingSlice";
import reportingManagementReducer from "./slices/reportingMangementSlice";
import profileReducer from "./slices/profileSlice";
import questionReducer from "./slices/questionSlice";
import exhibitReducer from "./slices/exhibitSlice";
import metaReducer from "./slices/metaSlice";
import leadReducer from "./slices/leadSlice";
import menuReducer from "./slices/menuSlice";
import stageReducer from "./slices/stageSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    roles: roleReducer,
    modules: moduleReducer,
    users: userReducer,
    theme: themeReducer,
    reporting: reportingReducer,
    reportingManagement: reportingManagementReducer,
    question: questionReducer,
    exhibit: exhibitReducer,
    meta: metaReducer,
    leads: leadReducer,
    menu: menuReducer,
    stages: stageReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
