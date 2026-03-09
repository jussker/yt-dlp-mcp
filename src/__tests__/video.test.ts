// @ts-nocheck
// @jest-environment node
import { describe, test, expect } from '@jest/globals';
import * as os from 'os';
import * as path from 'path';
import { downloadVideo } from '../modules/video.js';
import { CONFIG } from '../config.js';
import * as fs from 'fs';
import { describeIfYtDlp } from '../test-utils.js';

// 設置 Python 環境
process.env.PYTHONPATH = '';
process.env.PYTHONHOME = '';

describeIfYtDlp('downloadVideo with trimming', () => {
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

  beforeEach(async () => {
    await fs.promises.mkdir(testConfig.file.downloadsDir, { recursive: true });
    await fs.promises.mkdir(testStorageRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(testConfig.file.downloadsDir, { recursive: true, force: true });
    await fs.promises.rm(testStorageRoot, { recursive: true, force: true });
  });

  test('downloads video with start time trimming', async () => {
    const result = await downloadVideo(testUrl, testConfig, '720p', '00:00:10');
    expect(result).toContain('Video successfully downloaded');
    expect(result).toContain(testStorageRoot);
    
    const files = await listFilesRecursively(testStorageRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.(mp4|webm|mkv)$/);
  }, 30000);

  test('downloads video with end time trimming', async () => {
    const result = await downloadVideo(testUrl, testConfig, '720p', undefined, '00:00:20');
    expect(result).toContain('Video successfully downloaded');
    
    const files = await listFilesRecursively(testStorageRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.(mp4|webm|mkv)$/);
  }, 30000);

  test('downloads video with both start and end time trimming', async () => {
    const result = await downloadVideo(testUrl, testConfig, '720p', '00:00:10', '00:00:20');
    expect(result).toContain('Video successfully downloaded');
    
    const files = await listFilesRecursively(testStorageRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.(mp4|webm|mkv)$/);
  }, 30000);

  test('downloads video without trimming when no times provided', async () => {
    const result = await downloadVideo(testUrl, testConfig, '720p');
    expect(result).toContain('Video successfully downloaded');
    
    const files = await listFilesRecursively(testStorageRoot);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\.(mp4|webm|mkv)$/);
  }, 30000);
});
