'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Cpu, Activity, Clock, Zap, BarChart3, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { AgentStatus } from './node-map'

interface AgentDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  agent: {
    id: string
    name: string
    device?: string
    status: AgentStatus
    lastAction?: string
    latency?: number
    cpuUsage?: number
    ramUsage?: number
    uptime?: string
    tasksCompleted?: number
    errorRate?: number
  } | null
}

const statusConfig: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  executing: { color: 'text-amber-400', bg: 'bg-amber-400/20', label: 'Executing' },
  listening: { color: 'text-emerald-400', bg: 'bg-emerald-400/20', label: 'Listening' },
  idle: { color: 'text-gray-400', bg: 'bg-gray-400/20', label: 'Idle' },
  error: { color: 'text-red-400', bg: 'bg-red-400/20', label: 'Error' },
}

export function AgentDetailPanel({ isOpen, onClose, agent }: AgentDetailPanelProps) {
  if (!agent) return null
  
  const config = statusConfig[agent.status]
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-black/95 border-l border-primary/30 z-50 overflow-hidden flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-primary/20">
              <div>
                <h2 className="font-mono font-bold text-lg text-foreground">
                  {agent.name}
                </h2>
                {agent.device && (
                  <p className="font-mono text-xs text-muted-foreground">{agent.device}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground hover:bg-primary/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Status Section */}
              <div className="glass-panel rounded-lg p-4">
                <h3 className="font-mono text-xs text-muted-foreground mb-3 tracking-wider">
                  STATUS
                </h3>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline" 
                    className={`${config.bg} ${config.color} border-0 text-sm font-mono`}
                  >
                    <span 
                      className={`w-2 h-2 rounded-full mr-2 ${agent.status !== 'idle' ? 'animate-status-pulse' : ''}`}
                      style={{ 
                        backgroundColor: agent.status === 'executing' ? '#f59e0b' : 
                                        agent.status === 'listening' ? '#10b981' : 
                                        agent.status === 'error' ? '#ef4444' : '#6b7280' 
                      }}
                    />
                    {config.label}
                  </Badge>
                  {agent.latency && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {agent.latency}ms latency
                    </span>
                  )}
                </div>
                {agent.lastAction && (
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    <span className="text-primary">Last Action:</span> {agent.lastAction}
                  </p>
                )}
              </div>
              
              {/* Resources Section */}
              <div className="glass-panel rounded-lg p-4">
                <h3 className="font-mono text-xs text-muted-foreground mb-4 tracking-wider">
                  RESOURCES
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-primary" />
                        <span className="font-mono text-xs">CPU Usage</span>
                      </div>
                      <span className="font-mono text-xs text-primary">
                        {agent.cpuUsage || 0}%
                      </span>
                    </div>
                    <Progress value={agent.cpuUsage || 0} className="h-2 bg-black/40" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="font-mono text-xs">RAM Usage</span>
                      </div>
                      <span className="font-mono text-xs text-primary">
                        {agent.ramUsage || 0}%
                      </span>
                    </div>
                    <Progress value={agent.ramUsage || 0} className="h-2 bg-black/40" />
                  </div>
                </div>
              </div>
              
              {/* Metrics Section */}
              <div className="glass-panel rounded-lg p-4">
                <h3 className="font-mono text-xs text-muted-foreground mb-4 tracking-wider">
                  METRICS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-black/40 rounded-lg border border-primary/10">
                    <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
                    <p className="font-mono text-lg font-bold text-foreground">
                      {agent.uptime || '00:00'}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">Uptime</p>
                  </div>
                  
                  <div className="text-center p-3 bg-black/40 rounded-lg border border-primary/10">
                    <BarChart3 className="w-5 h-5 text-primary mx-auto mb-2" />
                    <p className="font-mono text-lg font-bold text-foreground">
                      {agent.tasksCompleted || 0}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">Tasks Done</p>
                  </div>
                  
                  <div className="text-center p-3 bg-black/40 rounded-lg border border-primary/10">
                    <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                    <p className="font-mono text-lg font-bold text-emerald-400">
                      {100 - (agent.errorRate || 0)}%
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">Success Rate</p>
                  </div>
                  
                  <div className="text-center p-3 bg-black/40 rounded-lg border border-primary/10">
                    <RefreshCw className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                    <p className="font-mono text-lg font-bold text-amber-400">
                      {agent.errorRate || 0}%
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">Error Rate</p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  className="w-full font-mono text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Restart Agent
                </Button>
                <Button 
                  className="w-full font-mono text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  variant="outline"
                >
                  Stop Agent
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
