const useMock = import.meta.env.VITE_USE_MOCK_TRANSCRIPTION !== 'false';
const sampleTranscript = 'Hast du morgen Zeit, gemeinsam etwas essen zu gehen?';

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

export class GermanTranscriber {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();

  preload(): void {
    if (useMock) return;
    this.getWorker().postMessage({ type: 'load', requestId: ++this.requestId });
  }

  async transcribe(chunks: Uint8Array[]): Promise<string> {
    if (useMock) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      return sampleTranscript;
    }
    if (!chunks.length) throw new Error('No speech audio was captured.');

    const audio = pcm16LeToFloat32(chunks);
    const requestId = ++this.requestId;
    const result = new Promise<string>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });
    this.getWorker().postMessage({ type: 'transcribe', requestId, audio }, [audio.buffer]);
    return result;
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL('./transcription.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<Record<string, unknown>>) => {
      const requestId = Number(event.data.requestId);
      if (event.data.type === 'result') {
        this.pending.get(requestId)?.resolve(String(event.data.transcript || ''));
        this.pending.delete(requestId);
      }
      if (event.data.type === 'error') {
        this.pending.get(requestId)?.reject(new Error(String(event.data.message || 'Local transcription failed')));
        this.pending.delete(requestId);
      }
    });
    return this.worker;
  }
}

function pcm16LeToFloat32(chunks: Uint8Array[]): Float32Array {
  const totalBytes = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
  const byteLength = totalBytes - (totalBytes % 2);
  const joined = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = byteLength - offset;
    if (remaining <= 0) break;
    const part = chunk.subarray(0, remaining);
    joined.set(part, offset);
    offset += part.byteLength;
  }

  const view = new DataView(joined.buffer);
  const audio = new Float32Array(byteLength / 2);
  for (let index = 0; index < audio.length; index += 1) {
    audio[index] = view.getInt16(index * 2, true) / 32768;
  }
  return audio;
}

export const transcriptionMode = useMock ? 'mock' : 'local-whisper';
