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
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        "bs-green": "rgb(var(--bs-green-rgb) / <alpha-value>)",
        "bs-green-dark": "rgb(var(--bs-green-dark-rgb) / <alpha-value>)",
        "bs-red": "rgb(var(--bs-red-rgb) / <alpha-value>)",
        "bs-red-dark": "rgb(var(--bs-red-dark-rgb) / <alpha-value>)",
        "bs-purple": "rgb(var(--bs-purple-rgb) / <alpha-value>)",
        "bs-purple-dark": "rgb(var(--bs-purple-dark-rgb) / <alpha-value>)",
        "bs-card": "rgb(var(--bs-card-rgb) / <alpha-value>)",
        "bs-card-hover": "rgb(var(--bs-card-hover-rgb) / <alpha-value>)",
        "bs-border": "rgb(var(--bs-border-rgb) / <alpha-value>)",
        "bs-muted": "rgb(var(--bs-muted-rgb) / <alpha-value>)",
        "bs-input": "rgb(var(--bs-input-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
export default config;
