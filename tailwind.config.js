/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          teal: '#00a884',
          dark: '#0b141a',
          sidebar: '#111b21',
          panel: '#202c33',
          input: '#1f2c34',
          incoming: '#202c33',
          outgoing: '#005c4b',
          blue: '#53bdeb',
          gray: '#8696a0',
          border: '#222e35',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Lucida Grande', 'Arial', 'Ubuntu', 'Cantarell', 'Fira Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
