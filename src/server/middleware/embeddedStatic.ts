import type { Context, Next } from 'hono';
import { logger } from '../utils/logger';

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.map': 'application/json',
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// VFS type from make-vfs
interface VirtualFileSystem {
  [path: string]: string;
}

/**
 * Create middleware to serve embedded static files from a virtual filesystem
 */
export function createEmbeddedStaticMiddleware(vfs: VirtualFileSystem) {
  return async (c: Context, next: Next) => {
    let path = c.req.path;

    // Remove leading slash for VFS lookup
    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    // Default to index.html for root or directories
    if (path === '' || path.endsWith('/')) {
      path = path + 'index.html';
    }

    // Try to find the file in VFS
    let content = vfs[path];

    // For SPA: if not found and not an asset, serve index.html
    if (!content && !path.includes('.')) {
      content = vfs['index.html'];
      path = 'index.html';
    }

    if (content) {
      const mimeType = getMimeType(path);

      // Check if content is base64 encoded (binary files)
      const isBinary = !mimeType.includes('text') &&
                       !mimeType.includes('javascript') &&
                       !mimeType.includes('json') &&
                       !mimeType.includes('xml') &&
                       !mimeType.includes('svg');

      if (isBinary) {
        // Decode base64 for binary files
        try {
          const binary = Uint8Array.from(atob(content), c => c.charCodeAt(0));
          return new Response(binary, {
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': path.includes('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
            },
          });
        } catch (error) {
          logger.error(`Failed to decode binary file: ${path}`, error);
          await next();
          return;
        }
      }

      return new Response(content, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': path.includes('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        },
      });
    }

    // File not found in VFS, pass to next handler
    logger.debug(`Static file not found in VFS: ${c.req.path}`);
    await next();
  };
}
