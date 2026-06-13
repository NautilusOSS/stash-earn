import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getPlatformAvmUsdcOptInStatusFn,
  triggerPlatformAvmUsdcOptInFn,
} from "@/lib/api/platform.functions";

export const platformAvmUsdcOptInQueryKey = ["platform-avm-usdc-opt-in"] as const;

export function usePlatformAvmUsdcOptIn() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: platformAvmUsdcOptInQueryKey,
    queryFn: () => getPlatformAvmUsdcOptInStatusFn(),
    staleTime: 30_000,
  });

  const optInMutation = useMutation({
    mutationFn: () => triggerPlatformAvmUsdcOptInFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformAvmUsdcOptInQueryKey });
    },
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    statusError: statusQuery.error?.message,
    optedIn: statusQuery.data?.optedIn ?? false,
    isConfigured: statusQuery.data != null,
    optIn: optInMutation.mutateAsync,
    isOptingIn: optInMutation.isPending,
    optInResult: optInMutation.data,
    optInError: optInMutation.error?.message,
  };
}
