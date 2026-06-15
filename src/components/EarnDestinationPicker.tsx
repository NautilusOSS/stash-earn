import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { useEarnVaultApys } from "@/hooks/useEarnVaultApys";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import {
  AUTO_EARN_OPTIONS,
  isEarnVaultDestination,
  type AutoEarnDestination,
} from "@/lib/stash/auto-earn";

type EarnDestinationPickerProps = {
  destination: AutoEarnDestination;
  onDestinationChange: (destination: AutoEarnDestination) => void;
  isOptionReady?: (destination: AutoEarnDestination) => boolean;
  getOptionHint?: (destination: AutoEarnDestination) => string | null;
};

export function EarnDestinationPicker({
  destination,
  onDestinationChange,
  isOptionReady,
  getOptionHint,
}: EarnDestinationPickerProps) {
  const { configured: earnConfigured } = useEarnVaultDetails();
  const { apyLabels, isLoading: vaultApyLoading } = useEarnVaultApys();
  const { supplyApyLabel } = useDorkFiSupplyApy();

  const highestYieldHint = () => {
    const vaultLabels = AUTO_EARN_OPTIONS.filter((option) =>
      isEarnVaultDestination(option.id),
    )
      .map((option) => {
        const apy = apyLabels[option.id];
        return apy ? `${option.label} ${apy}` : null;
      })
      .filter(Boolean);

    if (vaultLabels.length > 0 && supplyApyLabel) {
      return [...vaultLabels, `DorkFi ${supplyApyLabel}`].join(" · ");
    }
    return "Compares live APYs at deposit time";
  };

  return (
    <div className="space-y-3">
      {AUTO_EARN_OPTIONS.map((option) => {
        const selected = destination === option.id;
        const ready = isOptionReady?.(option.id) ?? true;
        const customHint = getOptionHint?.(option.id);
        const apyHint = isEarnVaultDestination(option.id)
          ? earnConfigured
            ? vaultApyLoading
              ? "APY loading"
              : apyLabels[option.id]
                ? `${apyLabels[option.id]} APY`
                : `${option.label} configured`
            : "Earn vault not configured"
          : option.id === "dorkfi"
            ? supplyApyLabel
              ? `${supplyApyLabel} APY on Voi`
              : "DorkFi APY loading"
            : highestYieldHint();

        return (
          <button
            key={option.id}
            type="button"
            disabled={!ready}
            onClick={() => onDestinationChange(option.id)}
            className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors disabled:opacity-50 ${
              selected
                ? "border-foreground bg-secondary"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {customHint ?? (ready ? apyHint : "Not ready yet")}
                </p>
              </div>
              <span
                className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  selected ? "border-foreground bg-foreground" : "border-border"
                }`}
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-background" /> : null}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
