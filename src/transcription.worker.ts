import { env, pipeline } from '@huggingface/transformers';

type WorkerRequest =
  | { type: 'load'; requestId: number }
  | { type: 'transcribe'; requestId: number; audio: Float32Array };

type TranscriptionOutput = { text: string } | Array<{ text: string }>;
type Transcriber = (
  audio: Float32Array,
  options: { language: string; task: string; return_timestamps: boolean },
) => Promise<TranscriptionOutput>;

const workerScope = self as unknown as {
  postMessage: (message: unknown) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void) => void;
};
const modelId = import.meta.env.VITE_WHISPER_MODEL || 'onnx-community/whisper-tiny';

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

let transcriberPromise: Promise<Transcriber> | null = null;

const loadTranscriber = (requestId: number) => {
  if (!transcriberPromise) {
    const createTranscriber = pipeline as unknown as (
      task: string,
      model: string,
      options: Record<string, unknown>,
    ) => Promise<Transcriber>;
    transcriberPromise = createTranscriber('automatic-speech-recognition', modelId, {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (progress: unknown) => {
        workerScope.postMessage({ type: 'progress', requestId, progress });
      },
    });
  }
  return transcriberPromise;
};

workerScope.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { requestId } = event.data;
  try {
    const transcriber = await loadTranscriber(requestId);
    if (event.data.type === 'load') {
      workerScope.postMessage({ type: 'ready', requestId });
      return;
    }

    const output = await transcriber(event.data.audio, {
      language: 'de',
      task: 'transcribe',
      return_timestamps: false,
    });
    const text = Array.isArray(output) ? output.map((item) => item.text).join(' ') : output.text;
    workerScope.postMessage({ type: 'result', requestId, transcript: text.trim() });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : 'Local transcription failed',
    });
  }
});
