import { BACKGROUND_TRANSFORMER_ENGINE } from "../../Enum/EnvironmentVariable";
import { FallbackBackgroundTransformer } from "./FallbackBackgroundTransformer";

// NG Academy phase 9 (weak devices): the MediaPipe transformers pull in
// @mediapipe/tasks-vision / selfie_segmentation plus their wasm runtimes —
// megabytes that a school tablet must NOT download unless camera background
// effects are actually enabled. They are therefore loaded through dynamic
// import() only, which vite splits into separate on-demand chunks.

export type BackgroundMode = "none" | "blur" | "image" | "video";

export interface BackgroundConfig {
    mode: BackgroundMode;
    blurAmount?: number;
    backgroundImage?: string;
    backgroundVideo?: string;
}

export interface BackgroundTransformer {
    updateConfig(config: Partial<BackgroundConfig>): Promise<void>;
    getPerformanceStats(): unknown;
    close(): void;
    waitForInitialization(): Promise<void>;
    transform(inputStream: MediaStream, signal?: AbortSignal): Promise<MediaStream>;
    stop(): void;
}

export type BackgroundTransformerFailureHandler = (error: Error) => void;

/**
 * Create a MediaPipe-based background transformer with fallback support
 * Supports both the new Tasks Vision API (GPU-accelerated) and legacy Selfie Segmentation (CPU)
 * Selected via BACKGROUND_TRANSFORMER_ENGINE environment variable
 *
 * @param config Background configuration
 * @returns A MediaPipe transformer instance or fallback
 */
export async function createBackgroundTransformer(
    config: BackgroundConfig,
    onTerminalFailure?: BackgroundTransformerFailureHandler,
): Promise<BackgroundTransformer> {
    const engine = BACKGROUND_TRANSFORMER_ENGINE || "tasks-vision";
    console.info(`[BackgroundProcessor] Using transformer engine: ${engine}`);

    if (engine === "tasks-vision") {
        try {
            const { MediaPipeTasksVisionTransformer } = await import("./MediaPipeTasksVisionTransformer");
            const transformer = new MediaPipeTasksVisionTransformer(config, onTerminalFailure);
            return transformer;
        } catch (error) {
            console.error("[BackgroundTransformer] Failed to create Tasks Vision transformer, using fallback:", error);
            return new FallbackBackgroundTransformer();
        }
    }

    // Use selfie-segmentation API (legacy) when engine is not "tasks-vision"
    // TODO: remove this selfie-segmentation path when tasks-vision is stable enough and universally supported
    try {
        const { MediaPipeBackgroundTransformer } = await import("./MediaPipeBackgroundTransformer");
        const transformer = new MediaPipeBackgroundTransformer(config);
        return transformer;
    } catch (error) {
        console.error(
            "[BackgroundTransformer] Failed to create Selfie Segmentation transformer, using fallback:",
            error,
        );
        return new FallbackBackgroundTransformer();
    }
}
