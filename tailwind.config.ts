import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // UOTD brand palette — warm Filipino pantry vibes
        brand: {
          cream:   "#FAF3E0",   // background warmth
          rice:    "#F0E6C8",   // softer cream
          bark:    "#3B1F0E",   // deep dark brown (text)
          rust:    "#B94A1C",   // primary red-orange (CTA, accents)
          silog:   "#E07B3A",   // warm orange (hover)
          garlic:  "#F7F0DC",   // near-white
          smoke:   "#7A6652",   // muted mid-tone
          leaf:    "#4A7C59",   // green accent (healthy/diet)
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body:    ["'DM Sans'", "sans-serif"],
      },
      animation: {
        "fade-in":    "fadeIn 0.5s ease forwards",
        "slide-up":   "slideUp 0.5s ease forwards",
        "bounce-in":  "bounceIn 0.6s cubic-bezier(.36,.07,.19,.97) forwards",
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" },              to: { opacity: "1" } },
        slideUp:   { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        bounceIn:  { "0%": { transform: "scale(0.95)", opacity: "0" }, "60%": { transform: "scale(1.02)" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
    },
  },
  plugins: [],
};
export default config;
