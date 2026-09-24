// useReportingTree.ts
import { useCallback, useEffect, useState } from "react";
import type { ReportingTreeNode, ReportingTreeResponse } from "./types";

/**
 * A fetcher is any function that resolves to the raw API response shape.
 * This keeps the hook decoupled from fetch/axios/your api client — you
 * plug in whatever you already use to call your backend.
 *
 * Example with fetch:
 *   () => fetch("/api/reporting-tree").then(r => r.json())
 *
 * Example with axios:
 *   () => api.get("/reporting-tree").then(r => r.data)
 */
export type ReportingTreeFetcher = () => Promise<ReportingTreeResponse>;

interface UseReportingTreeResult {
  data: ReportingTreeNode[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useReportingTree(
  fetcher: ReportingTreeFetcher
): UseReportingTreeResult {
  const [data, setData] = useState<ReportingTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  const refetch = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetcher();
        if (isCancelled) return;

        if (response.success) {
          setData(response.data ?? []);
        } else {
          setError(response.message || "Failed to load reporting tree");
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while fetching the reporting tree"
          );
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return { data, isLoading, error, refetch };
}
