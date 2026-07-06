import { useEffect, useRef } from 'react'

interface AIOrbProps {
  className?: string
  size?: number
  isDark?: boolean
}

interface Point3D {
  x: number
  y: number
  z: number
  ox: number // original x
  oy: number // original y
  oz: number // original z
}

export default function AIOrb({ className = '', size = 300, isDark = false }: AIOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions with high PPI support
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    // Generate points on a sphere using Fibonacci lattice
    const pointsCount = 70
    const points: Point3D[] = []
    const phi = Math.PI * (3 - Math.sqrt(5)) // golden angle in radians

    for (let i = 0; i < pointsCount; i++) {
      const y = 1 - (i / (pointsCount - 1)) * 2 // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y) // radius at y
      const theta = phi * i // golden angle increment

      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius

      // Scale to radius within canvas
      const sphereRadius = size * 0.35
      const px = x * sphereRadius
      const py = y * sphereRadius
      const pz = z * sphereRadius

      points.push({
        x: px,
        y: py,
        z: pz,
        ox: px,
        oy: py,
        oz: pz
      })
    }

    let angleY = 0.003
    let angleX = 0.001
    const rotYCos = Math.cos(angleY)
    const rotYSin = Math.sin(angleY)
    const rotXCos = Math.cos(angleX)
    const rotXSin = Math.sin(angleX)

    let animationFrameId: number
    let time = 0

    // Animation Loop
    const draw = () => {
      time += 0.02
      ctx.clearRect(0, 0, size, size)

      // Background soft radial gradient glow
      const cx = size / 2
      const cy = size / 2
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
      if (isDark) {
        glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.15)')
        glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.05)')
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else {
        glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.10)')
        glowGrad.addColorStop(0.6, 'rgba(99, 102, 241, 0.02)')
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      }
      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 0, size, size)

      // Project, rotate, and deform points
      const projected = points.map((p) => {
        // Rotate Y
        let x1 = p.x * rotYCos - p.z * rotYSin
        let z1 = p.z * rotYCos + p.x * rotYSin

        // Rotate X
        let y2 = p.y * rotXCos - z1 * rotXSin
        let z2 = z1 * rotXCos + p.y * rotXSin

        // Save rotated coordinates back
        p.x = x1
        p.y = y2
        p.z = z2

        // Apply morphing deform using 3D simplex/sine waves
        const dist = Math.sqrt(p.ox * p.ox + p.oy * p.oy + p.oz * p.oz)
        // Oscillate local radius slightly over time and space
        const wave = 1 + 0.12 * Math.sin(time + p.oy * 0.05 + p.ox * 0.05)
        
        // 3D projection to 2D
        const cameraDistance = size * 1.5
        const scale = cameraDistance / (cameraDistance + z2)
        
        return {
          x: cx + x1 * scale * wave,
          y: cy + y2 * scale * wave,
          z: z2,
          scale
        }
      })

      // Draw wireframe connections
      ctx.lineWidth = 0.75
      const maxDistance = size * 0.22

      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i]

        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j]

          // Calculate 3D distance between points
          const dx = points[i].x - points[j].x
          const dy = points[i].y - points[j].y
          const dz = points[i].z - points[j].z
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

          if (dist < maxDistance) {
            // Fade lines based on distance and depth
            const alphaVal = (1 - dist / maxDistance) * 0.45
            const depthAlpha = Math.max(0.1, (p1.scale + p2.scale) / 2 - 0.5)
            
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)

            // Setup theme color for connections
            if (isDark) {
              ctx.strokeStyle = `rgba(167, 139, 250, ${alphaVal * depthAlpha})` // light purple/violet
            } else {
              ctx.strokeStyle = `rgba(124, 58, 237, ${alphaVal * depthAlpha})` // solid violet
            }
            ctx.stroke()
          }
        }
      }

      // Draw vertices (dots)
      projected.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(1.2, 2.5 * p.scale), 0, Math.PI * 2)
        
        if (isDark) {
          ctx.fillStyle = `rgba(167, 139, 250, ${Math.max(0.3, p.scale - 0.4)})`
        } else {
          ctx.fillStyle = `rgba(124, 58, 237, ${Math.max(0.4, p.scale - 0.3)})`
        }
        ctx.fill()
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [size, isDark])

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Decorative background glow circle behind canvas */}
      <div 
        className="absolute w-1/2 h-1/2 rounded-full blur-3xl opacity-30 pointer-events-none transition-all duration-300"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(99,102,241,0) 70%)'
        }}
      />
      <canvas ref={canvasRef} className="relative z-10" />
    </div>
  )
}
