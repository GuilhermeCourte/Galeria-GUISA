import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Força a porta 5173 para bater com a configuração do Google Cloud
    strictPort: true, // Se a porta estiver ocupada, ele avisa em vez de mudar para 5174
  }
})