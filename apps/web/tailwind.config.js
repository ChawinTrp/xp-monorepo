/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: "#1e1e1e", // Main editor background
          sidebar: "#181818", // Slightly darker sidebar
          accent: "#7a62cb", // Obsidian's classic purple highlight
          text: "#dcddde", // Soft white text
          muted: "#8b8b8b", // Secondary text
          border: "#2f2f2f", // Subtle dividers
          hover: "#2a2a2a", // Sidebar item hover state
        },
      },
    },
  },
  plugins: [],
};
