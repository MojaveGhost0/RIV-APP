const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'fvrnswua';
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'inmuebles_preset';

/**
 * Sube un archivo de imagen a Cloudinary mediante Unsigned Upload.
 * @param file - Archivo de imagen a subir
 * @param onProgress - Callback opcional para monitorear el progreso (0-100)
 * @returns Promise<string> con la URL segura (secure_url) de Cloudinary
 */
export async function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } catch {
          reject(new Error('Respuesta no válida del servidor de Cloudinary'));
        }
      } else {
        try {
          const errResponse = JSON.parse(xhr.responseText);
          reject(new Error(errResponse.error?.message || 'Error al subir a Cloudinary'));
        } catch {
          reject(new Error('Error al subir a Cloudinary'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al conectar con Cloudinary'));
    xhr.send(formData);
  });
}
