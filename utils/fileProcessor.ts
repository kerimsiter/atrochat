import { Attachment } from '../types';

/**
 * Processes a File object into an Attachment object.
 * Reads image files as base64 data URLs and other files as text.
 * @param file The File object to process.
 * @returns A promise that resolves to an Attachment object.
 */
export const processFile = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (error) => reject(error);
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: reader.result as string,
      });
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      // Assume anything else is a text-based file (code, etc.)
      reader.readAsText(file, 'UTF-8');
    }
  });
};
