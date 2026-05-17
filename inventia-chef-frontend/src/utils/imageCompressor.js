export const comprimirImagen = (base64Str, maxWidth, maxHeight, calidad = 0.7) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Ajustamos las medidas
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Pasamos a JPEG para que pese menos
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };

    img.onerror = (err) => {
      reject(new Error('No se pudo procesar la imagen para comprimir: ' + err.message));
    };
  });
};
