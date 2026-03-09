// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const FIXED_TIMESTAMP = '20260101120000';
const spawnMock = jest.fn(async (_command: string, args: string[]) => {
  const outputIndex = args.indexOf('--output');
  const outputTemplate = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  if (args.includes('--list-subs')) {
    return 'Language formats';
  }

  if (args.includes('--write-sub')) {
    if (outputTemplate) {
      fs.writeFileSync(path.join(path.dirname(outputTemplate), 'subtitle.en.vtt'), 'WEBVTT\n\nmock subtitle');
    }
    return '';
  }

  if (args.includes('--write-subs')) {
    if (outputTemplate) {
      fs.writeFileSync(
        path.join(path.dirname(outputTemplate), 'transcript.en.srt'),
        '1\n00:00:01,000 --> 00:00:02,000\nhello world\n'
      );
    }
    return '';
  }

  if (args.includes('--dump-json') && args.includes('--write-comments')) {
    return JSON.stringify({ comments: [{ id: '1', text: 'great video' }] });
  }

  if (args.includes('--dump-json')) {
    return JSON.stringify({ id: 'abc123', title: 'mock video' });
  }

  if (args.some((arg) => arg?.startsWith('ytsearch') || arg?.includes('search_query='))) {
    return 'Mock title\nmockId\nMock uploader\n10:00';
  }

  if (args.includes('--get-filename')) {
    return '/tmp/mock-video.mp4';
  }

  if (args.includes('--no-check-certificate') && outputTemplate) {
    fs.writeFileSync(path.join(path.dirname(outputTemplate), `audio-${FIXED_TIMESTAMP}.m4a`), 'mock audio');
  }

  return '';
});

jest.unstable_mockModule('../modules/utils.js', () => ({
  _spawnPromise: spawnMock,
  validateUrl: () => true,
  getFormattedTimestamp: () => FIXED_TIMESTAMP,
  isYouTubeUrl: () => true,
  generateRandomFilename: () => 'random.mp4',
  cleanSubtitleToTranscript: (content: string) => content.replace(/\s+/g, ' ').trim()
}));

describe('Cookie args support across src/modules', () => {
  let tempDir: string;
  let cookieFile: string;
  let config: any;

  let searchVideos: any;
  let getVideoMetadata: any;
  let getVideoComments: any;
  let listSubtitles: any;
  let downloadSubtitles: any;
  let downloadTranscript: any;
  let downloadAudio: any;
  let downloadVideo: any;

  beforeAll(async () => {
    ({ searchVideos } = await import('../modules/search.js'));
    ({ getVideoMetadata } = await import('../modules/metadata.js'));
    ({ getVideoComments } = await import('../modules/comments.js'));
    ({ listSubtitles, downloadSubtitles, downloadTranscript } = await import('../modules/subtitle.js'));
    ({ downloadAudio } = await import('../modules/audio.js'));
    ({ downloadVideo } = await import('../modules/video.js'));

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookies-modules-test-'));
    cookieFile = path.join(tempDir, 'cookies.txt');
    fs.writeFileSync(cookieFile, '# Netscape HTTP Cookie File\n');

    config = {
      file: {
        downloadsDir: tempDir,
        tempDirPrefix: 'ytdlp-test-',
        maxFilenameLength: 50,
        sanitize: {
          replaceChar: '_',
          truncateSuffix: '...',
          illegalChars: /[<>:"/\\|?*\x00-\x1F]/g,
          reservedNames: []
        }
      },
      download: {
        defaultResolution: '720p',
        defaultAudioFormat: 'm4a',
        defaultSubtitleLanguage: 'en'
      },
      limits: {
        characterLimit: 25000,
        maxTranscriptLength: 50000
      },
      tools: {
        required: ['yt-dlp']
      },
      cookies: {
        file: cookieFile
      }
    };
  });

  beforeEach(() => {
    spawnMock.mockClear();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('search module appends --cookies', async () => {
    await searchVideos('test', 1, 0, 'json', config);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain('--cookies');
    expect(args).toContain(cookieFile);
  });

  test('metadata module appends --cookies', async () => {
    await getVideoMetadata('https://www.youtube.com/watch?v=mock', ['id'], config);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain('--cookies');
    expect(args).toContain(cookieFile);
  });

  test('comments module appends --cookies', async () => {
    await getVideoComments('https://www.youtube.com/watch?v=mock', 5, 'top', config);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain('--cookies');
    expect(args).toContain(cookieFile);
  });

  test('subtitle module appends --cookies for all subtitle actions', async () => {
    await listSubtitles('https://www.youtube.com/watch?v=mock', config);
    await downloadSubtitles('https://www.youtube.com/watch?v=mock', 'en', config);
    await downloadTranscript('https://www.youtube.com/watch?v=mock', 'en', config);

    for (const call of spawnMock.mock.calls) {
      const args = call[1];
      expect(args).toContain('--cookies');
      expect(args).toContain(cookieFile);
    }
  });

  test('audio module appends --cookies', async () => {
    await downloadAudio('https://www.youtube.com/watch?v=mock', config);
    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain('--cookies');
    expect(args).toContain(cookieFile);
  });

  test('video module appends --cookies for filename and download steps', async () => {
    await downloadVideo('https://www.youtube.com/watch?v=mock', config, '720p');

    expect(spawnMock).toHaveBeenCalledTimes(2);
    for (const call of spawnMock.mock.calls) {
      const args = call[1];
      expect(args).toContain('--cookies');
      expect(args).toContain(cookieFile);
    }
  });
});
