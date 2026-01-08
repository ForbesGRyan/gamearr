/**
 * Path security utilities to prevent path traversal attacks
 * Validates that file paths stay within allowed directories
 */

import * as path from 'path';
import { PathTraversalError } from './errors';
import { logger } from './logger';

/**
 * Normalize a path for consistent comparison across platforms
 * Resolves to absolute path and normalizes separators
 */
export function normalizePath(inputPath: string): string {
  return path.resolve(inputPath);
}

/**
 * Check if a path is safely contained within a base directory
 * Returns true if the resolved path starts with the resolved base path
 */
export function isPathWithinBase(targetPath: string, basePath: string): boolean {
  const resolvedTarget = normalizePath(targetPath);
  const resolvedBase = normalizePath(basePath);

  // Ensure base path ends with separator for proper prefix matching
  const baseWithSep = resolvedBase.endsWith(path.sep)
    ? resolvedBase
    : resolvedBase + path.sep;

  // Check if target is exactly the base or starts with base + separator
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(baseWithSep);
}

/**
 * Validate that a path is within the allowed base directory
 * Throws PathTraversalError if the path escapes the base
 */
export function validatePathWithinBase(
  targetPath: string,
  basePath: string,
  context: string = 'file operation'
): void {
  if (!isPathWithinBase(targetPath, basePath)) {
    const resolvedTarget = normalizePath(targetPath);
    const resolvedBase = normalizePath(basePath);

    logger.warn(
      `Path traversal attempt detected in ${context}: ` +
        `target="${resolvedTarget}" is outside base="${resolvedBase}"`
    );

    throw new PathTraversalError(
      `Access denied: path is outside the allowed directory`
    );
  }
}

/**
 * Safely join paths and validate the result stays within base directory
 * Returns the joined path if safe, throws PathTraversalError otherwise
 */
export function safeJoinPath(basePath: string, ...segments: string[]): string {
  const joinedPath = path.join(basePath, ...segments);
  validatePathWithinBase(joinedPath, basePath, 'path join');
  return joinedPath;
}

/**
 * Check for common path traversal patterns in user input
 * Returns true if suspicious patterns are detected
 */
export function containsTraversalPatterns(input: string): boolean {
  // Check for common traversal patterns
  const traversalPatterns = [
    /\.\./,           // Parent directory reference
    /^\//, // Unix absolute path (when expecting relative)
    /^[a-zA-Z]:/,     // Windows absolute path (when expecting relative)
    /%2e%2e/i,        // URL-encoded ..
    /%252e%252e/i,    // Double URL-encoded ..
    /\0/,             // Null byte injection
  ];

  return traversalPatterns.some((pattern) => pattern.test(input));
}
