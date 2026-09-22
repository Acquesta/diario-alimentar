import type { ReadInputBarcodeFormat } from 'zxing-wasm/reader';
import { codigoValido } from './openfoodfacts.ts';

/**
 * Leitura de código de barras pela câmera, só na web (é onde o app roda hoje).
 * A biblioteca (ZXing em WebAssembly) só é baixada quando a pessoa abre o leitor.
 */

/** Formatos usados em produtos de mercado. */
const FORMATOS: ReadInputBarcodeFormat[] = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'];
/** Intervalo entre tentativas de leitura. Cada leitura custa CPU. */
const INTERVALO_MS = 300;

export type Camera = { stream: MediaStream; parar: () => void };

export function cameraDisponivel(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

/** Pede a câmera traseira. Lança erro quando a pessoa nega a permissão. */
export async function abrirCamera(video: HTMLVideoElement): Promise<Camera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play();
  return {
    stream,
    parar: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

/** Mensagem em português para o que pode dar errado com a câmera. */
export function mensagemDaCamera(e: unknown): string {
  const nome = (e as { name?: string } | null)?.name ?? '';
  if (nome === 'NotAllowedError') return 'Permissão da câmera negada. Libere o acesso e tente de novo, ou digite o código.';
  if (nome === 'NotFoundError') return 'Nenhuma câmera encontrada neste aparelho.';
  if (nome === 'NotReadableError') return 'A câmera está ocupada por outro app. Feche os outros e tente de novo.';
  return 'Não foi possível abrir a câmera. Digite o código do produto.';
}

/**
 * Lê quadros da câmera até achar um código de produto ou o sinal ser cancelado.
 * Retorna o código, ou null quando a leitura é interrompida.
 */
export async function lerCodigo(video: HTMLVideoElement, sinal: AbortSignal): Promise<string | null> {
  const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');
  // O arquivo .wasm é servido pelo próprio app (public/zxing), sem depender de CDN.
  prepareZXingModule({ overrides: { locateFile: (arquivo: string) => `/zxing/${arquivo}` } });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  while (!sinal.aborted) {
    const largura = video.videoWidth;
    const altura = video.videoHeight;
    if (largura > 0 && altura > 0) {
      canvas.width = largura;
      canvas.height = altura;
      ctx.drawImage(video, 0, 0, largura, altura);
      const resultados = await readBarcodes(ctx.getImageData(0, 0, largura, altura), {
        formats: FORMATOS,
        tryHarder: true,
      });
      const codigo = resultados.map((r) => r.text.trim()).find(codigoValido);
      if (codigo) return codigo;
    }
    await espera(INTERVALO_MS, sinal);
  }
  return null;
}

function espera(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    sinal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
