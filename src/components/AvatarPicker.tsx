import { PROFILE_AVATARS } from "@/lib/privy/profile";
import { cn } from "@/lib/utils";

export function AvatarPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (avatar: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROFILE_AVATARS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            "grid h-12 w-12 place-items-center rounded-2xl text-2xl transition-transform active:scale-95",
            value === emoji
              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
              : "bg-secondary hover:bg-secondary/80",
          )}
          aria-label={`Choose ${emoji} avatar`}
          aria-pressed={value === emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
