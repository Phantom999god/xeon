'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  NodeMap,
  AgentCard,
  TerminalLog,
  AppSidebar,
  AgentDetailPanel,
  generateLogEntry,
} from '@/components/pulse'
import type { AgentNode, AgentStatus } from '@/components/pulse'

// Agent data
const initialAgents: AgentNode[] = [
  { id: 'phantom', name: 'Terminal Phantom', device: 'Dell', status: 'listening', lastAction: 'Listening on /term', latency: 12 },
  { id: 'helios', name: 'Helios', device: 'Windows', status: 'executing', lastAction: 'list files', latency: 24 },
  { id: 'nyra', name: 'Nyra', device: 'Acer', status: 'idle', lastAction: 'Awaiting trigger', latency: 18 },
  { id: 'nyrelika', name: 'Nyrelika', device: 'Acer', status: 'listening', lastAction: 'Monitoring events', latency: 15 },
  { id: 'outreach', name: 'Outreach', status: 'executing', lastAction: 'Sending batch emails', latency: 45 },
  { id: 'inbox', name: 'Inbox Triage', status: 'listening', lastAction: 'Scanning inbox', latency: 8 },
  { id: 'doccontrol', name: 'Document Control', status: 'idle', lastAction: 'Indexed 142 files', latency: 22 },
  { id: 'leadroute', name: 'Lead Routing', status: 'executing', lastAction: 'Processing queue', latency: 31 },
]

// Extended agent data for cards
const agentCardData = [
  { ...initialAgents[0], currentTask: 'Listening on /term endpoint', cpuUsage: 12, ramUsage: 28, uptime: '14h 32m', lastHeartbeat: '2s ago', tasksCompleted: 847, errorRate: 0.3 },
  { ...initialAgents[1], currentTask: 'Executing: list files in /docs', cpuUsage: 67, ramUsage: 45, uptime: '8h 15m', lastHeartbeat: '1s ago', tasksCompleted: 1234, errorRate: 1.2 },
  { ...initialAgents[2], currentTask: undefined, cpuUsage: 3, ramUsage: 15, uptime: '22h 48m', lastHeartbeat: '5s ago', tasksCompleted: 456, errorRate: 0.1 },
  { ...initialAgents[3], currentTask: 'Monitoring file change events', cpuUsage: 24, ramUsage: 32, uptime: '6h 20m', lastHeartbeat: '3s ago', tasksCompleted: 289, errorRate: 0.5 },
  { ...initialAgents[4], currentTask: 'Sending batch: campaign_q4', cpuUsage: 78, ramUsage: 56, uptime: '4h 10m', lastHeartbeat: '1s ago', tasksCompleted: 2341, errorRate: 2.1 },
  { ...initialAgents[5], currentTask: 'Scanning inbox for priority', cpuUsage: 35, ramUsage: 41, uptime: '18h 55m', lastHeartbeat: '2s ago', tasksCompleted: 567, errorRate: 0.2 },
  { ...initialAgents[6], currentTask: undefined, cpuUsage: 8, ramUsage: 22, uptime: '12h 05m', lastHeartbeat: '8s ago', tasksCompleted: 1089, errorRate: 0.4 },
  { ...initialAgents[7], currentTask: 'Processing lead queue (12 items)', cpuUsage: 54, ramUsage: 38, uptime: '9h 42m', lastHeartbeat: '1s ago', tasksCompleted: 3456, errorRate: 1.8 },
]

// Initial log entries
const initialLogs = [
  { id: '1', timestamp: '13:42:08', agent: 'KRONOS', message: 'System boot complete — 8 agents online', type: 'success' as const },
  { id: '2', timestamp: '13:42:09', agent: 'KRONOS', message: 'Routing task to Helios...', type: 'info' as const },
  { id: '3', timestamp: '13:42:10', agent: 'Helios', message: 'Acknowledged — executing: list files', type: 'info' as const },
  { id: '4', timestamp: '13:42:11', agent: 'Phantom', message: 'Listening on /term', type: 'info' as const },
  { id: '5', timestamp: '13:42:12', agent: 'Nyra', message: 'Idle — awaiting trigger', type: 'info' as const },
  { id: '6', timestamp: '13:42:13', agent: 'Outreach', message: 'Starting batch: campaign_q4 (500 recipients)', type: 'info' as const },
  { id: '7', timestamp: '13:42:14', agent: 'Inbox Triage', message: 'Scanning inbox... 23 new messages', type: 'info' as const },
  { id: '8', timestamp: '13:42:15', agent: 'Lead Routing', message: 'Processing queue — 12 leads pending', type: 'info' as const },
]

export default function PulseDashboard() {
  const [activeView, setActiveView] = useState('overview')
  const [agents, setAgents] = useState(initialAgents)
  const [logs, setLogs] = useState(initialLogs)
  const [terminalCollapsed, setTerminalCollapsed] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<typeof agentCardData[0] | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)

  // Simulate live log updates
  useEffect(() => {
    const agentNames = ['KRONOS', 'Phantom', 'Helios', 'Nyra', 'Nyrelika', 'Outreach', 'Inbox Triage', 'Doc Control', 'Lead Routing']
    
    const interval = setInterval(() => {
      const newLog = generateLogEntry(agentNames)
      setLogs(prev => {
        const updated = [...prev, newLog]
        // Keep only last 200 entries
        return updated.slice(-200)
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Simulate agent status changes
  useEffect(() => {
    const statuses: AgentStatus[] = ['executing', 'listening', 'idle']
    
    const interval = setInterval(() => {
      setAgents(prev => {
        const idx = Math.floor(Math.random() * prev.length)
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)]
        const updated = [...prev]
        updated[idx] = { ...updated[idx], status: newStatus }
        return updated
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleNodeClick = useCallback((agent: AgentNode) => {
    const fullAgent = agentCardData.find(a => a.id === agent.id)
    if (fullAgent) {
      setSelectedAgent(fullAgent)
      setDetailPanelOpen(true)
    }
  }, [])

  const handleCardClick = useCallback((agent: typeof agentCardData[0]) => {
    setSelectedAgent(agent)
    setDetailPanelOpen(true)
  }, [])

  return (
    <div className="h-screen w-full radial-glow scanlines overflow-hidden">
      <AppSidebar activeView={activeView} onViewChange={setActiveView}>
        <div className="flex flex-col h-full overflow-auto">
          {/* Node Map Section */}
          <motion.div 
            className="flex-shrink-0 p-4 pb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="glass-panel rounded-lg p-4 relative overflow-hidden" style={{ minHeight: '340px' }}>
              {/* Header */}
              <div className="absolute top-4 left-4 z-10">
                <h2 className="font-mono text-xs text-muted-foreground tracking-wider mb-1">
                  AI ORCHESTRATION
                </h2>
                <p className="font-mono text-lg font-bold gradient-text">
                  NODE MATRIX
                </p>
              </div>
              
              {/* Live indicator */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-status-pulse" />
                <span className="font-mono text-[10px] text-emerald-400 tracking-wider">
                  LIVE
                </span>
              </div>
              
              {/* Node Map */}
              <NodeMap 
                agents={agents} 
                onNodeClick={handleNodeClick}
              />
            </div>
          </motion.div>
          
          {/* Agent Cards Grid */}
          <motion.div 
            className="px-4 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {agentCardData.map((agent) => (
                <AgentCard
                  key={agent.id}
                  name={agent.name}
                  device={agent.device}
                  status={agents.find(a => a.id === agent.id)?.status || agent.status}
                  currentTask={agent.currentTask}
                  cpuUsage={agent.cpuUsage}
                  ramUsage={agent.ramUsage}
                  uptime={agent.uptime}
                  lastHeartbeat={agent.lastHeartbeat}
                  onClick={() => handleCardClick(agent)}
                />
              ))}
            </div>
          </motion.div>
          
          {/* Terminal Log - Bottom */}
          <div className="flex-shrink-0 p-4 pt-2 sticky bottom-0 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b] to-transparent">
            <TerminalLog 
              logs={logs}
              isCollapsed={terminalCollapsed}
              onToggleCollapse={() => setTerminalCollapsed(!terminalCollapsed)}
            />
          </div>
        </div>
      </AppSidebar>
      
      {/* Agent Detail Panel */}
      <AgentDetailPanel
        isOpen={detailPanelOpen}
        onClose={() => setDetailPanelOpen(false)}
        agent={selectedAgent}
      />
    </div>
  )
}
