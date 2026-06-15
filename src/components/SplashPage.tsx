import { motion } from "motion/react";
import { ChevronUp } from "lucide-react";

export default function SplashPage() {
  return (
    <section className="h-[100dvh] w-full snap-start snap-always relative flex flex-col items-center justify-center overflow-hidden">
      {/* Decorative stars / background elements can go here */}
      <div className="absolute top-1/4 left-10 w-2 h-2 rounded-full bg-white/40 blur-[1px]" />
      <div className="absolute top-1/3 right-12 w-3 h-3 rounded-full bg-white/50 blur-[2px]" />
      <div className="absolute bottom-1/3 left-1/4 w-4 h-4 rounded-full bg-blue-200/40 blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-center z-10"
      >
        <h1 className="text-[4rem] sm:text-[5rem] font-serif-sc text-white mb-2 tracking-wide shadow-sm" style={{ textShadow: "0 4px 20px rgba(255,255,255,0.4)" }}>
          Yiseen
        </h1>
        <p className="text-white/90 font-light tracking-widest text-lg sm:text-xl" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          See what unfolds in your day
        </p>
        <p className="mt-3 text-white/80 font-light tracking-widest text-xs uppercase" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          DeepSeek v4 Pro
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 flex flex-col items-center justify-center text-white/70"
      >
        <p className="text-xs mb-2 tracking-widest uppercase">向上滑动开启</p>
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <ChevronUp className="w-6 h-6 opacity-80" />
        </motion.div>
      </motion.div>
    </section>
  );
}
