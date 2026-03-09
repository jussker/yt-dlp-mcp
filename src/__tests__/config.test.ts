// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Store original env
const originalEnv = { ...process.env };

describe('Cookie Configuration', () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clear module cache to reload config
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getCookieArgs', () => {
    test('returns empty array when no cookies configured', async () => {
      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);
      expect(args).toEqual([]);
    });

    test('returns --cookies args when file is configured', async () => {
      // Create a temporary cookie file
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-test-'));
      const cookieFile = path.join(tempDir, 'cookies.txt');
      fs.writeFileSync(cookieFile, '# Netscape HTTP Cookie File\n');

      process.env.YTDLP_COOKIES_FILE = cookieFile;

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies', cookieFile]);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('returns --cookies-from-browser args when browser is configured', async () => {
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies-from-browser', 'chrome']);
    });

    test('file takes precedence over browser', async () => {
      // Create a temporary cookie file
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-test-'));
      const cookieFile = path.join(tempDir, 'cookies.txt');
      fs.writeFileSync(cookieFile, '# Netscape HTTP Cookie File\n');

      process.env.YTDLP_COOKIES_FILE = cookieFile;
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies', cookieFile]);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('supports browser with profile', async () => {
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome:Profile 1';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies-from-browser', 'chrome:Profile 1']);
    });

    test('supports browser with container', async () => {
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'firefox::work';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies-from-browser', 'firefox::work']);
    });
  });

  describe('Cookie Validation', () => {
    test('clears invalid cookie file path with warning', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.YTDLP_COOKIES_FILE = '/nonexistent/path/cookies.txt';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.file).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cookie file not found')
      );

      consoleSpy.mockRestore();
    });

    test('accepts valid browser names', async () => {
      const validBrowsers = ['brave', 'chrome', 'chromium', 'edge', 'firefox', 'opera', 'safari', 'vivaldi', 'whale'];

      for (const browser of validBrowsers) {
        jest.resetModules();
        process.env = { ...originalEnv };
        process.env.YTDLP_COOKIES_FROM_BROWSER = browser;

        const { loadConfig } = await import('../config.js');
        const config = loadConfig();

        expect(config.cookies.fromBrowser).toBe(browser);
      }
    });

    test('clears invalid browser name with warning', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.YTDLP_COOKIES_FROM_BROWSER = 'invalidbrowser';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.fromBrowser).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid browser name')
      );

      consoleSpy.mockRestore();
    });

    test('accepts valid browser with custom path (Flatpak style)', async () => {
      // Path format is valid for Flatpak installations
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome:~/.var/app/com.google.Chrome/';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.fromBrowser).toBe('chrome:~/.var/app/com.google.Chrome/');
    });

    test('accepts valid browser with empty profile', async () => {
      // chrome: is valid (empty profile means default)
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome:';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.fromBrowser).toBe('chrome:');
    });
  });

  describe('VALID_BROWSERS constant', () => {
    test('exports valid browsers list', async () => {
      const { VALID_BROWSERS } = await import('../config.js');

      expect(VALID_BROWSERS).toContain('chrome');
      expect(VALID_BROWSERS).toContain('firefox');
      expect(VALID_BROWSERS).toContain('edge');
      expect(VALID_BROWSERS).toContain('safari');
      expect(VALID_BROWSERS.length).toBe(9);
    });
  });
});

describe('Security: Environment Variable Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('YTDLP_TEMP_DIR_PREFIX path traversal prevention', () => {
    test('rejects prefix with forward slash', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_TEMP_DIR_PREFIX = '../../evil-';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.tempDirPrefix).toBe('ytdlp-');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YTDLP_TEMP_DIR_PREFIX')
      );
      consoleSpy.mockRestore();
    });

    test('rejects prefix with backslash', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_TEMP_DIR_PREFIX = 'evil\\prefix-';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.tempDirPrefix).toBe('ytdlp-');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YTDLP_TEMP_DIR_PREFIX')
      );
      consoleSpy.mockRestore();
    });

    test('accepts safe prefix', async () => {
      process.env.YTDLP_TEMP_DIR_PREFIX = 'safe-prefix-';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.tempDirPrefix).toBe('safe-prefix-');
    });

    test('rejects prefix containing null byte', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_TEMP_DIR_PREFIX = 'evil\x00prefix-';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.tempDirPrefix).toBe('ytdlp-');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YTDLP_TEMP_DIR_PREFIX')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('YTDLP_SANITIZE_REPLACE_CHAR validation', () => {
    test('rejects multi-character replace char', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_SANITIZE_REPLACE_CHAR = '../';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.sanitize.replaceChar).toBe('_');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YTDLP_SANITIZE_REPLACE_CHAR')
      );
      consoleSpy.mockRestore();
    });

    test('rejects path separator as replace char', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_SANITIZE_REPLACE_CHAR = '/';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.sanitize.replaceChar).toBe('_');
      consoleSpy.mockRestore();
    });

    test('rejects backslash as replace char', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_SANITIZE_REPLACE_CHAR = '\\';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.sanitize.replaceChar).toBe('_');
      consoleSpy.mockRestore();
    });

    test('accepts safe single-character replace char', async () => {
      process.env.YTDLP_SANITIZE_REPLACE_CHAR = '-';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.sanitize.replaceChar).toBe('-');
    });

    test('rejects null byte as replace char', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.YTDLP_SANITIZE_REPLACE_CHAR = '\x00';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.file.sanitize.replaceChar).toBe('_');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('YTDLP_SANITIZE_REPLACE_CHAR')
      );
      consoleSpy.mockRestore();
    });
  });
});

describe('Security: URL Protocol Validation', () => {
  test('validateUrl rejects file:// URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('file:///etc/passwd')).toBe(false);
  });

  test('validateUrl rejects javascript: URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('javascript:alert(1)')).toBe(false);
  });

  test('validateUrl rejects ftp:// URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('ftp://example.com/file')).toBe(false);
  });

  test('validateUrl rejects data: URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  test('validateUrl accepts https:// URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe(true);
  });

  test('validateUrl accepts http:// URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('http://example.com/video')).toBe(true);
  });

  test('validateUrl rejects invalid URLs', async () => {
    const { validateUrl } = await import('../modules/utils.js');
    expect(validateUrl('not-a-url')).toBe(false);
    expect(validateUrl('')).toBe(false);
  });
});
