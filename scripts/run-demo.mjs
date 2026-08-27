import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const bundledJavaHome = join(projectRoot, '.demo-runtime', 'java-21');
const firebaseCli = join(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const javaExecutableName = process.platform === 'win32' ? 'java.exe' : 'java';

function normalizeJavaHome(value) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed;
}

function inspectJava(home, source) {
  const executable = join(home, 'bin', javaExecutableName);
  const result = spawnSync(executable, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const match = output.match(/version\s+"(?:1\.)?(\d+)/i);
  const major = match ? Number.parseInt(match[1], 10) : Number.NaN;

  if (!Number.isInteger(major) || major < 21) {
    return null;
  }

  return { home, executable, major, source };
}

const candidates = [
  { home: normalizeJavaHome(process.env.JAVA_HOME), source: 'JAVA_HOME' },
  { home: bundledJavaHome, source: 'project runtime' },
];
const seenHomes = new Set();
let java = null;

for (const candidate of candidates) {
  if (!candidate.home) {
    continue;
  }

  const key = process.platform === 'win32'
    ? candidate.home.toLowerCase()
    : candidate.home;

  if (seenHomes.has(key)) {
    continue;
  }

  seenHomes.add(key);
  java = inspectJava(candidate.home, candidate.source);

  if (java) {
    break;
  }
}

if (!existsSync(firebaseCli)) {
  console.error('Firebase CLI를 찾을 수 없습니다. 먼저 `npm install`을 실행해 주세요.');
  process.exitCode = 1;
} else if (!java) {
  console.error('Java 21 이상을 찾을 수 없습니다. 먼저 `npm run demo:setup`을 실행해 주세요.');
  process.exitCode = 1;
} else {
  console.log(`Using Java ${java.major} from ${java.source}: ${java.home}`);

  const javaBin = join(java.home, 'bin');
  const childEnvironment = {
    ...process.env,
    JAVA_HOME: java.home,
    PATH: process.env.PATH ? `${javaBin}${delimiter}${process.env.PATH}` : javaBin,
  };
  const result = spawnSync(process.execPath, [
    firebaseCli,
    'emulators:exec',
    '--only',
    'auth,firestore',
    '--project',
    'demo-avalon-manager',
    '--config',
    'firebase.demo.json',
    'npm run demo:serve',
  ], {
    cwd: projectRoot,
    env: childEnvironment,
    stdio: 'inherit',
    windowsHide: false,
  });

  if (result.error) {
    console.error(`Failed to start the Firebase demo environment: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
