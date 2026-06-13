import { useEffect } from "react";

/**
 * Blink's iframe overlay uses max z-index. When Blink routes a tx through the
 * Privy embedded wallet, the Privy approval modal can sit underneath and the
 * flow hangs on "Processing deposit".
 */
export function BlinkOverlayUnlock() {
  useEffect(() => {
    const softenBlinkOverlay = () => {
      const blinkOverlay = document.querySelector("[data-blink-overlay]:not([data-blink-closing])");
      if (!blinkOverlay) return;

      const privyUi = document.querySelector(
        "#privy-dialog, #privy-modal-content, [data-privy-root], [id^='privy-']",
      );
      if (!privyUi) return;

      blinkOverlay.style.pointerEvents = "none";
      blinkOverlay.style.opacity = "0.15";
    };

    const restoreBlinkOverlay = () => {
      const blinkOverlay = document.querySelector("[data-blink-overlay]:not([data-blink-closing])");
      if (!blinkOverlay) return;
      blinkOverlay.style.pointerEvents = "";
      blinkOverlay.style.opacity = "";
    };

    const observer = new MutationObserver(() => {
      const privyUi = document.querySelector(
        "#privy-dialog, #privy-modal-content, [data-privy-root], [id^='privy-']",
      );
      if (privyUi) softenBlinkOverlay();
      else restoreBlinkOverlay();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    softenBlinkOverlay();

    return () => {
      observer.disconnect();
      restoreBlinkOverlay();
    };
  }, []);

  return null;
}
