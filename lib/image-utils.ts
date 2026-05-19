const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const AVATAR_DIM = 256;
const JPEG_QUALITY = 0.85;
const BG_COLOR = "#0A0A0F";

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, GIF, and WebP images are allowed." };
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return { valid: false, error: "Image must be under 5 MB." };
  }
  return { valid: true };
}

export function resizeAvatarImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_DIM;
      canvas.height = AVATAR_DIM;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, AVATAR_DIM, AVATAR_DIM);

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(AVATAR_DIM / w, AVATAR_DIM / h, 1); // don't upscale
      const dw = Math.round(w * scale);
      const dh = Math.round(h * scale);
      const dx = Math.round((AVATAR_DIM - dw) / 2);
      const dy = Math.round((AVATAR_DIM - dh) / 2);

      ctx.drawImage(img, dx, dy, dw, dh);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create image blob"));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid or corrupt image file."));
    };

    img.src = url;
  });
}
