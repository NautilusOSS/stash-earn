import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getPrivyClient } from "@/lib/privy/privy.server";
import { mergeCustomMetadata } from "@/lib/privy/metadata.server";
import { PROFILE_AVATARS, PROFILE_NAME_MAX_LENGTH } from "@/lib/privy/profile";
import { AUTO_EARN_DESTINATIONS } from "@/lib/stash/auto-earn";
import { validateEvmAddress } from "@/lib/xchain/validate";

const avatarSchema = z.enum(PROFILE_AVATARS);

const updateProfileInput = z.object({
  preferredName: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH),
  avatar: avatarSchema.optional(),
  accessToken: z.string().min(1),
});

const updateWithdrawAddressInput = z.object({
  withdrawAddress: z.string().trim().min(1),
  accessToken: z.string().min(1),
});

const updateAutoEarnDestinationInput = z.object({
  autoEarnDestination: z.enum(AUTO_EARN_DESTINATIONS),
  accessToken: z.string().min(1),
});

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(updateProfileInput)
  .handler(async ({ data }) => {
    const privy = getPrivyClient();
    const claims = await privy.verifyAuthToken(data.accessToken);

    const patch: Record<string, string> = {
      preferredName: data.preferredName,
    };

    if (data.avatar) {
      patch.avatar = data.avatar;
    }

    await mergeCustomMetadata(claims.userId, patch);

    return { success: true };
  });

/** Save the Base address that receives vault withdrawals. */
export const updateWithdrawAddress = createServerFn({ method: "POST" })
  .inputValidator(updateWithdrawAddressInput)
  .handler(async ({ data }) => {
    const validation = validateEvmAddress(data.withdrawAddress);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const privy = getPrivyClient();
    const claims = await privy.verifyAuthToken(data.accessToken);

    await mergeCustomMetadata(claims.userId, {
      withdrawAddress: validation.normalized,
    });

    return { success: true, withdrawAddress: validation.normalized };
  });

/** Where auto-earn sweeps deposits after funding. */
export const updateAutoEarnDestination = createServerFn({ method: "POST" })
  .inputValidator(updateAutoEarnDestinationInput)
  .handler(async ({ data }) => {
    const privy = getPrivyClient();
    const claims = await privy.verifyAuthToken(data.accessToken);

    await mergeCustomMetadata(claims.userId, {
      autoEarnDestination: data.autoEarnDestination,
    });

    return { success: true, autoEarnDestination: data.autoEarnDestination };
  });
