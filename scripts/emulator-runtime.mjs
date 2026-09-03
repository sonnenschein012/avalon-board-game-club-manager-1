import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const firebaseCli = join(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const javaExecutableName = process.platform === 'win32' ? 'java.exe' : 'java';

function normalizeJavaHome(value) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

function findJava() {
  const candidates = [
    normalizeJavaHome(process.env.JAVA_HOME),
    join(projectRoot, '.demo-runtime', 'java-21'),
  ];
  for (const home of candidates) {
    if (!home) continue;
    const result = spawnSync(join(home, 'bin', javaExecutableName), ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.error || result.status !== 0) continue;
    const match = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.match(/version\s+"(?:1\.)?(\d+)/i);
    const major = match ? Number.parseInt(match[1], 10) : 0;
    if (major >= 21) return { home, major };
  }
  return null;
}

/** Shared Java/CLI startup for the two local Firebase emulator workflows. */
export function runEmulators({ projectId, services, config, command }) {
  if (!existsSync(firebaseCli)) {
    console.error('Firebase CLI를 찾을 수 없습니다. 먼저 `npm install`을 실행해 주세요.');
    process.exitCode = 1;
    return;
  }
  const java = findJava();
  if (!java) {
    console.error('Java 21 이상을 찾을 수 없습니다. 먼저 `npm run demo:setup`을 실행해 주세요.');
    process.exitCode = 1;
    return;
  }

  console.log(`Using Java ${java.major}: ${java.home}`);
  const javaBin = join(java.home, 'bin');
  const result = spawnSync(process.execPath, [
    firebaseCli,
    'emulators:exec',
    '--only', services,
    '--project', projectId,
    ...(config ? ['--config', config] : []),
    command,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      JAVA_HOME: java.home,
      PATH: process.env.PATH ? `${javaBin}${delimiter}${process.env.PATH}` : javaBin,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) console.error(`Failed to run Firebase emulators: ${result.error.message}`);
  process.exitCode = result.error ? 1 : (result.status ?? 1);
}
