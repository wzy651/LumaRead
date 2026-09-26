import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

interface BuildInfo {
  version: string
  commit: string
  mode: string
}

function getBuildInfo(mode: string): BuildInfo {
  const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  let commit = 'unknown'

  try {
    commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim() || commit
  } catch {
    // Source archives and installed packages may not include Git metadata.
  }

  return { version: packageJson.version, commit, mode }
}

export default defineConfig(({ mode }) => ({
  define: {
    __LUMAREAD_BUILD__: JSON.stringify(getBuildInfo(mode)),
  },
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/.local-cache/**',
        '**/.local-backups/**',
        '**/.qa-artifacts/**',
        '**/src-tauri/target/**',
        '**/src-tauri/gen/android/**/.gradle/**',
        '**/src-tauri/gen/android/**/build/**',
      ],
    },
  },
}))
