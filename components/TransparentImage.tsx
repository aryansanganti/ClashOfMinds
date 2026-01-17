import React, { useEffect, useRef, useState } from 'react';

interface TransparentImageProps {
  src: string;
  alt: string;
  className?: string;
  // Options kept for API compatibility but currently using robust auto-detection
  chromaKey?: { r: number; g: number; b: number }; 
  tolerance?: number; 
}

export const TransparentImage: React.FC<TransparentImageProps> = ({
  src,
  alt,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    // Critical: Try to request anonymous access for cross-origin images
    img.crossOrigin = "Anonymous"; 
    img.src = src;

    img.onload = () => {
      // Use natural dimensions for processing to ensure pixel accuracy
      canvas.width = img.naturalWidth || 512;
      canvas.height = img.naturalHeight || 512;

      // 1. Draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 2. Process Pixels
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Loop through every pixel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // --- ROBUST GREEN SCREEN LOGIC ---
          // Instead of simple Euclidean distance which fails on shadows/gradients,
          // we use a Hue/Chroma based approach.
          
          // 1. Green must be the dominant channel
          if (g > r && g > b) {
             const minRB = Math.min(r, b);
             const chroma = g - minRB; // "Strength" of the green signal

             // 2. Must have sufficient color saturation (not just grey/white)
             if (chroma > 20 && g > 40) {
                 // 3. Hue Check
                 // We calculate a simplified Hue factor relative to the Green sector (120deg)
                 // The factor (b-r)/chroma maps to the deviation from pure green.
                 // Range [-1, 1] roughly maps to 60 degrees spread (Yellow-Green to Cyan-Green).
                 // We want a tighter range to avoid erasing yellowish or cyanish parts of the character.
                 
                 const hueFactor = (b - r) / chroma;
                 
                 // -0.9 to 0.9 covers most "Green Screen" variations including shadows
                 if (hueFactor > -0.9 && hueFactor < 0.9) {
                     data[i + 3] = 0; // Transparent
                 }
             }
          }
        }

        // 3. Put modified data back
        ctx.putImageData(imageData, 0, 0);

      } catch (err) {
        // Fallback: If CORS prevents reading pixels, we accept the green background
        // rather than crashing or showing nothing.
        console.warn("Unable to process image transparency (likely CORS):", err);
      }
    };

    img.onerror = () => setError(true);

  }, [src]);

  if (error) return <div className={`flex items-center justify-center bg-red-100 text-red-500 text-xs p-2 ${className}`}>Img Error</div>;

  return <canvas ref={canvasRef} className={className} aria-label={alt} />;
};