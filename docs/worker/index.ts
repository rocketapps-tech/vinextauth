/**
 * Cloudflare Worker entry point for VinextAuth docs.
 * Handles image optimization via Cloudflare Images binding,
 * then delegates all other requests to the vinext App Router handler.
 */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from 'vinext/server/image-optimization';
import type { ImageConfig } from 'vinext/server/image-optimization';
import handler from 'vinext/server/app-router-entry';

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const imageConfig: ImageConfig = {
  deviceSizes: DEFAULT_DEVICE_SIZES,
  imageSizes: DEFAULT_IMAGE_SIZES,
  formats: ['image/webp'],
  minimumCacheTTL: 60,
  qualities: [75],
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/_next/image')) {
      return (
        (await handleImageOptimization(request, env.IMAGES, imageConfig)) ??
        handler.fetch(request, env, ctx)
      );
    }

    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
