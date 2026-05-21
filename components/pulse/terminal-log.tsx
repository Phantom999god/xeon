'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronUp, Terminal as TerminalIcon } from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: string
  agent: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

interface TerminalLogProps {
  logs: LogEntry[]
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function TerminalLog({ logs, isCollapsed = false, onToggleCollapse }: TerminalLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50
    setAutoScroll(isAtBottom)
  }

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400'
      case 'warning': return 'text-amber-400'
      case 'error': return 'text-red-400'
      default: return 'text-white'
    }
  }

  return (
    <motion.div 
      className="glass-panel rounded-lg overflow-hidden flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    >
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-primary/20 hover:bg-black/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs text-primary font-semibold tracking-wider">
            OPERATIONAL LOG
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            ({logs.length} entries)
          </span>
        </div>
        {isCollapsed ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {/* Log Content */}
      {!isCollapsed && (
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-black/80 terminal-scrollbar relative"
          style={{ maxHeight: '160px' }}
        >
          {/* Fade overlay at top */}
          <div className="sticky top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
          
          <div className="px-4 py-2 space-y-1">
            {logs.map((log, index) => (
              <motion.div
                key={log.id}
                className="terminal-text flex gap-2 items-start"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
              >
                <span className="text-emerald-500 shrink-0">
                  [{log.timestamp}]
                </span>
                <span className="text-primary font-semibold shrink-0">
                  {log.agent}
                </span>
                <span className="text-muted-foreground shrink-0">{'>'}</span>
                <span className={`${getTypeColor(log.type)} break-all`}>
                  {log.message}
                </span>
              </motion.div>
            ))}
          </div>
          
          {/* Cursor blink */}
          <div className="px-4 pb-2">
            <span className="terminal-text text-primary animate-pulse">▋</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Helper to generate simulated logs
export function generateLogEntry(agents: string[]): LogEntry {
  const agent = agents[Math.floor(Math.random() * agents.length)]
  const messages = [
    { msg: 'Executing task...', type: 'info' as const },
    { msg: 'Task completed successfully', type: 'success' as const },
    { msg: 'Listening for commands', type: 'info' as const },
    { msg: 'Processing queue item', type: 'info' as const },
    { msg: 'Connecting to endpoint', type: 'info' as const },
    { msg: 'Health check passed', type: 'success' as const },
    { msg: 'Routing request to handler', type: 'info' as const },
    { msg: 'Cache invalidated', type: 'warning' as const },
    { msg: 'Retry attempt 1/3', type: 'warning' as const },
    { msg: 'Connection established', type: 'success' as const },
  ]
  
  const { msg, type } = messages[Math.floor(Math.random() * messages.length)]
  const now = new Date()
  const timestamp = now.toTimeString().split(' ')[0]
  
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    agent,
    message: msg,
    type,
  }
}
