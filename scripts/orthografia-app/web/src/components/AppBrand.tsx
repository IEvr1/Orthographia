import { APP_NAME, APP_TAGLINE } from "../lib/appMeta";

interface AppBrandProps {
  size?: "default" | "sm";
  className?: string;
}

export function AppBrand({ size = "default", className = "" }: AppBrandProps) {
  const classes = ["app-brand", size === "sm" ? "app-brand--sm" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <img
        src="/logo.png"
        alt={`${APP_NAME} — ${APP_TAGLINE}`}
        className="app-brand__logo"
        decoding="async"
      />
    </div>
  );
}
