'use client'

import { motion } from 'framer-motion'
import { useMemo, useState, useCallback } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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

export function NodeMap({ agents, onNodeClick }: NodeMapProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  
  // Calculate positions for agents in a circle around KRONOS
  const nodePositions = useMemo(() => {
    const centerX = 50
    const centerY = 45
    const radius = 32
    
    return agents.map((agent, index) => {
      const angle = (index * 2 * Math.PI) / agents.length - Math.PI / 2
      return {
        ...agent,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    })
  }, [agents])

  const handleNodeClick = useCallback((agent: AgentNode) => {
    onNodeClick?.(agent)
  }, [onNodeClick])

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative w-full h-full min-h-[400px]">
        <svg
          viewBox="0 0 100 90"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Definitions for gradients and filters */}
          <defs>
            {/* Purple glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Connection gradient */}
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#6d28d9" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
            </linearGradient>
            
            {/* Active connection gradient */}
            <linearGradient id="activeConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
            </linearGradient>
            
            {/* Kronos hexagon gradient */}
            <radialGradient id="kronosGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="70%" stopColor="#6d28d9" />
              <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
          </defs>
          
          {/* Connection lines from KRONOS to agents */}
          {nodePositions.map((agent) => {
            const isHighlighted = hoveredNode === agent.id || hoveredNode === 'kronos'
            return (
              <motion.line
                key={`connection-${agent.id}`}
                x1={50}
                y1={45}
                x2={agent.x}
                y2={agent.y}
                stroke={isHighlighted ? 'url(#activeConnectionGradient)' : 'url(#connectionGradient)'}
                strokeWidth={isHighlighted ? 0.4 : 0.25}
                className={isHighlighted ? 'animate-connection-flow' : ''}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
                filter={isHighlighted ? 'url(#glow)' : undefined}
              />
            )
          })}
          
          {/* KRONOS - Central Node */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNode('kronos')}
                onMouseLeave={() => setHoveredNode(null)}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Hexagon shape for KRONOS */}
                <motion.polygon
                  points="50,37 57,41 57,49 50,53 43,49 43,41"
                  fill="url(#kronosGradient)"
                  stroke="#8b5cf6"
                  strokeWidth="0.3"
                  filter="url(#glow)"
                  animate={{
                    filter: ['drop-shadow(0 0 2px #8b5cf6)', 'drop-shadow(0 0 4px #8b5cf6)', 'drop-shadow(0 0 2px #8b5cf6)']
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                
                {/* KRONOS label */}
                <text
                  x={50}
                  y={46}
                  textAnchor="middle"
                  className="fill-white font-mono text-[2.5px] font-bold tracking-wider"
                >
                  KRONOS
                </text>
              </motion.g>
            </TooltipTrigger>
            <TooltipContent side="top" className="glass-panel border-primary/30">
              <div className="font-mono text-xs">
                <p className="text-primary font-semibold">KRONOS</p>
                <p className="text-muted-foreground">Shared Intelligence Core</p>
                <p className="text-green-400 text-[10px] mt-1">● Active — 8 agents connected</p>
              </div>
            </TooltipContent>
          </Tooltip>
          
          {/* Agent Nodes */}
          {nodePositions.map((agent, index) => {
            const isHovered = hoveredNode === agent.id
            const statusColor = statusColors[agent.status]
            
            return (
              <Tooltip key={agent.id}>
                <TooltipTrigger asChild>
                  <motion.g
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode(agent.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => handleNodeClick(agent)}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: isHovered ? 1.1 : 1, 
                      opacity: 1 
                    }}
                    transition={{ 
                      duration: 0.3,
                      delay: index * 0.1 + 0.8
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Node background */}
                    <rect
                      x={agent.x - 8}
                      y={agent.y - 4}
                      width={16}
                      height={8}
                      rx={1}
                      fill="rgba(0,0,0,0.8)"
                      stroke={isHovered ? '#8b5cf6' : 'rgba(139,92,246,0.3)'}
                      strokeWidth={0.2}
                      className="transition-all duration-200"
                    />
                    
                    {/* Status indicator */}
                    <motion.circle
                      cx={agent.x - 5.5}
                      cy={agent.y}
                      r={1}
                      fill={statusColor}
                      animate={agent.status !== 'idle' ? {
                        opacity: [1, 0.5, 1],
                        r: [1, 1.2, 1]
                      } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    
                    {/* Agent name */}
                    <text
                      x={agent.x + 1}
                      y={agent.y + 0.8}
                      textAnchor="middle"
                      className="fill-white font-mono text-[1.8px] font-medium"
                    >
                      {agent.name.length > 10 ? agent.name.slice(0, 10) + '...' : agent.name}
                    </text>
                  </motion.g>
                </TooltipTrigger>
                <TooltipContent side="top" className="glass-panel border-primary/30">
                  <div className="font-mono text-xs space-y-1">
                    <p className="text-primary font-semibold">{agent.name}</p>
                    {agent.device && (
                      <p className="text-muted-foreground text-[10px]">{agent.device}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="w-2 h-2 rounded-full animate-status-pulse"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span style={{ color: statusColor }}>{statusLabels[agent.status]}</span>
                    </div>
                    {agent.lastAction && (
                      <p className="text-muted-foreground text-[10px]">
                        Last: {agent.lastAction}
                      </p>
                    )}
                    {agent.latency && (
                      <p className="text-muted-foreground text-[10px]">
                        Latency: {agent.latency}ms
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </svg>
      </div>
    </TooltipProvider>
  )
}
