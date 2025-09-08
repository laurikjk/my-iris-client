export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        "theme-xl": "4px 20px 40px 1px var(--shadow-color)",
      },
      colors: {
        "custom-purple": "#34216c",
        "custom-violet": "#28246b",
        "custom-accent": "#db8216",
      },
      borderColor: {
        custom: "var(--border-color)",
      },
      borderWidth: {
        "b-px": "0 0 0.5px 0",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries"),
    require("daisyui")
  ],
  daisyui: {
    themes: [
      {
        dark: {
          primary: "#702ace",
          secondary: "#f87171",
          accent: "#db8216",
          neutral: "#2a3c5e",
          "base-100": "#1b1c48",
          "base-200": "#030918",
          "base-300": "#121212",
          info: "#3b82f6",
          success: "#10b981",
          warning: "#facc15",
          error: "#ef4444",
          "--shadow-color": "rgba(0, 0, 0, 0.8)",
          "--note-hover-color": "#040a1c",
          "--border-color": "rgba(255, 255, 255, 0.2)",
        },
      },
      {
        light: {
          primary: "#1d9bf0",
          secondary: "#536471",
          accent: "#1d9bf0",
          neutral: "#0f1419",
          "base-100": "#ffffff",
          "base-200": "#f7f9fa",
          "base-300": "#e1e8ed",
          info: "#1d9bf0",
          success: "#00ba7c",
          warning: "#ffad1f",
          error: "#f4212e",
          "--shadow-color": "rgba(0, 0, 0, 0.03)",
          "--note-hover-color": "#f7f9fa",
          "--border-color": "rgba(0, 0, 0, 0.08)",
        },
      },
      {
        iris: {
          primary: "#702ace",
          secondary: "#f87171",
          accent: "rgb(255, 113, 10)",
          neutral: "#2b2b2b",
          "base-100": "#1a1a1a",
          "base-200": "#000000",
          "base-300": "#1c1c1c",
          info: "rgb(172, 136, 255)",
          success: "rgb(30, 203, 225)",
          warning: "#facc15",
          error: "rgb(239, 68, 68)",
          "--shadow-color": "none",
          "--note-hover-color": "#0a0a0a",
          "base-content": "#ffffff",
          "--border-color": "rgba(255, 255, 255, 0.2)",
        },
      },
    ],
  },
  safelist: ["border-custom overflow-y-scroll"],
}
