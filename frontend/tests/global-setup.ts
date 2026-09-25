import { execFileSync } from 'node:child_process';

export default function setup() {
  execFileSync('python', ['tests/build-government-fixture.py'], { stdio: 'pipe' });
}
