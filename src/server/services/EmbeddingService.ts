import { pipeline, type Pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { logger } from '../utils/logger';

export interface ScoredMatch {
  text: string;
  score: number;
  index: number;
}

export class EmbeddingService {
  private pipeline: FeatureExtractionPipeline | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  /**
   * Lazy-load the embedding model on first use
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

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

      this.pipeline = await pipeline('feature-extraction', this.modelName, {
        // Use quantized model for faster loading and inference
        quantized: true,
      }) as FeatureExtractionPipeline;

      this.initialized = true;
      const duration = Date.now() - startTime;
      logger.info(`Embedding model loaded in ${duration}ms`);
    } catch (error) {
      logger.error('Failed to load embedding model:', error);
      throw error;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate embedding for a single text
   * Returns a normalized 384-dimensional vector
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to regular array
    return Array.from(output.data as Float32Array);
  }

  /**
   * Generate embeddings for multiple texts (batched for efficiency)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    const results: number[][] = [];

    // Process in batches to avoid memory issues
    const batchSize = 32;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Process batch
      for (const text of batch) {
        const output = await this.pipeline(text, {
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
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK?: number
  ): Promise<ScoredMatch[]> {
    if (candidates.length === 0) return [];

    // Generate embeddings
    const queryEmbedding = await this.embed(query);
    const candidateEmbeddings = await this.embedBatch(candidates);

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
   */
  async similarity(text1: string, text2: string): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
      this.embed(text1),
      this.embed(text2),
    ]);

    // Convert from [-1, 1] to [0, 1] range
    const rawSimilarity = this.cosineSimilarity(embedding1, embedding2);
    return (rawSimilarity + 1) / 2;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
