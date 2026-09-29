import { APP_NAME, APP_TAGLINE } from "../lib/appMeta";

interface BrandWatermarkProps {
  /** Slightly more visible on share-friendly screens (session summary). */
  tone?: "subtle" | "share";
  className?: string;
}

export function BrandWatermark({ tone = "subtle", className = "" }: BrandWatermarkProps) {
  const classes = ["brand-watermark", tone === "share" ? "brand-watermark--share" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <footer className={classes}>
      <img
        src="/logo.png"
        alt=""
        className="brand-watermark__logo"
        width={28}
        height={28}
        decoding="async"
        aria-hidden="true"
      />
      <span className="brand-watermark__text">
        <span className="brand-watermark__name">{APP_NAME}</span>
        <span className="brand-watermark__tagline">{APP_TAGLINE}</span>
      </span>
    </footer>
  );
}
