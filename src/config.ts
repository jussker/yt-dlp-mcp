import * as os from "os";
import * as path from "path";
import * as fs from "fs";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Valid browser names for cookie extraction
 */
export const VALID_BROWSERS = [
  'brave', 'chrome', 'chromium', 'edge',
  'firefox', 'opera', 'safari', 'vivaldi', 'whale'
] as const;

export type ValidBrowser = typeof VALID_BROWSERS[number];

/**
 * Configuration type definitions
 */
export interface Config {
  // File-related configuration
  file: {
    maxFilenameLength: number;
    downloadsDir: string;
    storageRoot?: string;
    tempDirPrefix: string;
    // Filename processing configuration
    sanitize: {
      // Character to replace illegal characters
      replaceChar: string;
      // Suffix when truncating filenames
      truncateSuffix: string;
      // Regular expression for illegal characters
      illegalChars: RegExp;
      // List of reserved names
      reservedNames: readonly string[];
    };
  };
  // Tool-related configuration
  tools: {
    required: readonly string[];
  };
  // Download-related configuration
  download: {
    defaultResolution: "480p" | "720p" | "1080p" | "best";
    defaultAudioFormat: "m4a" | "mp3";
    defaultSubtitleLanguage: string;
  };
  // Response limits
  limits: {
    characterLimit: number;
    maxTranscriptLength: number;
  };
  // Cookie configuration for authenticated access
  cookies: {
    // Path to Netscape format cookie file
    file?: string;
    // Browser name and settings (format: BROWSER[:PROFILE][::CONTAINER])
    fromBrowser?: string;
  };
}

/**
 * Default configuration
 */
const defaultConfig: Config = {
  file: {
    maxFilenameLength: 50,
    downloadsDir: path.join(os.homedir(), "Downloads"),
    tempDirPrefix: "ytdlp-",
    sanitize: {
      replaceChar: '_',
      truncateSuffix: '...',
      illegalChars: /[<>:"/\\|?*\x00-\x1F]/g,  // Windows illegal characters
      reservedNames: [
        'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
        'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2',
        'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
      ]
    }
  },
  tools: {
    required: ['yt-dlp']
  },
  download: {
    defaultResolution: "720p",
    defaultAudioFormat: "m4a",
    defaultSubtitleLanguage: "en"
  },
  limits: {
    characterLimit: 25000,      // Standard MCP character limit
    maxTranscriptLength: 50000  // Transcripts can be larger
  },
  cookies: {
    file: undefined,
    fromBrowser: undefined
  }
};

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): DeepPartial<Config> {
  const envConfig: DeepPartial<Config> = {};

  // File configuration
  const fileConfig: DeepPartial<Config['file']> = {
    sanitize: {
      replaceChar: (() => {
        const val = process.env.YTDLP_SANITIZE_REPLACE_CHAR;
        if (!val) return undefined;
        // Must be a single character that is not a path separator or null byte
        if (val.length !== 1 || /[\/\\:\x00]/.test(val)) {
          console.warn('[yt-dlp-mcp] Invalid YTDLP_SANITIZE_REPLACE_CHAR (must be a single safe character), using default');
          return undefined;
        }
        return val;
      })(),
      truncateSuffix: process.env.YTDLP_SANITIZE_TRUNCATE_SUFFIX,
      illegalChars: (() => {
        if (!process.env.YTDLP_SANITIZE_ILLEGAL_CHARS) return undefined;
        try {
          return new RegExp(process.env.YTDLP_SANITIZE_ILLEGAL_CHARS);
        } catch {
          console.warn('[yt-dlp-mcp] Invalid regex in YTDLP_SANITIZE_ILLEGAL_CHARS, using default');
          return undefined;
        }
      })(),
      reservedNames: process.env.YTDLP_SANITIZE_RESERVED_NAMES?.split(',')
    }
  };

  if (process.env.YTDLP_MAX_FILENAME_LENGTH) {
    const parsed = parseInt(process.env.YTDLP_MAX_FILENAME_LENGTH, 10);
    if (!isNaN(parsed) && parsed >= 5) {
      fileConfig.maxFilenameLength = parsed;
    } else {
      console.warn('[yt-dlp-mcp] Invalid YTDLP_MAX_FILENAME_LENGTH, using default');
    }
  }
  if (process.env.YTDLP_DOWNLOADS_DIR) {
    fileConfig.downloadsDir = process.env.YTDLP_DOWNLOADS_DIR;
  }
  if (process.env.YTDLP_STORAGE_ROOT) {
    const storageRoot = process.env.YTDLP_STORAGE_ROOT;
    if (storageRoot.includes('\x00')) {
      console.warn('[yt-dlp-mcp] Invalid YTDLP_STORAGE_ROOT (must not contain null byte), using default');
    } else {
      fileConfig.storageRoot = path.resolve(storageRoot);
    }
  }
  if (process.env.YTDLP_TEMP_DIR_PREFIX) {
    const prefix = process.env.YTDLP_TEMP_DIR_PREFIX;
    // Prevent path traversal: prefix must not contain path separators or null bytes
    if (/[\/\\\x00]/.test(prefix)) {
      console.warn('[yt-dlp-mcp] Invalid YTDLP_TEMP_DIR_PREFIX (must not contain path separators), using default');
    } else {
      fileConfig.tempDirPrefix = prefix;
    }
  }

  if (Object.keys(fileConfig).length > 0) {
    envConfig.file = fileConfig;
  }

  // Download configuration
  const downloadConfig: Partial<Config['download']> = {};
  if (process.env.YTDLP_DEFAULT_RESOLUTION && 
      ['480p', '720p', '1080p', 'best'].includes(process.env.YTDLP_DEFAULT_RESOLUTION)) {
    downloadConfig.defaultResolution = process.env.YTDLP_DEFAULT_RESOLUTION as Config['download']['defaultResolution'];
  }
  if (process.env.YTDLP_DEFAULT_AUDIO_FORMAT && 
      ['m4a', 'mp3'].includes(process.env.YTDLP_DEFAULT_AUDIO_FORMAT)) {
    downloadConfig.defaultAudioFormat = process.env.YTDLP_DEFAULT_AUDIO_FORMAT as Config['download']['defaultAudioFormat'];
  }
  if (process.env.YTDLP_DEFAULT_SUBTITLE_LANG) {
    downloadConfig.defaultSubtitleLanguage = process.env.YTDLP_DEFAULT_SUBTITLE_LANG;
  }
  if (Object.keys(downloadConfig).length > 0) {
    envConfig.download = downloadConfig;
  }

  // Cookie configuration
  const cookiesConfig: Partial<Config['cookies']> = {};
  if (process.env.YTDLP_COOKIES_FILE) {
    cookiesConfig.file = process.env.YTDLP_COOKIES_FILE;
  }
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
    cookiesConfig.fromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER;
  }
  if (Object.keys(cookiesConfig).length > 0) {
    envConfig.cookies = cookiesConfig;
  }

  return envConfig;
}

/**
 * Validate configuration
 */
function validateConfig(config: Config): void {
  // Validate filename length
  if (config.file.maxFilenameLength < 5) {
    throw new Error('maxFilenameLength must be at least 5');
  }

  // Validate downloads directory
  if (!config.file.downloadsDir) {
    throw new Error('downloadsDir must be specified');
  }
  if (config.file.storageRoot && !path.isAbsolute(config.file.storageRoot)) {
    throw new Error('storageRoot must be an absolute path');
  }

  // Validate temporary directory prefix
  if (!config.file.tempDirPrefix) {
    throw new Error('tempDirPrefix must be specified');
  }

  // Validate default resolution
  if (!['480p', '720p', '1080p', 'best'].includes(config.download.defaultResolution)) {
    throw new Error('Invalid defaultResolution');
  }

  // Validate default audio format
  if (!['m4a', 'mp3'].includes(config.download.defaultAudioFormat)) {
    throw new Error('Invalid defaultAudioFormat');
  }

  // Validate default subtitle language
  if (!/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/i.test(config.download.defaultSubtitleLanguage)) {
    throw new Error('Invalid defaultSubtitleLanguage');
  }

  // Validate cookies (lenient - warnings only)
  validateCookiesConfig(config);
}

/**
 * Validate cookie configuration (lenient - logs warnings but doesn't throw)
 */
function validateCookiesConfig(config: Config): void {
  // Validate cookie file path
  if (config.cookies.file) {
    if (!fs.existsSync(config.cookies.file)) {
      console.warn(`[yt-dlp-mcp] Cookie file not found: ${config.cookies.file}, continuing without cookies`);
      config.cookies.file = undefined;
    }
  }

  // Validate browser name only
  // Format: BROWSER[:PROFILE_OR_PATH][::CONTAINER]
  // We only validate browser name; yt-dlp will validate path/container
  if (config.cookies.fromBrowser) {
    const browserName = config.cookies.fromBrowser.split(':')[0].toLowerCase();

    if (!VALID_BROWSERS.includes(browserName as ValidBrowser)) {
      console.warn(`[yt-dlp-mcp] Invalid browser name: ${browserName}. Valid browsers: ${VALID_BROWSERS.join(', ')}`);
      config.cookies.fromBrowser = undefined;
    }
  }
}

/**
 * Merge configuration
 */
function mergeConfig(base: Config, override: DeepPartial<Config>): Config {
  return {
    file: {
      maxFilenameLength: override.file?.maxFilenameLength || base.file.maxFilenameLength,
      downloadsDir: override.file?.downloadsDir || base.file.downloadsDir,
      storageRoot: override.file?.storageRoot ?? base.file.storageRoot,
      tempDirPrefix: override.file?.tempDirPrefix || base.file.tempDirPrefix,
      sanitize: {
        replaceChar: override.file?.sanitize?.replaceChar || base.file.sanitize.replaceChar,
        truncateSuffix: override.file?.sanitize?.truncateSuffix || base.file.sanitize.truncateSuffix,
        illegalChars: (override.file?.sanitize?.illegalChars || base.file.sanitize.illegalChars) as RegExp,
        reservedNames: (override.file?.sanitize?.reservedNames || base.file.sanitize.reservedNames) as readonly string[]
      }
    },
    tools: {
      required: (override.tools?.required || base.tools.required) as readonly string[]
    },
    download: {
      defaultResolution: override.download?.defaultResolution || base.download.defaultResolution,
      defaultAudioFormat: override.download?.defaultAudioFormat || base.download.defaultAudioFormat,
      defaultSubtitleLanguage: override.download?.defaultSubtitleLanguage || base.download.defaultSubtitleLanguage
    },
    limits: {
      characterLimit: override.limits?.characterLimit || base.limits.characterLimit,
      maxTranscriptLength: override.limits?.maxTranscriptLength || base.limits.maxTranscriptLength
    },
    cookies: {
      file: override.cookies?.file ?? base.cookies.file,
      fromBrowser: override.cookies?.fromBrowser ?? base.cookies.fromBrowser
    }
  };
}

/**
 * Load configuration
 */
export function loadConfig(): Config {
  const envConfig = loadEnvConfig();
  const config = mergeConfig(defaultConfig, envConfig);
  validateConfig(config);
  return config;
}

/**
 * Safe filename processing function
 */
export function sanitizeFilename(filename: string, config: Config['file']): string {
  // Remove illegal characters
  let safe = filename.replace(config.sanitize.illegalChars, config.sanitize.replaceChar);
  
  // Check reserved names
  const basename = path.parse(safe).name.toUpperCase();
  if (config.sanitize.reservedNames.includes(basename)) {
    safe = `_${safe}`;
  }
  
  // Handle length limitation
  if (safe.length > config.maxFilenameLength) {
    const ext = path.extname(safe);
    const name = safe.slice(0, config.maxFilenameLength - ext.length - config.sanitize.truncateSuffix.length);
    safe = `${name}${config.sanitize.truncateSuffix}${ext}`;
  }
  
  return safe;
}

function sanitizePathSegment(value: string, fallback: string): string {
  const trimmed = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return trimmed || fallback;
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function extractPlatformFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostMatches(hostname, 'youtu.be') || hostMatches(hostname, 'youtube.com')) return 'youtube';
    if (hostMatches(hostname, 'bilibili.com')) return 'bilibili';
    if (hostMatches(hostname, 'tiktok.com')) return 'tiktok';
    if (hostMatches(hostname, 'x.com') || hostMatches(hostname, 'twitter.com')) return 'twitter';
    if (hostMatches(hostname, 'instagram.com')) return 'instagram';
    if (hostMatches(hostname, 'vimeo.com')) return 'vimeo';
    if (hostMatches(hostname, 'facebook.com') || hostMatches(hostname, 'fb.watch')) return 'facebook';
    if (hostMatches(hostname, 'twitch.tv')) return 'twitch';

    const compactHost = hostname.replace(/^(www|m)\./, '');
    return sanitizePathSegment(compactHost.split('.')[0] || compactHost, 'unknown');
  } catch {
    return 'unknown';
  }
}

export function extractVideoIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const knownParamKeys = ['v', 'id', 'video_id', 'item_id'];
    for (const key of knownParamKeys) {
      const value = params.get(key);
      if (value) return sanitizePathSegment(value, 'video');
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname.includes('youtu.be') && segments[0]) {
      return sanitizePathSegment(segments[0], 'video');
    }
    if (segments.length > 0) {
      return sanitizePathSegment(segments[segments.length - 1], 'video');
    }
  } catch {
    // noop
  }
  return 'video';
}

function getDatePartition(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function resolveStorageVideoDir(url: string, config: Config): string {
  if (!config.file.storageRoot) {
    fs.mkdirSync(config.file.downloadsDir, { recursive: true });
    return config.file.downloadsDir;
  }

  const platform = extractPlatformFromUrl(url);
  const datePartition = getDatePartition();
  const videoId = extractVideoIdFromUrl(url);
  const targetDir = path.join(config.file.storageRoot, `${platform}__${datePartition}`, videoId);
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

/**
 * Get cookie-related yt-dlp arguments
 * Priority: file > fromBrowser
 * @param config Configuration object
 * @returns Array of yt-dlp arguments for cookie handling
 */
export function getCookieArgs(config: Config): string[] {
  // Guard against missing cookies config
  if (!config.cookies) {
    return [];
  }
  // Cookie file takes precedence over browser extraction
  if (config.cookies.file) {
    return ['--cookies', config.cookies.file];
  }
  if (config.cookies.fromBrowser) {
    return ['--cookies-from-browser', config.cookies.fromBrowser];
  }
  return [];
}

// Export current configuration instance
export const CONFIG = loadConfig(); 
