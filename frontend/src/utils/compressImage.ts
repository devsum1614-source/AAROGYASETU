import { CompressionResult } from '../types';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateReportFile(file: File): string | null {
  if (!file) {
    return 'Please select a file to upload.';
  }
  const mime = (file.type || '').toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const validExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext);

  if (!ALLOWED_MIME_TYPES.includes(mime) && !validExt) {
    return 'Unsupported file format. Please select a JPEG, PNG, WebP image, or a PDF document.';
  }
  if (file.size === 0) {
    return 'Selected file is empty.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large (${formatFileSize(file.size)}). Maximum allowed size is 5 MB.`;
  }
  return null;
}

/**
 * Compresses an image file (JPEG, PNG, WebP) in the browser using HTML5 Canvas.
 * Measures actual original and compressed sizes without promising a fixed ratio.
 * PDF files are returned untouched with a clear note that image compression applies only to images.
 */
export async function compressReportImage(
  file: File,
  maxDimension: number = 1280,
  quality: number = 0.72
): Promise<CompressionResult> {
  const originalSize = file.size;
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      isPdf: true,
      previewUrl: null,
      note: 'PDF document selected. Browser image compression applies only to image files (JPEG, PNG, WebP); this PDF will be uploaded at its original size.',
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        wasCompressed: false,
        isPdf: false,
        previewUrl: null,
        note: 'Could not read image for compression; uploading original image file.',
      });
    };

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();

      img.onerror = () => {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          wasCompressed: false,
          isPdf: false,
          previewUrl: null,
          note: 'Image could not be decoded in browser; uploading original file.',
        });
      };

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({
            file,
            originalSize,
            compressedSize: originalSize,
            wasCompressed: false,
            isPdf: false,
            previewUrl: dataUrl,
            note: 'Canvas context unavailable; uploading original image.',
          });
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                wasCompressed: false,
                isPdf: false,
                previewUrl: dataUrl,
                note: 'Compression output unavailable; uploading original image.',
              });
              return;
            }

            // If the original image is already smaller than or equal to the Canvas JPEG output,
            // keep the smaller original file and state that clearly.
            if (blob.size >= originalSize) {
              resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                wasCompressed: false,
                isPdf: false,
                previewUrl: dataUrl,
                width: canvas.width,
                height: canvas.height,
                note: 'Image is already compact; keeping original file without increasing size.',
              });
              return;
            }

            const baseName = file.name.replace(/\.[^.]+$/, '') || 'medical_report';
            const compressedFile = new File([blob], `${baseName}_compressed.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize: compressedFile.size,
              wasCompressed: true,
              isPdf: false,
              previewUrl,
              width: canvas.width,
              height: canvas.height,
              note: `Compressed in browser via HTML5 Canvas (${canvas.width}x${canvas.height}px JPEG).`,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}
