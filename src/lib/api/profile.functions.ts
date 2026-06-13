import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getPrivyClient } from "@/lib/privy/privy.server";
import { PROFILE_AVATARS, PROFILE_NAME_MAX_LENGTH } from "@/lib/privy/profile";

const avatarSchema = z.enum(PROFILE_AVATARS);

const updateProfileInput = z.object({
  preferredName: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH),
  avatar: avatarSchema.optional(),
  accessToken: z.string().min(1),
});

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(updateProfileInput)
  .handler(async ({ data }) => {
    const privy = getPrivyClient();
    const claims = await privy.verifyAuthToken(data.accessToken);

    const customMetadata: Record<string, string> = {
      preferredName: data.preferredName,
    };

    if (data.avatar) {
      customMetadata.avatar = data.avatar;
    }

    await privy.setCustomMetadata(claims.userId, customMetadata);

    return { success: true };
  });
