/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Convert local images to bounded PNG data URLs accepted by the existing Logo option.
export async function prepareLogoImage(file) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    file.size === 0
  ) {
    throw new Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 16 * 1024 * 1024
    ) {
      throw new Error('Invalid dimensions');
    }
    const canvas = document.createElement('canvas');
    for (const edge of [256, 128, 64]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      if (
        dataUrl.startsWith('data:image/png;base64,') &&
        dataUrl.length <= 48 * 1024
      )
        return dataUrl;
    }
    throw new Error('Image too large');
  } catch {
    throw new Error('Could not read this image. Please choose another image.');
  } finally {
    bitmap?.close();
  }
}
