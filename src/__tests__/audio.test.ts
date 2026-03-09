// @ts-nocheck
// @jest-environment node
import { describe, test, expect } from '@jest/globals';
import * as os from 'os';
import * as path from 'path';
import { downloadAudio } from '../modules/audio.js';
import { CONFIG } from '../config.js';
import * as fs from 'fs';
import { describeIfYtDlp } from '../test-utils.js';

describeIfYtDlp('downloadAudio', () => {
  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const testStorageRoot = path.join(os.tmpdir(), 'yt-dlp-test-storage');
  const testConfig = {
    ...CONFIG,
    file: {
      ...CONFIG.file,
      downloadsDir: path.join(os.tmpdir(), 'yt-dlp-test-downloads'),
      storageRoot: testStorageRoot,
      tempDirPrefix: 'yt-dlp-test-'
    }
  };

  const listFilesRecursively = async (dir: string): Promise<string[]> => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursively(fullPath);
      }
      return [fullPath];
    }));
    return files.flat();
  };

  beforeAll(async () => {
    await fs.promises.mkdir(testConfig.file.downloadsDir, { recursive: true });
    await fs.promises.mkdir(testStorageRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.promises.rm(testConfig.file.downloadsDir, { recursive: true, force: true });
    await fs.promises.rm(testStorageRoot, { recursive: true, force: true });
  });

  test('downloads audio successfully from YouTube', async () => {
    const result = await downloadAudio(testUrl, testConfig);
    expect(result).toContain('Audio successfully downloaded');
    expect(result).toContain(testStorageRoot);
    
    const files = await listFilesRecursively(testStorageRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.m4a$/);
  }, 30000);

  test('handles invalid URL', async () => {
    await expect(downloadAudio('invalid-url', testConfig))
      .rejects
      .toThrow();
  });
}); 
