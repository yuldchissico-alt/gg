import { useEffect, useRef } from 'react';

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAnimatingRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let stars: Array<{
      x: number;
      y: number;
      z: number;
      size: number;
      speed: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createStars = () => {
      stars = [];
      const numStars = 80;
      
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * canvas.width,
          size: Math.random() * 1.5,
          speed: Math.random() * 0.8 + 0.2
        });
      }
    };

    const drawStars = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        const x = (star.x - canvas.width / 2) * (canvas.width / star.z) + canvas.width / 2;
        const y = (star.y - canvas.height / 2) * (canvas.width / star.z) + canvas.height / 2;
        
        if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
          star.z = canvas.width;
          star.x = Math.random() * canvas.width;
          star.y = Math.random() * canvas.height;
        } else {
          const size = (1 - star.z / canvas.width) * star.size * 2.5;
          const brightness = Math.max(0.1, 1 - star.z / canvas.width);
          
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.8})`;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }

        star.z -= star.speed;
        if (star.z <= 0) {
          star.z = canvas.width;
          star.x = Math.random() * canvas.width;
          star.y = Math.random() * canvas.height;
        }
      });
    };

    const animate = () => {
      if (isAnimatingRef.current) {
        drawStars();
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleVisibilityChange = () => {
      isAnimatingRef.current = !document.hidden;
    };

    resizeCanvas();
    createStars();
    animate();

    window.addEventListener('resize', () => {
      resizeCanvas();
      createStars();
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ 
        background: 'linear-gradient(to bottom, #0a0e27 0%, #1a1b3d 50%, #0f1428 100%)',
        willChange: 'contents'
      }}
    />
  );
}
