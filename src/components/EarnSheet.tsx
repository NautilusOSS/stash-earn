import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";

import { EarnDestinationPicker } from "@/components/EarnDestinationPicker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAutoEarn } from "@/hooks/useAutoEarn";
import { getAutoEarnDestination } from "@/lib/privy/profile";
import { fmtUSD } from "@/lib/stash";
import {
  AUTO_EARN_DESTINATIONS,
  isEarnVaultDestination,
  type AutoEarnDestination,
  type ResolvedAutoEarnTarget,
} from "@/lib/stash/auto-earn";

const USDC_EPSILON = 0.000_001;

type EarnSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | undefined;
  baseAmount: number;
  voiAmount: number;
  preferDorkFi?: boolean;
};

function resolveEarnAmount(
  resolvedTarget: ResolvedAutoEarnTarget | null,
  baseAmount: number,
  voiAmount: number,
): number {
  if (resolvedTarget === "dorkfi") {
    return baseAmount + voiAmount;
  }
  return baseAmount;
}

export function EarnSheet({
  open,
  onOpenChange,
  walletAddress,
  baseAmount,
  voiAmount,
  preferDorkFi = false,
}: EarnSheetProps) {
  const { user } = usePrivy();
  const { preference, applyAutoEarn, resolveForPreference, getEarnOptionHint } =
    useAutoEarn(walletAddress);
  const [destination, setDestination] = useState<AutoEarnDestination>(preference);
  const [isEarning, setIsEarning] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (preferDorkFi && resolveForPreference("dorkfi") != null) {
      setDestination("dorkfi");
      return;
    }

    const saved = getAutoEarnDestination(user);
    if (resolveForPreference(saved)) {
      setDestination(saved);
      return;
    }

    const firstReady = AUTO_EARN_DESTINATIONS.find((option) => resolveForPreference(option));
    setDestination(firstReady ?? saved);
  }, [open, user, resolveForPreference, preferDorkFi]);

  const selectedTarget = resolveForPreference(destination);
  const earnAmount = useMemo(
    () => resolveEarnAmount(selectedTarget, baseAmount, voiAmount),
    [selectedTarget, baseAmount, voiAmount],
  );

  const canSubmit = selectedTarget != null && earnAmount > USDC_EPSILON && !isEarning;

  const description = useMemo(() => {
    if (baseAmount > USDC_EPSILON && voiAmount > USDC_EPSILON) {
      return `Move ${fmtUSD(baseAmount)} from your Base wallet and supply ${fmtUSD(voiAmount)} already on Voi. This does not change your auto earn setting in Account.`;
    }
    if (voiAmount > USDC_EPSILON) {
      return `Supply ${fmtUSD(voiAmount)} from your Voi address to DorkFi. This does not change your auto earn setting in Account.`;
    }
    return `Move ${fmtUSD(baseAmount)} from your wallet into a yield destination. This does not change your auto earn setting in Account.`;
  }, [baseAmount, voiAmount]);

  const handleEarn = async () => {
    if (!canSubmit) return;
    setIsEarning(true);
    try {
      const result = await applyAutoEarn(earnAmount, {
        notify: true,
        preferenceOverride: destination,
      });
      if (result) {
        onOpenChange(false);
      }
    } finally {
      setIsEarning(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Earn</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <EarnDestinationPicker
            destination={destination}
            onDestinationChange={setDestination}
            isOptionReady={(option) => {
              if (resolveForPreference(option) == null) return false;
              if (isEarnVaultDestination(option) && baseAmount <= USDC_EPSILON) return false;
              if (
                option === "dorkfi" &&
                baseAmount <= USDC_EPSILON &&
                voiAmount <= USDC_EPSILON
              ) {
                return false;
              }
              return true;
            }}
            getOptionHint={getEarnOptionHint}
          />
        </div>

        <Button
          size="lg"
          onClick={() => void handleEarn()}
          disabled={!canSubmit}
          className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
        >
          {isEarning ? "Earning…" : `Earn ${fmtUSD(earnAmount)}`}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
