import { describe } from '@jest/globals';
import { spawnSync } from 'child_process';

export const hasYtDlp = (() => {
  const result = spawnSync('yt-dlp', ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
})();

export const describeIfYtDlp = hasYtDlp ? describe : describe.skip;
