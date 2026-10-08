/** Public site URL used in canonical links, sitemap, and structured data. */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, "") || "https://ortholexo.gr"
) as string;

/** Latin transliteration — helps match queries like "ortholexo" without the .gr TLD. */
export const APP_ROMAN_NAME = "Ortholexo";

export const SITE_HOST = "ortholexo.gr";
