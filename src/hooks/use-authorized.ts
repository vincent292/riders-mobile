import { useCallback } from "react";
import { useRiderAuth } from "@/context/rider-auth";
import { RiderApiError } from "@/lib/rider-api";

export function useAuthorized() {
  const { session, refreshSession } = useRiderAuth();
  const token = session?.accessToken;
  return useCallback(async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
    if (!token) throw new RiderApiError("unauthorized");
    try {
      return await operation(token);
    } catch (error) {
      if (!(error instanceof RiderApiError) || error.code !== "unauthorized") throw error;
      const refreshed = await refreshSession();
      if (!refreshed?.accessToken) throw error;
      return operation(refreshed.accessToken);
    }
  }, [refreshSession, token]);
}
