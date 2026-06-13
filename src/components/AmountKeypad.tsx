import { Delete } from "lucide-react";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

export function AmountKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const press = (k: (typeof keys)[number]) => {
    if (k === "back") return onChange(value.length <= 1 ? "0" : value.slice(0, -1));
    if (k === ".") {
      if (value.includes(".")) return;
      return onChange(value + ".");
    }
    // digit
    if (value === "0") return onChange(k);
    // limit to 2 decimals
    if (value.includes(".") && value.split(".")[1].length >= 2) return;
    onChange(value + k);
  };

  return (
    <div className="grid grid-cols-3 gap-1">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="flex h-14 items-center justify-center rounded-2xl text-2xl font-medium text-foreground transition-colors active:bg-secondary"
        >
          {k === "back" ? <Delete className="h-5 w-5" strokeWidth={1.75} /> : k}
        </button>
      ))}
    </div>
  );
}