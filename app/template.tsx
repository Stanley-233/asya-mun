"use client"

import { motion } from "framer-motion"
import { ReactNode } from "react"

export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        rotateX: 90,
        filter: "blur(10px)"
      }}
      animate={{ 
        opacity: 1, 
        rotateX: 0,
        filter: "blur(0px)"
      }}
      transition={{
        duration: 0.5,
        ease: "easeOut"
      }}
      style={{ transformPerspective: 1200 }}
    >
      {children}
    </motion.div>
  )
}
