import { useAuthorizationSignature } from "@privy-io/react-auth";
import { useCallback } from "react";

import { getPrivyAppId } from "@/lib/privy/constants";
import {
  buildPrivyWalletActionAuthInput,
  type PrivyWalletActionAuth,
} from "@/lib/privy/wallet-action-auth";

/** Sign Privy wallet API requests with the user's embedded wallet authorization key. */
export function usePrivyWalletActionSigner() {
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const appId = getPrivyAppId();

  const signWalletAction = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<PrivyWalletActionAuth> => {
      const input = buildPrivyWalletActionAuthInput(path, body, appId);
      const { signature } = await generateAuthorizationSignature(input);
      return {
        authorizationSignature: signature,
        requestExpiry: input.headers["privy-request-expiry"],
      };
    },
    [generateAuthorizationSignature, appId],
  );

  return { signWalletAction };
}
