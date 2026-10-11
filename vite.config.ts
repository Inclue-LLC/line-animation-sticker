import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages ではリポジトリ名のサブパスで配信されるため、BASE_PATH で上書きできるようにする
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
