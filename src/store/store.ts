import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import roleReducer from "./slices/roleSlice";
import moduleReducer from "./slices/moduleSlice";
import userReducer from "./slices/userSlice";
import themeReducer from "./slices/themeSlice";
import reportingReducer from "./slices/reportingSlice";
import reportingManagementReducer from "./slices/reportingMangementSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    roles: roleReducer,
    modules: moduleReducer,
    users: userReducer,
    theme: themeReducer,
    reporting: reportingReducer,
    reportingManagement: reportingManagementReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
