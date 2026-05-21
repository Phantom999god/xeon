'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  memo,
} from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  BackgroundVariant,
  useReactFlow,
  useNodes,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import Tilt from 'react-parallax-tilt'

export type AgentStatus = 'executing' | 'listening' | 'idle' | 'error'

export interface AgentNode {
  id: string
  name: string
  device?: string
  status: AgentStatus
  lastAction?: string
  latency?: number
}

interface NodeMapProps {
  agents: AgentNode[]
  onNodeClick?: (agent: AgentNode) => void
}

const statusColors: Record<AgentStatus, string> = {
  executing: '#f59e0b',
  listening: '#10b981',
  idle: '#6b7280',
  error: '#ef4444',
}
const statusLabels: Record<AgentStatus, string> = {
  executing: 'Executing...',
  listening: 'Listening...',
  idle: 'Idle',
  error: 'Error',
}
const statusBg: Record<AgentStatus, string> = {
  executing: 'rgba(245,158,11,0.15)',
  listening: 'rgba(16,185,129,0.15)',
  idle: 'rgba(107,114,128,0.10)',
  error: 'rgba(239,68,68,0.15)',
}

// ─── Three.js animated background ───────────────────────────────────────────
function ThreeBackground({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = canvas.offsetWidth
    let height = canvas.offsetHeight
    canvas.width = width
    canvas.height = height

    const resize = () => {
      width = canvas.offsetWidth
      height = canvas.offsetHeight
      canvas.width = width
      canvas.height = height
    }
    window.addEventListener('resize', resize)

    // Particles
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = []
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.5 + 0.15,
      })
    }

    // Floating geometry vertices (icosahedron-like 3D projected)
    const geos: { cx: number; cy: number; r: number; rot: number; rotSpeed: number; alpha: number; sides: number }[] = []
    for (let i = 0; i < 6; i++) {
      geos.push({
        cx: Math.random() * width,
        cy: Math.random() * height,
        r: 30 + Math.random() * 60,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.003,
        alpha: 0.04 + Math.random() * 0.06,
        sides: [3, 4, 5, 6, 8][Math.floor(Math.random() * 5)],
      })
    }

    const draw = () => {
      timeRef.current += 0.008
      const t = timeRef.current

      ctx.clearRect(0, 0, width, height)

      // Parallax grid – layer 1 (slowest)
      const mx = mouseX * 0.02
      const my = mouseY * 0.02
      const gridSize = 60
      ctx.strokeStyle = 'rgba(139,92,246,0.07)'
      ctx.lineWidth = 0.5
      for (let x = (mx % gridSize) - gridSize; x < width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
      }
      for (let y = (my % gridSize) - gridSize; y < height + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }

      // Parallax grid – layer 2 (medium)
      const mx2 = mouseX * 0.05
      const my2 = mouseY * 0.05
      const gridSize2 = 120
      ctx.strokeStyle = 'rgba(109,40,217,0.05)'
      ctx.lineWidth = 0.3
      for (let x = (mx2 % gridSize2) - gridSize2; x < width + gridSize2; x += gridSize2) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
      }
      for (let y = (my2 % gridSize2) - gridSize2; y < height + gridSize2; y += gridSize2) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
      }

      // Floating geometries
      for (const geo of geos) {
        geo.rot += geo.rotSpeed
        // 3D perspective illusion: scale with a sine
        const scale = 0.85 + 0.15 * Math.sin(t * 0.7 + geo.rotSpeed * 100)
        const r = geo.r * scale
        ctx.save()
        ctx.translate(geo.cx + mouseX * 0.03, geo.cy + mouseY * 0.03)
        ctx.rotate(geo.rot)
        ctx.strokeStyle = `rgba(139,92,246,${geo.alpha})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        for (let i = 0; i <= geo.sides; i++) {
          const angle = (i / geo.sides) * Math.PI * 2
          const px = Math.cos(angle) * r
          const py = Math.sin(angle) * r
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
        // inner wireframe
        ctx.globalAlpha = 0.5
        ctx.beginPath()
        for (let i = 0; i < geo.sides; i++) {
          const a1 = (i / geo.sides) * Math.PI * 2
          const a2 = ((i + 2) / geo.sides) * Math.PI * 2
          ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r)
          ctx.lineTo(Math.cos(a2) * r * 0.5, Math.sin(a2) * r * 0.5)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.restore()
      }

      // Particles
      const curX = (mouseX / 100) * width
      const curY = (mouseY / 100) * height
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        // cursor proximity effect
        const dx = p.x - curX
        const dy = p.y - curY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const brightAlpha = dist < 120 ? p.alpha + (1 - dist / 120) * 0.4 : p.alpha
        const size = dist < 80 ? p.size + (1 - dist / 80) * 2 : p.size

        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139,92,246,${brightAlpha})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, []) // run once; mouseX/mouseY are read via closure on render updates

  // keep mouse ref updated without re-running the effect
  const latestMouse = useRef({ mouseX, mouseY })
  useEffect(() => { latestMouse.current = { mouseX, mouseY } }, [mouseX, mouseY])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

// ─── Animated bezier connection with flowing particles ────────────────────────
function AnimatedEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  data?: { status?: AgentStatus; highlighted?: boolean }
}) {
  const status = data?.status ?? 'idle'
  const highlighted = data?.highlighted ?? false
  const color = status === 'executing' ? '#f59e0b' : highlighted ? '#a78bfa' : '#8b5cf6'
  const glowOpacity = highlighted ? 0.8 : 0.4

  // Cubic bezier control points
  const dx = (targetX - sourceX) * 0.5
  const d = `M${sourceX},${sourceY} C${sourceX + dx},${sourceY} ${targetX - dx},${targetY} ${targetX},${targetY}`

  // Particle positions along the path (0..1)
  const particleOffsets = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((base, i) => ({ base, speed: 0.004 + i * 0.002 })),
    []
  )
  const [particleTs, setParticleTs] = useState(particleOffsets.map(p => p.base))

  useEffect(() => {
    let frame: number
    const tick = () => {
      setParticleTs(prev =>
        prev.map((t, i) => {
          const next = t + particleOffsets[i].speed
          return next > 1 ? next - 1 : next
        })
      )
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [particleOffsets])

  // Evaluate point on cubic bezier
  const bezierPoint = (t: number) => {
    const mt = 1 - t
    const dx2 = (targetX - sourceX) * 0.5
    const c1x = sourceX + dx2; const c1y = sourceY
    const c2x = targetX - dx2; const c2y = targetY
    return {
      x: mt * mt * mt * sourceX + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * targetX,
      y: mt * mt * mt * sourceY + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * targetY,
    }
  }

  return (
    <g>
      {/* Outer glow */}
      <path
        d={d}
        stroke={color}
        strokeWidth={highlighted ? 8 : 5}
        fill="none"
        opacity={0.1 + glowOpacity * 0.15}
        strokeLinecap="round"
        style={{ filter: `blur(${highlighted ? 6 : 4}px)` }}
      />
      {/* Core line */}
      <path
        d={d}
        stroke={color}
        strokeWidth={highlighted ? 2 : 1.5}
        fill="none"
        opacity={glowOpacity}
        strokeLinecap="round"
        strokeDasharray={status === 'executing' ? '6 3' : 'none'}
      />
      {/* Flowing particles */}
      {particleTs.slice(0, status === 'idle' ? 2 : 4).map((t, i) => {
        const pt = bezierPoint(t)
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={status === 'executing' ? 2.5 : 1.8}
            fill={color}
            opacity={0.6 + Math.sin(t * Math.PI * 2) * 0.3}
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          />
        )
      })}
    </g>
  )
}

// ─── KRONOS central node ──────────────────────────────────────────────────────
function KronosNode({ data }: NodeProps) {
  const controls = useAnimation()
  const [ripple, setRipple] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRipple(r => r + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {/* Ripple */}
      <AnimatePresence>
        <motion.div
          key={ripple}
          className="absolute rounded-full border border-purple-500/40 pointer-events-none"
          style={{ width: 80, height: 80 }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 3.5, opacity: 0 }}
          exit={{}}
          transition={{ duration: 2.5, ease: 'easeOut' }}
        />
      </AnimatePresence>

      {/* Outer hex ring */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          <polygon
            points="60,8 106,33 106,87 60,112 14,87 14,33"
            fill="none"
            stroke="rgba(139,92,246,0.35)"
            strokeWidth="1"
            strokeDasharray="8 4"
          />
        </svg>
      </motion.div>

      {/* Main hexagon */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 18px rgba(139,92,246,0.7))' }}
      >
        <svg width="88" height="88" viewBox="0 0 88 88">
          <defs>
            <radialGradient id="kg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="60%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
          </defs>
          <polygon
            points="44,6 78,25 78,63 44,82 10,63 10,25"
            fill="url(#kg)"
            stroke="#8b5cf6"
            strokeWidth="1.5"
          />
          {/* Inner hex */}
          <polygon
            points="44,20 64,31 64,53 44,64 24,53 24,31"
            fill="rgba(139,92,246,0.2)"
            stroke="rgba(167,139,250,0.5)"
            strokeWidth="0.8"
          />
        </svg>

        {/* Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold text-white tracking-widest"
            style={{ fontSize: 10, lineHeight: 1, letterSpacing: '0.18em' }}
          >
            KRONOS
          </span>
          <span className="font-mono text-purple-300 mt-0.5" style={{ fontSize: 7 }}>
            CORE
          </span>
        </div>
      </motion.div>

      {/* Pulsing dot */}
      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-status-pulse" />

      {/* RF handles — invisible, positioned at center */}
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent' }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent' }} />
    </div>
  )
}

// ─── Satellite agent node ─────────────────────────────────────────────────────
function AgentNodeComponent({ data, selected }: NodeProps) {
  const status: AgentStatus = (data?.status as AgentStatus) ?? 'idle'
  const color = statusColors[status]
  const bg = statusBg[status]

  return (
    <Tilt
      tiltMaxAngleX={12}
      tiltMaxAngleY={12}
      glareEnable={true}
      glareMaxOpacity={0.08}
      glareColor="#8b5cf6"
      glarePosition="all"
      perspective={600}
      transitionSpeed={300}
      scale={1.04}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <motion.div
        className="relative rounded-lg overflow-hidden cursor-pointer select-none"
        style={{
          width: 140,
          background: 'rgba(0,0,0,0.75)',
          border: `1px solid ${selected ? color : 'rgba(139,92,246,0.3)'}`,
          backdropFilter: 'blur(16px)',
          boxShadow: selected
            ? `0 0 20px ${color}55, inset 0 0 8px ${color}22`
            : `0 0 8px rgba(139,92,246,0.2)`,
        }}
        animate={{ scale: [1, 1.015, 1] }}
        transition={{
          duration: status === 'idle' ? 4 : status === 'executing' ? 1.2 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
      >
        {/* Top status bar */}
        <div
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />

        <div className="px-3 py-2.5">
          {/* Status row */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                animate={status !== 'idle' ? { opacity: [1, 0.4, 1], scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="font-mono text-[9px] tracking-wider" style={{ color }}>
                {statusLabels[status]}
              </span>
            </div>
          </div>

          {/* Name */}
          <p
            className="font-mono font-bold text-white leading-tight truncate"
            style={{ fontSize: 11 }}
          >
            {data?.name as string}
          </p>
          {data?.device && (
            <p className="font-mono text-[9px] text-purple-400 mt-0.5">
              {data.device as string}
            </p>
          )}

          {/* Last action */}
          {data?.lastAction && (
            <p
              className="font-mono text-[8px] text-gray-500 mt-1.5 truncate"
              style={{ letterSpacing: '0.03em' }}
            >
              {data.lastAction as string}
            </p>
          )}

          {/* Latency */}
          {data?.latency && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="font-mono text-[8px] text-gray-600">LATENCY</span>
              <span className="font-mono text-[8px] text-purple-400">{data.latency as number}ms</span>
            </div>
          )}
        </div>

        {/* Bottom accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
        />

        {/* RF handles — invisible */}
        <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent' }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none', width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent' }} />
      </motion.div>
    </Tilt>
  )
}

const nodeTypes = {
  kronos: KronosNode,
  agent: AgentNodeComponent,
}

// ─── SVG overlay that draws all edges using live node positions ───────────────
// This completely bypasses RF's connection system.
function EdgesOverlay({
  agents,
  highlightedNode,
}: {
  agents: AgentNode[]
  highlightedNode: string | null
}) {
  const rfNodes = useNodes()
  const [, setTick] = useState(0)

  // Animate particles by ticking every frame
  const tickRef = useRef(0)
  useEffect(() => {
    let id: number
    const loop = () => {
      tickRef.current += 1
      setTick(t => t + 1)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  const kronosNode = rfNodes.find(n => n.id === 'kronos')
  if (!kronosNode) return null

  // Center of the KRONOS node (node position is top-left, width=120, height=120)
  const kx = kronosNode.position.x + 60
  const ky = kronosNode.position.y + 60

  return (
    <svg
      className="react-flow__edges-overlay pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        zIndex: 1,
      }}
    >
      {agents.map((agent, agentIdx) => {
        const agentNode = rfNodes.find(n => n.id === agent.id)
        if (!agentNode) return null

        const ax = agentNode.position.x + 70
        const ay = agentNode.position.y + 40
        const isHighlighted = highlightedNode === agent.id || highlightedNode === 'kronos'
        const color = agent.status === 'executing'
          ? '#f59e0b'
          : isHighlighted
          ? '#a78bfa'
          : '#8b5cf6'

        // Cubic bezier
        const dx = (ax - kx) * 0.5
        const d = `M${kx},${ky} C${kx + dx},${ky} ${ax - dx},${ay} ${ax},${ay}`

        // 4 particles per edge
        const numParticles = agent.status === 'idle' ? 2 : 4
        const particles = Array.from({ length: numParticles }, (_, i) => {
          const baseT = i / numParticles
          const speed = 0.003 + i * 0.0015
          const t = ((baseT + tickRef.current * speed) % 1 + 1) % 1
          const mt = 1 - t
          const c1x = kx + dx; const c1y = ky
          const c2x = ax - dx; const c2y = ay
          const px = mt*mt*mt*kx + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*ax
          const py = mt*mt*mt*ky + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*ay
          const alpha = 0.5 + Math.sin(t * Math.PI * 2 + agentIdx) * 0.4
          return { px, py, alpha }
        })

        return (
          <g key={agent.id}>
            {/* Glow */}
            <path d={d} stroke={color} strokeWidth={isHighlighted ? 10 : 6} fill="none" opacity={0.08} strokeLinecap="round" style={{ filter: `blur(${isHighlighted ? 6 : 4}px)` }} />
            {/* Core line */}
            <path
              d={d}
              stroke={color}
              strokeWidth={isHighlighted ? 2 : 1.5}
              fill="none"
              opacity={isHighlighted ? 0.9 : 0.45}
              strokeLinecap="round"
              strokeDasharray={agent.status === 'executing' ? '6 3' : undefined}
            />
            {/* Particles */}
            {particles.map((p, i) => (
              <circle
                key={i}
                cx={p.px}
                cy={p.py}
                r={agent.status === 'executing' ? 2.8 : 2}
                fill={color}
                opacity={p.alpha}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Custom cursor ────────────────────────────────────────────────────────────
function CustomCursor({ x, y }: { x: number; y: number }) {
  return (
    <>
      <motion.div
        className="fixed pointer-events-none z-[9999] rounded-full"
        style={{
          width: 8,
          height: 8,
          background: '#8b5cf6',
          boxShadow: '0 0 12px 4px rgba(139,92,246,0.7)',
        }}
        animate={{ left: x - 4, top: y - 4 }}
        transition={{ type: 'spring', stiffness: 800, damping: 40, mass: 0.1 }}
      />
      <motion.div
        className="fixed pointer-events-none z-[9998] rounded-full border border-purple-500/40"
        style={{ width: 28, height: 28 }}
        animate={{ left: x - 14, top: y - 14 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.5 }}
      />
    </>
  )
}

// ─── Main inner component (needs ReactFlow context) ──────────────────────────
function NodeMapInner({ agents, onNodeClick }: NodeMapProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [canvasMouseNorm, setCanvasMouseNorm] = useState({ x: 0, y: 0 })
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Build RF nodes
  const initialNodes: Node[] = useMemo(() => {
    const kronosNode: Node = {
      id: 'kronos',
      type: 'kronos',
      position: { x: 0, y: 0 },
      data: { label: 'KRONOS' },
      draggable: true,
    }
    const agentNodes: Node[] = agents.map((agent, i) => {
      const angle = (i * 2 * Math.PI) / agents.length - Math.PI / 2
      const radius = 280
      return {
        id: agent.id,
        type: 'agent',
        position: {
          x: Math.cos(angle) * radius - 70,
          y: Math.sin(angle) * radius - 40,
        },
        data: {
          ...agent,
          label: agent.name,
        },
        draggable: true,
      }
    })
    return [kronosNode, ...agentNodes]
  }, [agents])

  const initialEdges: Edge[] = useMemo(
    () =>
      agents.map(agent => ({
        id: `e-kronos-${agent.id}`,
        source: 'kronos',
        target: agent.id,
        type: 'animated',
        data: { status: agent.status, highlighted: false },
        animated: false,
      })),
    [agents]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState([])

  // Sync agent statuses into nodes
  useEffect(() => {
    setNodes(prev =>
      prev.map(n => {
        if (n.id === 'kronos') return n
        const agent = agents.find(a => a.id === n.id)
        if (!agent) return n
        return { ...n, data: { ...n.data, status: agent.status } }
      })
    )
  }, [agents, setNodes])

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCanvasMouseNorm({
        x: ((e.clientX - rect.left) / rect.width) * 100 - 50,
        y: ((e.clientY - rect.top) / rect.height) * 100 - 50,
      })
    }
  }, [])

  // Keyboard shortcut CMD+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
      if (e.key === 'Escape') setShowSearch(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Double-click empty space → fit view
  const onPaneDoubleClick = useCallback(() => {
    fitView({ duration: 600, padding: 0.25 })
  }, [fitView])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === 'kronos') return
      const agent = agents.find(a => a.id === node.id)
      if (agent) onNodeClick?.(agent)
    },
    [agents, onNodeClick]
  )

  const handleNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHighlightedNode(node.id)
  }, [])
  const handleNodeMouseLeave = useCallback(() => {
    setHighlightedNode(null)
  }, [])

  // Search fly-to
  const handleSearch = useCallback(
    (q: string) => {
      const node = nodes.find(n =>
        (n.data?.name as string ?? '').toLowerCase().includes(q.toLowerCase()) ||
        n.id.toLowerCase().includes(q.toLowerCase())
      )
      if (node) {
        fitView({ nodes: [node], duration: 700, padding: 0.5 })
        setHighlightedNode(node.id)
        setTimeout(() => setHighlightedNode(null), 2000)
      }
      setShowSearch(false)
    },
    [nodes, fitView]
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      onMouseMove={handleMouseMove}
      style={{ cursor: 'none' }}
    >
      {/* Custom cursor */}
      <CustomCursor x={mousePos.x} y={mousePos.y} />

      {/* Three.js background */}
      <ThreeBackground mouseX={canvasMouseNorm.x} mouseY={canvasMouseNorm.y} />

      {/* ReactFlow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={() => setHighlightedNode(null)}
        onDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.2}
        maxZoom={3}
        defaultViewport={{ x: 420, y: 200, zoom: 0.85 }}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        fitView={false}
        style={{ background: 'transparent', position: 'absolute', inset: 0, zIndex: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(139,92,246,0.12)"
          style={{ zIndex: 0 }}
        />

        {/* Custom edges SVG overlay — reads live node positions */}
        <EdgesOverlay agents={agents} highlightedNode={highlightedNode} />

        <MiniMap
          style={{
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '6px',
          }}
          nodeColor={node => {
            if (node.id === 'kronos') return '#8b5cf6'
            const agent = agents.find(a => a.id === node.id)
            return agent ? statusColors[agent.status] : '#6b7280'
          }}
          maskColor="rgba(0,0,0,0.3)"
          zoomable
          pannable
        />

        {/* CMD+K hint */}
        <Panel position="top-right">
          <button
            onClick={() => setShowSearch(true)}
            className="font-mono text-[10px] text-purple-400/60 hover:text-purple-400 transition-colors flex items-center gap-1.5 bg-black/40 border border-purple-500/20 rounded px-2 py-1"
          >
            <span>⌘K</span>
            <span>search node</span>
          </button>
        </Panel>

        {/* Zoom controls */}
        <Panel position="bottom-right" style={{ marginBottom: 80 }}>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => zoomIn({ duration: 200 })}
              className="w-7 h-7 font-mono text-sm text-purple-400 bg-black/60 border border-purple-500/20 rounded flex items-center justify-center hover:bg-purple-500/20 transition-colors"
            >+</button>
            <button
              onClick={() => zoomOut({ duration: 200 })}
              className="w-7 h-7 font-mono text-sm text-purple-400 bg-black/60 border border-purple-500/20 rounded flex items-center justify-center hover:bg-purple-500/20 transition-colors"
            >−</button>
            <button
              onClick={() => fitView({ duration: 500, padding: 0.2 })}
              className="w-7 h-7 font-mono text-[9px] text-purple-400 bg-black/60 border border-purple-500/20 rounded flex items-center justify-center hover:bg-purple-500/20 transition-colors"
            >⊡</button>
          </div>
        </Panel>
      </ReactFlow>

      {/* CMD+K Search modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            className="absolute inset-0 z-50 flex items-start justify-center pt-16 px-8"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              className="w-full max-w-md glass-panel rounded-lg overflow-hidden"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearch(searchQuery)
                  if (e.key === 'Escape') setShowSearch(false)
                }}
                placeholder="Search node by name..."
                className="w-full bg-transparent px-4 py-3 font-mono text-sm text-white placeholder-gray-600 outline-none border-b border-purple-500/20"
              />
              <div className="px-4 py-2">
                {agents
                  .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleSearch(a.name)}
                      className="w-full text-left font-mono text-xs text-gray-300 hover:text-white hover:bg-purple-500/10 px-2 py-1.5 rounded flex items-center gap-2 transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: statusColors[a.status] }}
                      />
                      {a.name}
                      {a.device && <span className="text-gray-600 ml-auto">{a.device}</span>}
                    </button>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Public export (wrapped with provider) ───────────────────────────────────
export function NodeMap({ agents, onNodeClick }: NodeMapProps) {
  return (
    <ReactFlowProvider>
      <NodeMapInner agents={agents} onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  )
}
