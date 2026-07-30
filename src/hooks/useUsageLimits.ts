import { useCallback, useEffect, useRef, useState } from "react";
import * as systemApi from "../services/systemApi";
import type { ClaudeUsageStatus } from "../services/systemApi";

/**
 * Fetches once on mount only (no polling — same "refetch on mount or explicit refresh" philosophy
 * as useSessions/useUpdate) and exposes a manual `refresh` for the header badge's click-to-refresh.
 */
export function useUsageLimits() {
  const [status, setStatus] = useState<ClaudeUsageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await systemApi.fetchUsageLimits(forceRefresh);
      if (mountedRef.current) {
        setStatus(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Could not fetch usage limits.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return { status, loading, error, refresh };
}
