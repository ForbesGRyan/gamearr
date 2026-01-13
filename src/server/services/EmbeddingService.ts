import { logger } from '../utils/logger';

// Dynamic import type for transformers
type FeatureExtractionPipeline = any;

export interface ScoredMatch {
  text: string;
  score: number;
  index: number;
}

export class EmbeddingService {
  private pipelineInstance: FeatureExtractionPipeline | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private initializationFailed = false;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  /**
   * Lazy-load the embedding model on first use
   */
  async initialize(): Promise<void> {
    if (this.initialized || this.initializationFailed) return;

    // Allow disabling semantic search via environment variable
    if (process.env.DISABLE_SEMANTIC_SEARCH === 'true') {
      logger.info('Semantic search disabled via DISABLE_SEMANTIC_SEARCH environment variable');
      this.initializationFailed = true;
      return;
    }

    // If already initializing, wait for that to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      logger.info(`Loading embedding model: ${this.modelName}...`);
      const startTime = Date.now();

      // Dynamic import to prevent crashes in compiled binaries
      // The transformers library uses ONNX which may not be compatible with Bun compiled binaries
      let transformersModule: any;
      try {
        transformersModule = await import('@xenova/transformers');
      } catch (importError) {
        const importErrorMessage = importError instanceof Error ? importError.message : String(importError);
        if (importErrorMessage.includes('version') && importErrorMessage.includes('not supported')) {
          logger.warn('Semantic search unavailable: ONNX runtime incompatible with this build.');
        } else {
          logger.warn(`Failed to import transformers library: ${importErrorMessage}`);
        }
        this.initializationFailed = true;
        return;
      }

      this.pipelineInstance = await transformersModule.pipeline('feature-extraction', this.modelName, {
        // Use quantized model for faster loading and inference
        quantized: true,
      });

      this.initialized = true;
      const duration = Date.now() - startTime;
      logger.info(`Embedding model loaded in ${duration}ms`);
    } catch (error) {
      // Gracefully handle ONNX version incompatibility in compiled binaries
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('version') && errorMessage.includes('not supported')) {
        logger.warn('Semantic search unavailable: ONNX runtime incompatible with compiled binary. Falling back to standard search.');
      } else {
        logger.error('Failed to load embedding model:', error);
      }
      this.initializationFailed = true;
      // Don't throw - allow app to continue without semantic search
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if the service is available (initialized and not failed)
   */
  isAvailable(): boolean {
    return this.initialized && !this.initializationFailed;
  }

  /**
   * Generate embedding for a single text
   * Returns a normalized 384-dimensional vector, or null if service unavailable
   */
  async embed(text: string): Promise<number[] | null> {
    await this.initialize();

    if (!this.pipelineInstance || this.initializationFailed) {
      return null;
    }

    const output = await this.pipelineInstance(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to regular array
    return Array.from(output.data as Float32Array);
  }

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   * Returns empty array if service unavailable
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    await this.initialize();

    if (!this.pipelineInstance || this.initializationFailed) {
      return [];
    }

    const results: number[][] = [];

    // Process in batches to avoid memory issues
    const batchSize = 32;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Process batch
      for (const text of batch) {
        const output = await this.pipelineInstance(text, {
          pooling: 'mean',
          normalize: true,
        });
        results.push(Array.from(output.data as Float32Array));
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Find the most similar texts from a list of candidates
   * Returns candidates sorted by similarity score (highest first)
   * Returns empty array if service unavailable
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK?: number
  ): Promise<ScoredMatch[]> {
    if (candidates.length === 0) return [];

    // Generate embeddings
    const queryEmbedding = await this.embed(query);
    if (!queryEmbedding) return [];

    const candidateEmbeddings = await this.embedBatch(candidates);
    if (candidateEmbeddings.length === 0) return [];

    // Calculate similarities
    const scores: ScoredMatch[] = candidates.map((text, index) => ({
      text,
      score: this.cosineSimilarity(queryEmbedding, candidateEmbeddings[index]),
      index,
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return top K if specified
    if (topK !== undefined && topK > 0) {
      return scores.slice(0, topK);
    }

    return scores;
  }

  /**
   * Calculate similarity between two texts directly
   * Returns a value between 0 and 1 (1 = identical meaning)
   * Returns 0 if service unavailable
   */
  async similarity(text1: string, text2: string): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
      this.embed(text1),
      this.embed(text2),
    ]);

    if (!embedding1 || !embedding2) return 0;

    // Convert from [-1, 1] to [0, 1] range
    const rawSimilarity = this.cosineSimilarity(embedding1, embedding2);
    return (rawSimilarity + 1) / 2;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
