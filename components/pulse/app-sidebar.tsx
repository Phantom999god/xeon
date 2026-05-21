'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  Brain,
  Network,
  Clock,
  Terminal,
  Settings,
  Hexagon,
} from 'lucide-react'

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'memory', label: 'Memory Core', icon: Brain },
  { id: 'agents', label: 'Agent Node Matrix', icon: Network },
  { id: 'cron', label: 'Cron Jobs', icon: Clock },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
]

interface AppSidebarProps {
  activeView: string
  onViewChange: (view: string) => void
  children: React.ReactNode
}

export function AppSidebar({ activeView, onViewChange, children }: AppSidebarProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar 
        collapsible="icon" 
        className="border-r border-primary/20 bg-sidebar"
      >
        <SidebarHeader className="border-b border-primary/20 px-4 py-4">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              <Hexagon className="w-8 h-8 text-primary animate-pulse-glow" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="font-mono font-bold text-sm tracking-wider gradient-text">
                TRINITY V4
              </span>
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest">
                PULSE OS
              </span>
            </div>
          </motion.div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-[10px] text-muted-foreground tracking-wider">
              NAVIGATION
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item, index) => (
                  <SidebarMenuItem key={item.id}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <SidebarMenuButton
                        isActive={activeView === item.id}
                        onClick={() => onViewChange(item.id)}
                        tooltip={item.label}
                        className={`
                          font-mono text-xs transition-all duration-200
                          ${activeView === item.id 
                            ? 'bg-primary/20 text-primary border-l-2 border-primary' 
                            : 'hover:bg-primary/10 hover:text-primary'
                          }
                        `}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter className="border-t border-primary/20 p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                className="font-mono text-xs hover:bg-primary/10 hover:text-primary"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          
          <div className="mt-4 pt-4 border-t border-primary/10 group-data-[collapsible=icon]:hidden">
            <div className="font-mono text-[10px] text-muted-foreground space-y-1">
              <div className="flex items-center justify-between">
                <span>System Status</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-status-pulse" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Version</span>
                <span className="text-primary">v4.2.1</span>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset className="bg-transparent">
        <header className="flex items-center h-12 px-4 border-b border-primary/20 bg-black/40 md:hidden">
          <SidebarTrigger className="text-primary hover:bg-primary/20" />
          <div className="flex items-center gap-2 ml-3">
            <Hexagon className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-bold gradient-text">TRINITY V4</span>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
