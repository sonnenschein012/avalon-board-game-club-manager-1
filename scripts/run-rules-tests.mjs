import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const firebaseCli = join(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const projectJavaHome = join(projectRoot, '.demo-runtime', 'java-21');
const javaExecutableName = process.platform === 'win32' ? 'java.exe' : 'java';

function normalizeJavaHome(value) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

function supportsFirestoreEmulator(javaHome) {
  if (!javaHome) return false;
  const result = spawnSync(join(javaHome, 'bin', javaExecutableName), ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return false;
  const match = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.match(/version\s+"(?:1\.)?(\d+)/i);
  return Boolean(match && Number.parseInt(match[1], 10) >= 21);
}

const javaHomeCandidates = [normalizeJavaHome(process.env.JAVA_HOME), projectJavaHome];
const javaHome = javaHomeCandidates.find(supportsFirestoreEmulator);

if (!existsSync(firebaseCli)) {
  console.error('Firebase CLI를 찾을 수 없습니다. 먼저 `npm install`을 실행해 주세요.');
  process.exitCode = 1;
} else if (!javaHome) {
  console.error('Java 21 이상을 찾을 수 없습니다. 먼저 `npm run demo:setup`을 실행해 주세요.');
  process.exitCode = 1;
} else {
  const javaBin = join(javaHome, 'bin');
  const result = spawnSync(process.execPath, [
    firebaseCli,
    'emulators:exec',
    '--only',
    'firestore',
    '--project',
    'test-project-1234',
    'vitest run --exclude .codex-deploy-audit-*/** src/tests/firestore.rules.test.ts',
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      PATH: process.env.PATH ? `${javaBin}${delimiter}${process.env.PATH}` : javaBin,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) console.error(`Failed to run Firestore rules tests: ${result.error.message}`);
  process.exitCode = result.error ? 1 : (result.status ?? 1);
}
