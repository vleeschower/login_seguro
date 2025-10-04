import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../localhost+1-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../localhost+1.pem'))
    },
    host: true,
    port: 5174
  }
})
