import { useRef } from 'react';

interface AnnotateModeProps {
  dataUrl: string;
  thumbnailIndex: number;
}

export default function AnnotateMode({ dataUrl: _dataUrl, thumbnailIndex: _thumbnailIndex }: AnnotateModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#1a1a2e',
        color: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 14,
      }}
    >
      <p>Annotation editor — coming in next prompt</p>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
