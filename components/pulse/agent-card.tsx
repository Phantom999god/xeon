'use client'

import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Cpu, Clock, Activity, Zap } from 'lucide-react'
import type { AgentStatus } from './node-map'

interface AgentCardProps {
  name: string
  device?: string
  status: AgentStatus
  currentTask?: string
  cpuUsage: number
  ramUsage: number
  uptime: string
  lastHeartbeat: string
  onClick?: () => void
}

const statusConfig: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  executing: { color: 'text-amber-400', bg: 'bg-amber-400/20', label: 'Executing' },
  listening: { color: 'text-emerald-400', bg: 'bg-emerald-400/20', label: 'Listening' },
  idle: { color: 'text-gray-400', bg: 'bg-gray-400/20', label: 'Idle' },
  error: { color: 'text-red-400', bg: 'bg-red-400/20', label: 'Error' },
}

export function AgentCard({
  name,
  device,
  status,
  currentTask,
  cpuUsage,
  ramUsage,
  uptime,
  lastHeartbeat,
  onClick,
}: AgentCardProps) {
  const config = statusConfig[status]
  
  return (
    <motion.div
      className="glass-panel rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-primary/40"
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-mono font-semibold text-sm text-foreground truncate">
            {name}
          </h3>
          {device && (
            <p className="text-xs text-muted-foreground font-mono truncate">
              {device}
            </p>
          )}
        </div>
        <Badge 
          variant="outline" 
          className={`${config.bg} ${config.color} border-0 text-[10px] font-mono shrink-0`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status !== 'idle' ? 'animate-status-pulse' : ''}`} 
                style={{ backgroundColor: status === 'executing' ? '#f59e0b' : status === 'listening' ? '#10b981' : status === 'error' ? '#ef4444' : '#6b7280' }} 
          />
          {config.label}
        </Badge>
      </div>
      
      {/* Current Task */}
      {currentTask && (
        <div className="mb-3 p-2 bg-black/40 rounded border border-primary/10">
          <p className="text-xs text-muted-foreground font-mono truncate">
            <span className="text-primary">Task:</span> {currentTask}
          </p>
        </div>
      )}
      
      {/* Resource Bars */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <Progress 
              value={cpuUsage} 
              className="h-1.5 bg-black/40" 
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
            {cpuUsage}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <Progress 
              value={ramUsage} 
              className="h-1.5 bg-black/40"
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
            {ramUsage}%
          </span>
        </div>
      </div>
      
      {/* Footer Stats */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-2 border-t border-primary/10">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{uptime}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>{lastHeartbeat}</span>
        </div>
      </div>
    </motion.div>
  )
}
