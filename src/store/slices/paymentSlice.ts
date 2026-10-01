import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchPaymentsApi,
  fetchPaymentByIdApi,
  fetchPaymentGatewayApi,
  verifyOfflinePaymentApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Payment } from "../../utils/types";

interface PaymentState extends Pagination<Payment> {
  selectedPayment: Payment | null;
  selectedPaymentLoading: boolean;
  actionLoading: boolean;
  gateway: { gateway?: string; online_available?: boolean; amount?: string | number; currency?: string; reason?: string } | null;
  gatewayLoading: boolean;
}

const initialState: PaymentState = {
  data: [],
  next: null,
  previous: null,
  pagination: {
    total_results: null,
    total_pages: null,
    current_page: null,
    next_page: null,
    page_size: null,
    previous_page: null,
  },
  page: 1,
  loading: false,
  error: null,
  selectedPayment: null,
  selectedPaymentLoading: false,
  actionLoading: false,
  gateway: null,
  gatewayLoading: false,
};

export const fetchPayments = createAsyncThunk<
  { data: Payment[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; status?: string; method?: string; search?: string; date_from?: string; date_to?: string } | void
>(
  "payments/fetchPayments",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchPaymentsApi(params || undefined);
      return {
        data: response?.data || [],
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch payments");
    }
  },
  {
    condition: (_, { getState }) => {
      const { payments } = getState() as { payments: { loading: boolean } };
      if (payments?.loading) return false;
      return true;
    },
  }
);

export const fetchPaymentById = createAsyncThunk<Payment, string>(
  "payments/fetchPaymentById",
  async (paymentUid, { rejectWithValue }) => {
    try {
      const response = await fetchPaymentByIdApi(paymentUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch payment details");
    }
  }
);

export const fetchPaymentGateway = createAsyncThunk<any>(
  "payments/fetchPaymentGateway",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchPaymentGatewayApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch payment gateway info");
    }
  },
  {
    condition: (_, { getState }) => {
      const { payments } = getState() as { payments: { gatewayLoading: boolean } };
      if (payments?.gatewayLoading) return false;
      return true;
    },
  }
);

export const verifyOfflinePayment = createAsyncThunk<
  any,
  { uid: string; approve: boolean; notes?: string }
>(
  "payments/verifyOfflinePayment",
  async ({ uid, approve, notes }, { rejectWithValue }) => {
    try {
      const response = await verifyOfflinePaymentApi(uid, notes ? { approve, notes } : { approve });
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to verify offline payment");
    }
  }
);

const paymentSlice = createSlice({
  name: "payments",
  initialState,
  reducers: {
    clearPaymentError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchPaymentById.pending, (state) => {
        state.selectedPaymentLoading = true;
        state.error = null;
      })
      .addCase(fetchPaymentById.fulfilled, (state, action) => {
        state.selectedPaymentLoading = false;
        state.selectedPayment = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.uid) {
          const idx = state.data.findIndex((p) => p.uid === action.payload.uid);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchPaymentById.rejected, (state, action) => {
        state.selectedPaymentLoading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchPaymentGateway.pending, (state) => {
        state.gatewayLoading = true;
      })
      .addCase(fetchPaymentGateway.fulfilled, (state, action) => {
        state.gatewayLoading = false;
        state.gateway = action.payload || null;
      })
      .addCase(fetchPaymentGateway.rejected, (state, action) => {
        state.gatewayLoading = false;
        state.error = action.payload as string;
      })

      .addCase(verifyOfflinePayment.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(verifyOfflinePayment.fulfilled, (state, action) => {
        state.actionLoading = false;
        const payment = action.payload?.payment ?? action.payload;
        if (payment?.uid && state.data && state.data.length > 0) {
          const idx = state.data.findIndex((p) => p.uid === payment.uid);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...payment };
          }
        }
        if (payment?.uid && state.selectedPayment?.uid === payment.uid) {
          state.selectedPayment = { ...state.selectedPayment, ...payment };
        }
      })
      .addCase(verifyOfflinePayment.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearPaymentError } = paymentSlice.actions;
export default paymentSlice.reducer;
