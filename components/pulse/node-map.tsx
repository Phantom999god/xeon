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
  Handle,
  Position,
  type Node,
  type NodeProps,
  BackgroundVariant,
  useReactFlow,
  useNodes,
  ReactFlowProvider,
  Panel,
  useViewport,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence, useAnimation, useSpring, useTransform } from 'framer-motion'
import Tilt from 'react-parallax-tilt'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Stars, EffectComposer, ChromaticAberration, DepthOfField } from '@react-three/drei'
import * as THREE from 'three'

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

// ─── Ambient Sound Engine ─────────────────────────────────────────────────────
class AmbientSoundEngine {
  private audioCtx: AudioContext | null = null
  private oscillators: OscillatorNode[] = []
  private gainNodes: GainNode[] = []
  private masterGain: GainNode | null = null
  private isPlaying = false

  init() {
    if (this.audioCtx) return
    this.audioCtx = new AudioContext()
    this.masterGain = this.audioCtx.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(this.audioCtx.destination)

    // Create layered oscillators for ambient synth hum
    const frequencies = [55, 82.5, 110, 165] // A1, E2, A2, E3 - power chord
    frequencies.forEach((freq, i) => {
      const osc = this.audioCtx!.createOscillator()
      const gain = this.audioCtx!.createGain()
      osc.type = i === 0 ? 'sawtooth' : 'sine'
      osc.frequency.value = freq
      gain.gain.value = i === 0 ? 0.15 : 0.08 / (i + 1)
      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start()
      this.oscillators.push(osc)
      this.gainNodes.push(gain)
    })
  }

  toggle() {
    if (!this.audioCtx) this.init()
    if (this.isPlaying) {
      this.masterGain?.gain.linearRampToValueAtTime(0, this.audioCtx!.currentTime + 0.5)
    } else {
      this.audioCtx?.resume()
      this.masterGain?.gain.linearRampToValueAtTime(0.3, this.audioCtx!.currentTime + 0.5)
    }
    this.isPlaying = !this.isPlaying
    return this.isPlaying
  }

  setIntensity(activeCount: number) {
    if (!this.isPlaying || !this.audioCtx) return
    // Modulate pitch based on active agents
    const pitchMod = 1 + activeCount * 0.02
    this.oscillators.forEach((osc, i) => {
      const baseFreq = [55, 82.5, 110, 165][i]
      osc.frequency.linearRampToValueAtTime(baseFreq * pitchMod, this.audioCtx!.currentTime + 0.1)
    })
  }

  destroy() {
    this.oscillators.forEach(osc => osc.stop())
    this.audioCtx?.close()
  }
}

const soundEngine = typeof window !== 'undefined' ? new AmbientSoundEngine() : null

// ─── 3D Floating Geometry that morphs ─────────────────────────────────────────
function MorphingGeometry({ position, mouseX, mouseY }: { position: [number, number, number]; mouseX: number; mouseY: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [geoType, setGeoType] = useState(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setGeoType(g => (g + 1) % 3)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    timeRef.current += delta
    meshRef.current.rotation.x += delta * 0.1
    meshRef.current.rotation.y += delta * 0.15
    // Parallax effect based on mouse
    meshRef.current.position.x = position[0] + mouseX * 0.003
    meshRef.current.position.y = position[1] + mouseY * 0.003
  })

  return (
    <Float speed={1} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position}>
        {geoType === 0 && <icosahedronGeometry args={[0.5, 0]} />}
        {geoType === 1 && <dodecahedronGeometry args={[0.5, 0]} />}
        {geoType === 2 && <octahedronGeometry args={[0.5, 0]} />}
        <meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.15} />
      </mesh>
    </Float>
  )
}

// ─── 3D Torus Knot floating in background ─────────────────────────────────────
function FloatingTorusKnot({ position, mouseX, mouseY }: { position: [number, number, number]; mouseX: number; mouseY: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.x += delta * 0.05
    meshRef.current.rotation.z += delta * 0.08
    meshRef.current.position.x = position[0] + mouseX * 0.005
    meshRef.current.position.y = position[1] - mouseY * 0.005
  })

  return (
    <Float speed={0.5} rotationIntensity={0.3} floatIntensity={0.3}>
      <mesh ref={meshRef} position={position}>
        <torusKnotGeometry args={[0.4, 0.1, 64, 8]} />
        <meshBasicMaterial color="#6d28d9" wireframe transparent opacity={0.1} />
      </mesh>
    </Float>
  )
}

// ─── Particle field that reacts to cursor ─────────────────────────────────────
function ParticleField({ mouseX, mouseY, count = 200 }: { mouseX: number; mouseY: number; count?: number }) {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return pos
  }, [count])

  const originalPositions = useMemo(() => new Float32Array(positions), [positions])

  useFrame((state) => {
    if (!points.current) return
    const posArray = points.current.geometry.attributes.position.array as Float32Array
    const cursorX = mouseX * 0.05
    const cursorY = mouseY * 0.05

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const ox = originalPositions[idx]
      const oy = originalPositions[idx + 1]
      
      // Distance from cursor in normalized space
      const dx = ox - cursorX
      const dy = oy - cursorY
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      // Push particles away from cursor
      if (dist < 3) {
        const force = (3 - dist) / 3 * 0.5
        posArray[idx] = ox + dx * force
        posArray[idx + 1] = oy + dy * force
      } else {
        posArray[idx] = ox
        posArray[idx + 1] = oy
      }
      
      // Gentle drift
      posArray[idx + 2] = originalPositions[idx + 2] + Math.sin(state.clock.elapsedTime + i * 0.1) * 0.1
    }
    points.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#8b5cf6" size={0.03} transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

// ─── Animated 3D Grid ─────────────────────────────────────────────────────────
function AnimatedGrid({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const gridRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!gridRef.current) return
    gridRef.current.rotation.x = -Math.PI / 2 + mouseY * 0.002
    gridRef.current.rotation.z = mouseX * 0.001
    gridRef.current.position.y = -2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
  })

  return (
    <group ref={gridRef}>
      <gridHelper args={[50, 50, '#8b5cf620', '#6d28d910']} />
    </group>
  )
}

// ─── Three.js Scene ───────────────────────────────────────────────────────────
function ThreeScene({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.2} color="#8b5cf6" />
      
      {/* Stars in deep background */}
      <Stars radius={100} depth={50} count={1000} factor={2} saturation={0} fade speed={0.5} />
      
      {/* Animated grid floor */}
      <AnimatedGrid mouseX={mouseX} mouseY={mouseY} />
      
      {/* Floating geometries at different depths (parallax layers) */}
      {/* Layer 1 - furthest, slowest parallax */}
      <MorphingGeometry position={[-5, 3, -8]} mouseX={mouseX * 0.3} mouseY={mouseY * 0.3} />
      <MorphingGeometry position={[6, -2, -10]} mouseX={mouseX * 0.3} mouseY={mouseY * 0.3} />
      <FloatingTorusKnot position={[0, 4, -12]} mouseX={mouseX * 0.2} mouseY={mouseY * 0.2} />
      
      {/* Layer 2 - medium depth */}
      <MorphingGeometry position={[-4, -3, -5]} mouseX={mouseX * 0.5} mouseY={mouseY * 0.5} />
      <MorphingGeometry position={[5, 2, -6]} mouseX={mouseX * 0.5} mouseY={mouseY * 0.5} />
      <FloatingTorusKnot position={[-6, 0, -7]} mouseX={mouseX * 0.5} mouseY={mouseY * 0.5} />
      
      {/* Layer 3 - closest, fastest parallax */}
      <MorphingGeometry position={[3, -4, -3]} mouseX={mouseX * 0.8} mouseY={mouseY * 0.8} />
      <FloatingTorusKnot position={[-3, 3, -4]} mouseX={mouseX * 0.8} mouseY={mouseY * 0.8} />
      
      {/* Particle field */}
      <ParticleField mouseX={mouseX} mouseY={mouseY} count={200} />
    </>
  )
}

// ─── Three.js Background wrapper with post-processing ─────────────────────────
const ThreeBackground = memo(function ThreeBackground({ 
  mouseX, 
  mouseY, 
  panVelocity = 0 
}: { 
  mouseX: number
  mouseY: number
  panVelocity?: number
}) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <ThreeScene mouseX={mouseX} mouseY={mouseY} />
      </Canvas>
      {/* Chromatic aberration overlay on fast pan */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          opacity: Math.min(panVelocity * 0.01, 0.4),
          background: 'linear-gradient(90deg, rgba(255,0,0,0.1), transparent, rgba(0,0,255,0.1))',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  )
})

// ─── KRONOS central node with 3D hexagon ──────────────────────────────────────
function KronosNode({ data }: NodeProps) {
  const [ripple, setRipple] = useState(0)
  const rotationRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setRipple(r => r + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Continuous slow rotation
  useEffect(() => {
    let frame: number
    const animate = () => {
      rotationRef.current += 0.3
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      {/* Ripple waves */}
      <AnimatePresence>
        <motion.div
          key={ripple}
          className="absolute rounded-full pointer-events-none"
          style={{ 
            width: 100, 
            height: 100,
            border: '2px solid rgba(139,92,246,0.4)',
            boxShadow: '0 0 20px rgba(139,92,246,0.3), inset 0 0 20px rgba(139,92,246,0.1)'
          }}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 4, opacity: 0 }}
          exit={{}}
          transition={{ duration: 3, ease: 'easeOut' }}
        />
      </AnimatePresence>

      {/* Outer rotating hex ring */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      >
        <svg width="140" height="140" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#6d28d9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <polygon
            points="70,5 125,37 125,103 70,135 15,103 15,37"
            fill="none"
            stroke="url(#hexGrad)"
            strokeWidth="1.5"
            strokeDasharray="12 6"
          />
        </svg>
      </motion.div>

      {/* Middle counter-rotating ring */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ rotate: -360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          <polygon
            points="60,8 106,33 106,87 60,112 14,87 14,33"
            fill="none"
            stroke="rgba(139,92,246,0.2)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
        </svg>
      </motion.div>

      {/* Main 3D-effect hexagon */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={{ 
          scale: [1, 1.04, 1],
          rotateY: [0, 5, 0, -5, 0],
        }}
        transition={{ 
          scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          rotateY: { duration: 8, repeat: Infinity, ease: 'easeInOut' }
        }}
        style={{ 
          filter: 'drop-shadow(0 0 25px rgba(139,92,246,0.8)) drop-shadow(0 0 50px rgba(139,92,246,0.4))',
          transformStyle: 'preserve-3d',
          perspective: '500px'
        }}
      >
        <svg width="100" height="100" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="kronosGrad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="40%" stopColor="#8b5cf6" />
              <stop offset="70%" stopColor="#6d28d9" />
              <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
            <filter id="innerGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Shadow hex for 3D depth */}
          <polygon
            points="52,10 88,30 88,70 52,90 16,70 16,30"
            fill="rgba(0,0,0,0.5)"
            transform="translate(2, 3)"
          />
          
          {/* Main hex */}
          <polygon
            points="50,8 86,28 86,72 50,92 14,72 14,28"
            fill="url(#kronosGrad)"
            stroke="#a78bfa"
            strokeWidth="2"
            filter="url(#innerGlow)"
          />
          
          {/* Inner glowing hex */}
          <polygon
            points="50,22 72,34 72,58 50,70 28,58 28,34"
            fill="rgba(139,92,246,0.3)"
            stroke="rgba(196,181,253,0.6)"
            strokeWidth="1"
          />
          
          {/* Core hex */}
          <polygon
            points="50,32 62,39 62,53 50,60 38,53 38,39"
            fill="rgba(167,139,250,0.4)"
            stroke="rgba(196,181,253,0.8)"
            strokeWidth="0.5"
          />
        </svg>

        {/* Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="font-mono font-black text-white tracking-[0.25em]"
            style={{ fontSize: 11, lineHeight: 1, textShadow: '0 0 10px rgba(139,92,246,0.8)' }}
            animate={{ opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            KRONOS
          </motion.span>
          <span className="font-mono text-purple-300/80 mt-0.5" style={{ fontSize: 7, letterSpacing: '0.2em' }}>
            NEURAL CORE
          </span>
        </div>
      </motion.div>

      {/* Orbiting particles */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-purple-400"
          style={{ 
            boxShadow: '0 0 8px rgba(139,92,246,0.8)',
            transformOrigin: '70px 70px'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4 + i * 2, repeat: Infinity, ease: 'linear', delay: i * 1.3 }}
        />
      ))}

      {/* Status indicator */}
      <motion.div 
        className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-emerald-400"
        style={{ boxShadow: '0 0 10px rgba(16,185,129,0.8)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* RF handles */}
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
}

// ─── Satellite agent node with glassmorphism ──────────────────────────────────
function AgentNodeComponent({ data, selected }: NodeProps) {
  const status: AgentStatus = (data?.status as AgentStatus) ?? 'idle'
  const color = statusColors[status]
  const [isFlipping, setIsFlipping] = useState(false)
  const prevStatus = useRef(status)

  // Flip animation when status changes
  useEffect(() => {
    if (prevStatus.current !== status) {
      setIsFlipping(true)
      setTimeout(() => setIsFlipping(false), 600)
      prevStatus.current = status
    }
  }, [status])

  return (
    <Tilt
      tiltMaxAngleX={15}
      tiltMaxAngleY={15}
      glareEnable={true}
      glareMaxOpacity={0.12}
      glareColor="#8b5cf6"
      glarePosition="all"
      perspective={800}
      transitionSpeed={400}
      scale={1.05}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <motion.div
        className="relative rounded-xl overflow-hidden cursor-pointer select-none"
        style={{
          width: 160,
          background: 'rgba(10,10,11,0.85)',
          border: `1px solid ${selected ? color : 'rgba(139,92,246,0.3)'}`,
          backdropFilter: 'blur(20px)',
          boxShadow: selected
            ? `0 0 30px ${color}66, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`
            : `0 0 15px rgba(139,92,246,0.2), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`,
          transformStyle: 'preserve-3d',
        }}
        animate={{ 
          scale: status === 'idle' ? [1, 1.02, 1] : status === 'executing' ? [1, 1.03, 1] : [1, 1.015, 1],
          rotateY: isFlipping ? [0, 360] : 0,
        }}
        transition={{
          scale: { duration: status === 'idle' ? 4 : status === 'executing' ? 1.5 : 2.5, repeat: Infinity, ease: 'easeInOut' },
          rotateY: { duration: 0.6, ease: 'easeInOut' }
        }}
        whileHover={{ 
          scale: 1.1,
          boxShadow: `0 0 40px ${color}88, 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Top glow bar */}
        <motion.div
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        <div className="px-3 py-3">
          {/* Status indicator row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ 
                  background: color, 
                  boxShadow: `0 0 10px ${color}` 
                }}
                animate={status !== 'idle' ? { 
                  opacity: [1, 0.3, 1], 
                  scale: [1, 1.4, 1],
                  boxShadow: [`0 0 10px ${color}`, `0 0 20px ${color}`, `0 0 10px ${color}`]
                } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="font-mono text-[9px] tracking-wider uppercase" style={{ color }}>
                {statusLabels[status]}
              </span>
            </div>
            {data?.latency && (
              <span className="font-mono text-[8px] text-purple-400/60">{data.latency as number}ms</span>
            )}
          </div>

          {/* Agent name */}
          <p className="font-mono font-bold text-white leading-tight truncate text-sm mb-0.5">
            {data?.name as string}
          </p>
          
          {data?.device && (
            <p className="font-mono text-[9px] text-purple-400/70 mb-1.5">
              {data.device as string}
            </p>
          )}

          {/* Last action with scrolling text effect */}
          {data?.lastAction && (
            <div className="relative overflow-hidden">
              <motion.p
                className="font-mono text-[8px] text-gray-500 whitespace-nowrap"
                animate={{ x: [0, -100, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              >
                {data.lastAction as string}
              </motion.p>
            </div>
          )}

          {/* Data stream visualization */}
          {status === 'executing' && (
            <motion.div 
              className="mt-2 h-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(139,92,246,0.2)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
          )}
        </div>

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
        />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-purple-500/30" />
        <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-purple-500/30" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-purple-500/30" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-purple-500/30" />

        {/* RF handles */}
        <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
      </motion.div>
    </Tilt>
  )
}

const nodeTypes = {
  kronos: KronosNode,
  agent: AgentNodeComponent,
}

// ─── SVG edges with flowing particles and data streams ────────────────────────
function EdgesOverlay({
  agents,
  highlightedNode,
}: {
  agents: AgentNode[]
  highlightedNode: string | null
}) {
  const rfNodes = useNodes()
  const [tick, setTick] = useState(0)
  const tickRef = useRef(0)

  // High-performance animation loop
  useEffect(() => {
    let id: number
    const loop = () => {
      tickRef.current += 1
      if (tickRef.current % 2 === 0) { // Update every other frame for perf
        setTick(t => t + 1)
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  const kronosNode = rfNodes.find(n => n.id === 'kronos')
  if (!kronosNode) return null

  const kx = kronosNode.position.x + 70
  const ky = kronosNode.position.y + 70

  return (
    <svg
      className="pointer-events-none"
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
      <defs>
        {/* Glow filter */}
        <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Gradient for edges */}
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
        </linearGradient>
        
        <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {agents.map((agent, agentIdx) => {
        const agentNode = rfNodes.find(n => n.id === agent.id)
        if (!agentNode) return null

        const ax = agentNode.position.x + 80
        const ay = agentNode.position.y + 45
        const isHighlighted = highlightedNode === agent.id || highlightedNode === 'kronos'
        const isExecuting = agent.status === 'executing'
        const baseColor = isExecuting ? '#f59e0b' : '#8b5cf6'
        const brightColor = isExecuting ? '#fbbf24' : '#a78bfa'

        // Smooth bezier curve
        const dx = (ax - kx) * 0.5
        const d = `M${kx},${ky} C${kx + dx},${ky} ${ax - dx},${ay} ${ax},${ay}`

        // Calculate path length for dash animation
        const pathLength = Math.sqrt(Math.pow(ax - kx, 2) + Math.pow(ay - ky, 2)) * 1.5

        // Particles along path
        const numParticles = isExecuting ? 6 : 3
        const particles = Array.from({ length: numParticles }, (_, i) => {
          const baseT = i / numParticles
          const speed = isExecuting ? 0.008 + i * 0.002 : 0.004 + i * 0.001
          const t = ((baseT + tickRef.current * speed) % 1 + 1) % 1
          const mt = 1 - t
          const c1x = kx + dx; const c1y = ky
          const c2x = ax - dx; const c2y = ay
          const px = mt*mt*mt*kx + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*ax
          const py = mt*mt*mt*ky + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*ay
          const alpha = 0.4 + Math.sin(t * Math.PI * 2 + agentIdx) * 0.4
          const size = isExecuting ? 3.5 + Math.sin(t * Math.PI) * 1.5 : 2.5 + Math.sin(t * Math.PI) * 1
          return { px, py, alpha, size, t }
        })

        // Data stream text positions (only for executing)
        const dataStreams = isExecuting ? Array.from({ length: 2 }, (_, i) => {
          const baseT = i * 0.5
          const speed = 0.003
          const t = ((baseT + tickRef.current * speed) % 1 + 1) % 1
          const mt = 1 - t
          const c1x = kx + dx; const c1y = ky
          const c2x = ax - dx; const c2y = ay
          const px = mt*mt*mt*kx + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*ax
          const py = mt*mt*mt*ky + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*ay
          return { px, py, t }
        }) : []

        return (
          <g key={agent.id}>
            {/* Outer glow layer */}
            <path
              d={d}
              stroke={baseColor}
              strokeWidth={isHighlighted ? 14 : 8}
              fill="none"
              opacity={0.1}
              strokeLinecap="round"
              filter="url(#edgeGlow)"
            />
            
            {/* Middle glow */}
            <path
              d={d}
              stroke={baseColor}
              strokeWidth={isHighlighted ? 6 : 4}
              fill="none"
              opacity={isHighlighted ? 0.3 : 0.15}
              strokeLinecap="round"
            />

            {/* Core line */}
            <path
              d={d}
              stroke={isExecuting ? 'url(#amberGrad)' : 'url(#purpleGrad)'}
              strokeWidth={isHighlighted ? 2.5 : 1.8}
              fill="none"
              opacity={isHighlighted ? 1 : 0.6}
              strokeLinecap="round"
              strokeDasharray={isExecuting ? '8 4' : undefined}
              strokeDashoffset={isExecuting ? -tickRef.current * 0.5 : 0}
            />

            {/* Flowing particles */}
            {particles.map((p, i) => (
              <g key={i}>
                {/* Particle glow */}
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={p.size * 2}
                  fill={baseColor}
                  opacity={p.alpha * 0.2}
                />
                {/* Particle core */}
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={p.size}
                  fill={brightColor}
                  opacity={p.alpha}
                />
                {/* Particle bright center */}
                <circle
                  cx={p.px}
                  cy={p.py}
                  r={p.size * 0.4}
                  fill="white"
                  opacity={p.alpha * 0.8}
                />
              </g>
            ))}

            {/* Data stream text (only when executing) */}
            {dataStreams.map((ds, i) => (
              <text
                key={i}
                x={ds.px}
                y={ds.py - 8}
                fill={brightColor}
                fontSize="7"
                fontFamily="monospace"
                opacity={0.6}
                textAnchor="middle"
              >
                {['CMD', 'DATA', 'SYNC', 'EXEC'][i % 4]}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Custom cursor with glow trail ────────────────────────────────────────────
function CustomCursor({ x, y }: { x: number; y: number }) {
  const springConfig = { stiffness: 1000, damping: 50, mass: 0.1 }
  const cursorX = useSpring(x, springConfig)
  const cursorY = useSpring(y, springConfig)
  
  const trailConfig = { stiffness: 300, damping: 30, mass: 0.5 }
  const trailX = useSpring(x, trailConfig)
  const trailY = useSpring(y, trailConfig)

  useEffect(() => {
    cursorX.set(x)
    cursorY.set(y)
    trailX.set(x)
    trailY.set(y)
  }, [x, y, cursorX, cursorY, trailX, trailY])

  return (
    <>
      {/* Trail glow */}
      <motion.div
        className="fixed pointer-events-none z-[9997] rounded-full"
        style={{
          width: 40,
          height: 40,
          background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
          x: trailX,
          y: trailY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
      
      {/* Outer ring */}
      <motion.div
        className="fixed pointer-events-none z-[9998] rounded-full border border-purple-500/50"
        style={{ 
          width: 24, 
          height: 24,
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
          boxShadow: '0 0 15px rgba(139,92,246,0.3)',
        }}
      />
      
      {/* Core dot */}
      <motion.div
        className="fixed pointer-events-none z-[9999] rounded-full"
        style={{
          width: 8,
          height: 8,
          background: '#a78bfa',
          boxShadow: '0 0 15px 5px rgba(139,92,246,0.8), 0 0 30px 10px rgba(139,92,246,0.4)',
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
    </>
  )
}

// ─── Hyperspace mode component ────────────────────────────────────────────────
function HyperspaceOverlay({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Radial zoom lines */}
      {Array.from({ length: 50 }).map((_, i) => {
        const angle = (i / 50) * Math.PI * 2
        const length = 200 + Math.random() * 300
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 origin-left"
            style={{
              width: length,
              height: 1,
              background: `linear-gradient(90deg, transparent, rgba(139,92,246,${0.3 + Math.random() * 0.4}), transparent)`,
              rotate: `${(angle * 180) / Math.PI}deg`,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ 
              scaleX: [0, 1, 1.5],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              delay: Math.random() * 0.5,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </motion.div>
  )
}

// ─── Main inner component ─────────────────────────────────────────────────────
function NodeMapInner({ agents, onNodeClick }: NodeMapProps) {
  const { fitView, zoomIn, zoomOut, setViewport, getViewport } = useReactFlow()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [canvasMouseNorm, setCanvasMouseNorm] = useState({ x: 0, y: 0 })
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hyperspaceMode, setHyperspaceMode] = useState(false)
  const [sceneRotation, setSceneRotation] = useState({ x: 0, y: 0 })
  const rightDragRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  
  // NEW: Velocity tracking for chromatic aberration
  const [panVelocity, setPanVelocity] = useState(0)
  const lastPanPosRef = useRef({ x: 0, y: 0 })
  const velocityDecayRef = useRef<number | null>(null)
  
  // NEW: Sound state
  const [soundEnabled, setSoundEnabled] = useState(false)
  
  // NEW: Magnetic attraction to cursor
  const magneticRadiusRef = useRef(150)
  
  // NEW: Selection box state
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)
  const isSelectingRef = useRef(false)

  // Build RF nodes in orbital layout
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
      const radius = 320
      return {
        id: agent.id,
        type: 'agent',
        position: {
          x: Math.cos(angle) * radius - 80,
          y: Math.sin(angle) * radius - 45,
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)

  // Sync agent statuses
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

  // Mouse tracking with performance optimization and velocity
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY })
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCanvasMouseNorm({
        x: ((e.clientX - rect.left) / rect.width) * 100 - 50,
        y: ((e.clientY - rect.top) / rect.height) * 100 - 50,
      })
    }

    // Right-click drag for scene rotation
    if (rightDragRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      setSceneRotation(prev => ({
        x: Math.max(-5, Math.min(5, prev.x + dy * 0.05)),
        y: Math.max(-5, Math.min(5, prev.y + dx * 0.05)),
      }))
      
      // Calculate pan velocity for chromatic aberration
      const velocity = Math.sqrt(dx * dx + dy * dy)
      setPanVelocity(velocity)
      
      // Decay velocity
      if (velocityDecayRef.current) cancelAnimationFrame(velocityDecayRef.current)
      velocityDecayRef.current = requestAnimationFrame(function decay() {
        setPanVelocity(v => {
          if (v < 0.5) return 0
          velocityDecayRef.current = requestAnimationFrame(decay)
          return v * 0.92
        })
      })
    }
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Context menu prevention and right-click rotation
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      rightDragRef.current = true
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      rightDragRef.current = false
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
      if (e.key === 'Escape') setShowSearch(false)
      if (e.key === 'h' || e.key === 'H') {
        setHyperspaceMode(true)
        setTimeout(() => {
          setHyperspaceMode(false)
          fitView({ duration: 800, padding: 0.3 })
        }, 2000)
      }
      // Sound toggle with 'M' key
      if (e.key === 'm' || e.key === 'M') {
        const isOn = soundEngine?.toggle() ?? false
        setSoundEnabled(isOn)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fitView])

  // Update sound intensity based on active agents
  useEffect(() => {
    if (soundEnabled && soundEngine) {
      const activeCount = agents.filter(a => a.status === 'executing' || a.status === 'listening').length
      soundEngine.setIntensity(activeCount)
    }
  }, [agents, soundEnabled])

  // Device orientation for mobile (gyroscope)
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        setSceneRotation({
          x: Math.max(-5, Math.min(5, e.beta * 0.1)),
          y: Math.max(-5, Math.min(5, e.gamma * 0.1)),
        })
      }
    }
    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [])

  const onPaneDoubleClick = useCallback(() => {
    fitView({ duration: 700, padding: 0.25 })
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

  const handleSearch = useCallback(
    (q: string) => {
      const node = nodes.find(n =>
        (n.data?.name as string ?? '').toLowerCase().includes(q.toLowerCase()) ||
        n.id.toLowerCase().includes(q.toLowerCase())
      )
      if (node) {
        fitView({ nodes: [node], duration: 800, padding: 0.6 })
        setHighlightedNode(node.id)
        setTimeout(() => setHighlightedNode(null), 2500)
      }
      setShowSearch(false)
      setSearchQuery('')
    },
    [nodes, fitView]
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ 
        cursor: 'none',
        perspective: '1000px',
      }}
    >
      {/* Custom cursor */}
      <CustomCursor x={mousePos.x} y={mousePos.y} />

      {/* Hyperspace overlay */}
      <AnimatePresence>
        {hyperspaceMode && <HyperspaceOverlay active={hyperspaceMode} />}
      </AnimatePresence>

      {/* 3D scene rotation wrapper */}
      <motion.div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
        }}
        animate={{
          rotateX: sceneRotation.x,
          rotateY: sceneRotation.y,
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        {/* Three.js background */}
        <ThreeBackground mouseX={canvasMouseNorm.x} mouseY={canvasMouseNorm.y} panVelocity={panVelocity} />

        {/* ReactFlow */}
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={() => setHighlightedNode(null)}
          onDoubleClick={onPaneDoubleClick}
          nodeTypes={nodeTypes}
          minZoom={0.2}
          maxZoom={3}
          defaultViewport={{ x: 500, y: 280, zoom: 0.85 }}
          panOnDrag={[0, 1]} // Left and middle mouse buttons
          zoomOnScroll
          zoomOnPinch
          fitView={false}
          style={{ background: 'transparent', position: 'absolute', inset: 0, zIndex: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={32}
            size={1}
            color="rgba(139,92,246,0.1)"
            style={{ zIndex: 0 }}
          />

          {/* Custom edges overlay */}
          <EdgesOverlay agents={agents} highlightedNode={highlightedNode} />

          <MiniMap
            style={{
              background: 'rgba(0,0,0,0.9)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px',
            }}
            nodeColor={node => {
              if (node.id === 'kronos') return '#8b5cf6'
              const agent = agents.find(a => a.id === node.id)
              return agent ? statusColors[agent.status] : '#6b7280'
            }}
            maskColor="rgba(0,0,0,0.4)"
            zoomable
            pannable
          />

          {/* Control panels */}
          <Panel position="top-right">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(true)}
                className="font-mono text-[10px] text-purple-400/60 hover:text-purple-400 transition-colors flex items-center gap-1.5 bg-black/60 border border-purple-500/20 rounded-lg px-3 py-1.5 backdrop-blur-sm"
              >
                <span className="text-purple-300">CMD+K</span>
                <span className="text-gray-500">search</span>
              </button>
              <button
                onClick={() => {
                  setHyperspaceMode(true)
                  setTimeout(() => {
                    setHyperspaceMode(false)
                    fitView({ duration: 800, padding: 0.3 })
                  }, 2000)
                }}
                className="font-mono text-[10px] text-purple-400/60 hover:text-purple-400 transition-colors flex items-center gap-1.5 bg-black/60 border border-purple-500/20 rounded-lg px-3 py-1.5 backdrop-blur-sm"
              >
                <span className="text-purple-300">H</span>
                <span className="text-gray-500">hyperspace</span>
              </button>
            </div>
          </Panel>

          {/* Zoom controls */}
          <Panel position="bottom-right" style={{ marginBottom: 90 }}>
            <div className="flex flex-col gap-1.5 bg-black/60 border border-purple-500/20 rounded-lg p-1 backdrop-blur-sm">
              <button
                onClick={() => zoomIn({ duration: 250 })}
                className="w-8 h-8 font-mono text-sm text-purple-400 rounded-md flex items-center justify-center hover:bg-purple-500/20 transition-colors"
              >+</button>
              <div className="h-px bg-purple-500/20" />
              <button
                onClick={() => zoomOut({ duration: 250 })}
                className="w-8 h-8 font-mono text-sm text-purple-400 rounded-md flex items-center justify-center hover:bg-purple-500/20 transition-colors"
              >-</button>
              <div className="h-px bg-purple-500/20" />
              <button
                onClick={() => fitView({ duration: 600, padding: 0.25 })}
                className="w-8 h-8 font-mono text-[10px] text-purple-400 rounded-md flex items-center justify-center hover:bg-purple-500/20 transition-colors"
              >FIT</button>
            </div>
          </Panel>

          {/* Status legend */}
          <Panel position="bottom-left">
            <div className="flex items-center gap-3 bg-black/60 border border-purple-500/20 rounded-lg px-3 py-2 backdrop-blur-sm">
              {Object.entries(statusLabels).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ background: statusColors[key as AgentStatus], boxShadow: `0 0 6px ${statusColors[key as AgentStatus]}` }} 
                  />
                  <span className="font-mono text-[8px] text-gray-400 uppercase">{label.replace('...', '')}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </motion.div>

      {/* CMD+K Search modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            className="absolute inset-0 z-[100] flex items-start justify-center pt-20 px-8"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              className="w-full max-w-lg glass-panel rounded-xl overflow-hidden shadow-2xl"
              style={{ boxShadow: '0 0 50px rgba(139,92,246,0.3)' }}
              initial={{ y: -30, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-purple-500/20">
                <div className="w-5 h-5 rounded-md bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearch(searchQuery)
                    if (e.key === 'Escape') setShowSearch(false)
                  }}
                  placeholder="Search agents..."
                  className="flex-1 bg-transparent font-mono text-sm text-white placeholder-gray-600 outline-none"
                />
                <span className="font-mono text-[10px] text-gray-600 px-1.5 py-0.5 rounded bg-gray-800">ESC</span>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {agents
                  .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleSearch(a.name)}
                      className="w-full text-left font-mono text-sm text-gray-300 hover:text-white hover:bg-purple-500/10 px-3 py-2 rounded-lg flex items-center gap-3 transition-colors"
                    >
                      <motion.span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: statusColors[a.status], boxShadow: `0 0 8px ${statusColors[a.status]}` }}
                        animate={a.status !== 'idle' ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="flex-1">{a.name}</span>
                      {a.device && <span className="text-gray-600 text-xs">{a.device}</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: statusBg[a.status], color: statusColors[a.status] }}>
                        {statusLabels[a.status]}
                      </span>
                    </button>
                  ))}
                {agents.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <p className="text-center text-gray-600 font-mono text-sm py-4">No agents found</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Public export ─────────────────────────────────────��──────────────────────
export function NodeMap({ agents, onNodeClick }: NodeMapProps) {
  return (
    <ReactFlowProvider>
      <NodeMapInner agents={agents} onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  )
}
