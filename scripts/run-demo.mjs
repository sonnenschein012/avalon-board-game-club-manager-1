import { runEmulators } from './emulator-runtime.mjs';

runEmulators({
  projectId: 'demo-avalon-manager',
  services: 'auth,firestore',
  config: 'firebase.demo.json',
  command: 'npm run demo:serve',
});
